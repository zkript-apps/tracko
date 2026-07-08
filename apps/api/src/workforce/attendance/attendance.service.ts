import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { getMongoDb } from '../../database/mongo';
import {
  listAssignmentsByOrganization,
  type BranchAssignment,
} from '../../organizations/branch-assignments.store';
import { WorkforceContextService } from '../workforce-context.service';
import { AttendanceBiometricsService } from './attendance-biometrics.service';
import { listBiometricCredentialsForUser } from './biometric-credentials.store';
import {
  createAttendanceEvent,
  findLatestAttendanceEvent,
  isClockedIn,
  listAttendanceEventsForBranchSince,
  listAttendanceEventsForOrganizationSince,
  listAttendanceEventsForUser,
  startOfLocalDay,
  type AttendanceEvent,
} from './attendance.store';
import { isAttendanceBiometricsRequired } from './webauthn.config';

function serializeEvent(event: AttendanceEvent) {
  return {
    id: event._id,
    type: event.type,
    recordedAt: event.recordedAt.toISOString(),
    branchId: event.branchId,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    verificationMethod: event.verificationMethod ?? null,
    biometricVerified: event.biometricVerified ?? false,
  };
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly workforce: WorkforceContextService,
    private readonly biometrics: AttendanceBiometricsService,
  ) {}

  async getMyStatus(request: Request) {
    const context = await this.workforce.requireEmployee(request);
    const latest = await findLatestAttendanceEvent(
      context.organizationId,
      context.userId,
    );

    const todayStart = startOfLocalDay();
    const todayEvents = (await listAttendanceEventsForUser(
      context.organizationId,
      context.userId,
      50,
    )).filter((event) => event.recordedAt >= todayStart);

    return {
      isClockedIn: isClockedIn(latest),
      lastEvent: latest ? serializeEvent(latest) : null,
      todayEvents: todayEvents.map(serializeEvent),
    };
  }

  async clockIn(
    request: Request,
    input: {
      latitude?: number;
      longitude?: number;
      biometricResponse?: AuthenticationResponseJSON;
    },
  ) {
    const context = await this.workforce.requireEmployee(request);
    const latest = await findLatestAttendanceEvent(
      context.organizationId,
      context.userId,
    );

    if (isClockedIn(latest)) {
      throw new BadRequestException('You are already clocked in.');
    }

    const verification = await this.resolveClockVerification(
      request,
      input.biometricResponse,
    );

    const event = await createAttendanceEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      branchId: context.branchId!,
      type: 'clock_in',
      latitude: input.latitude,
      longitude: input.longitude,
      verificationMethod: verification.verificationMethod,
      biometricVerified: verification.biometricVerified,
      credentialId: verification.credentialId,
    });

    return serializeEvent(event);
  }

  async clockOut(
    request: Request,
    input: {
      latitude?: number;
      longitude?: number;
      biometricResponse?: AuthenticationResponseJSON;
    },
  ) {
    const context = await this.workforce.requireEmployee(request);
    const latest = await findLatestAttendanceEvent(
      context.organizationId,
      context.userId,
    );

    if (!isClockedIn(latest)) {
      throw new BadRequestException('You are not clocked in.');
    }

    const verification = await this.resolveClockVerification(
      request,
      input.biometricResponse,
    );

    const event = await createAttendanceEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      branchId: context.branchId!,
      type: 'clock_out',
      latitude: input.latitude,
      longitude: input.longitude,
      verificationMethod: verification.verificationMethod,
      biometricVerified: verification.biometricVerified,
      credentialId: verification.credentialId,
    });

    return serializeEvent(event);
  }

  private async resolveClockVerification(
    request: Request,
    biometricResponse?: AuthenticationResponseJSON,
  ): Promise<{
    verificationMethod: 'webauthn' | 'none';
    biometricVerified: boolean;
    credentialId?: string;
  }> {
    const context = await this.workforce.requireEmployee(request);
    const credentials = await listBiometricCredentialsForUser(
      context.organizationId,
      context.userId,
    );
    const biometricsRequired =
      isAttendanceBiometricsRequired() && credentials.length > 0;

    if (biometricsRequired) {
      if (!biometricResponse) {
        throw new BadRequestException(
          'Biometric verification is required to clock in or out.',
        );
      }

      const verification = await this.biometrics.verifyAuthenticationForClock(
        request,
        biometricResponse,
      );

      return {
        verificationMethod: 'webauthn',
        biometricVerified: true,
        credentialId: verification.credentialId,
      };
    }

    if (biometricResponse) {
      const verification = await this.biometrics.verifyAuthenticationForClock(
        request,
        biometricResponse,
      );

      return {
        verificationMethod: 'webauthn',
        biometricVerified: true,
        credentialId: verification.credentialId,
      };
    }

    return {
      verificationMethod: 'none',
      biometricVerified: false,
    };
  }

  async getBranchOverview(request: Request, branchId?: string) {
    const context = await this.workforce.getMemberContext(request);

    if (!context.canViewBranchAttendance) {
      throw new ForbiddenException('HR or admin access required.');
    }

    const targetBranchId =
      branchId ??
      (context.isHr ? context.branchId : null) ??
      undefined;

    if (!targetBranchId && !context.isAdmin) {
      throw new BadRequestException('Branch is required.');
    }

    const since = startOfLocalDay();
    const db = await getMongoDb();
    const assignments = await listAssignmentsByOrganization(
      context.organizationId,
    );
    const branchAssignments = assignments.filter(
      (assignment: BranchAssignment) =>
        assignment.role === 'employee' &&
        (!targetBranchId || assignment.branchId === targetBranchId),
    );

    const events = targetBranchId
      ? await listAttendanceEventsForBranchSince(
          context.organizationId,
          targetBranchId,
          since,
        )
      : await listAttendanceEventsForOrganizationSince(
          context.organizationId,
          since,
        );

    type UserDoc = { _id: string; name?: string; email?: string };

    const users = await db
      .collection<UserDoc>('user')
      .find({
        _id: {
          $in: branchAssignments.map(
            (assignment: BranchAssignment) => assignment.userId,
          ),
        },
      })
      .toArray();

    const userMap = new Map(
      users.map((user: UserDoc) => [String(user._id), user]),
    );

    const latestByUser = new Map<string, AttendanceEvent>();

    for (const event of events) {
      const existing = latestByUser.get(event.userId);
      if (!existing || event.recordedAt > existing.recordedAt) {
        latestByUser.set(event.userId, event);
      }
    }

    return {
      branchId: targetBranchId ?? null,
      date: since.toISOString(),
      employees: branchAssignments.map((assignment: BranchAssignment) => {
        const user = userMap.get(String(assignment.userId));
        const latest = latestByUser.get(assignment.userId) ?? null;

        return {
          userId: assignment.userId,
          name: user?.name ?? 'Employee',
          email: user?.email ?? '',
          isClockedIn: isClockedIn(latest),
          lastEvent: latest ? serializeEvent(latest) : null,
        };
      }),
    };
  }
}

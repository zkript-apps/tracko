import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { getMongoDb } from '../../database/mongo';
import { isWorkforceStaffRole } from '../../auth/org-roles';
import {
  listAssignmentsByOrganization,
  type BranchAssignment,
} from '../../organizations/branch-assignments.store';
import {
  endOfLocalDay,
  listAttendanceEventsForBranchBetween,
  listAttendanceEventsForOrganizationBetween,
  listAttendanceEventsForUserBetween,
} from '../attendance/attendance.store';
import {
  findProfileByUserId,
  getProfileWorkSchedule,
  listProfilesByOrganization,
} from '../employees/employee-profiles.store';
import { DEFAULT_WORK_SCHEDULE } from '../employees/work-schedule.util';
import { WorkforceContextService } from '../workforce-context.service';
import {
  buildDailyRecords,
  defaultDtrRange,
  validateDateRange,
} from './dtr.util';

function parseRangeStart(startDate: string): Date {
  return new Date(`${startDate}T00:00:00`);
}

function parseRangeEnd(endDate: string): Date {
  return endOfLocalDay(new Date(`${endDate}T00:00:00`));
}

@Injectable()
export class DtrService {
  constructor(private readonly workforce: WorkforceContextService) {}

  async getMyRecords(
    request: Request,
    startDate?: string,
    endDate?: string,
  ) {
    const context = await this.workforce.requireEmployee(request);
    const range = startDate && endDate
      ? { startDate, endDate }
      : defaultDtrRange();

    try {
      validateDateRange(range.startDate, range.endDate);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid date range.',
      );
    }

    const events = await listAttendanceEventsForUserBetween(
      context.organizationId,
      context.userId,
      parseRangeStart(range.startDate),
      parseRangeEnd(range.endDate),
    );

    const profile = await findProfileByUserId(
      context.organizationId,
      context.userId,
    );
    const schedule = profile
      ? getProfileWorkSchedule(profile)
      : DEFAULT_WORK_SCHEDULE;

    return {
      startDate: range.startDate,
      endDate: range.endDate,
      records: buildDailyRecords(
        events,
        range.startDate,
        range.endDate,
        schedule,
      ),
    };
  }

  async getOverview(
    request: Request,
    input: {
      startDate?: string;
      endDate?: string;
      branchId?: string;
      userId?: string;
    },
  ) {
    const context = await this.workforce.getMemberContext(request);

    if (!context.canViewBranchAttendance) {
      throw new ForbiddenException('HR or admin access required.');
    }

    const range = input.startDate && input.endDate
      ? { startDate: input.startDate, endDate: input.endDate }
      : defaultDtrRange();

    try {
      validateDateRange(range.startDate, range.endDate);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid date range.',
      );
    }

    const targetBranchId =
      input.branchId ??
      (context.isHr ? context.branchId : null) ??
      undefined;

    if (!targetBranchId && !context.isAdmin) {
      throw new BadRequestException('Branch is required.');
    }

    const db = await getMongoDb();
    const assignments = await listAssignmentsByOrganization(
      context.organizationId,
    );

    let branchAssignments = assignments.filter(
      (assignment: BranchAssignment) =>
        isWorkforceStaffRole(assignment.role) &&
        (!targetBranchId || assignment.branchId === targetBranchId),
    );

    if (input.userId) {
      branchAssignments = branchAssignments.filter(
        (assignment: BranchAssignment) => assignment.userId === input.userId,
      );
    }

    const events = targetBranchId
      ? await listAttendanceEventsForBranchBetween(
          context.organizationId,
          targetBranchId,
          parseRangeStart(range.startDate),
          parseRangeEnd(range.endDate),
        )
      : await listAttendanceEventsForOrganizationBetween(
          context.organizationId,
          parseRangeStart(range.startDate),
          parseRangeEnd(range.endDate),
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

    const eventsByUser = new Map<string, typeof events>();

    for (const event of events) {
      const bucket = eventsByUser.get(event.userId) ?? [];
      bucket.push(event);
      eventsByUser.set(event.userId, bucket);
    }

    const profiles = await listProfilesByOrganization(
      context.organizationId,
      targetBranchId,
    );
    const scheduleByUser = new Map(
      profiles.map((profile) => [
        profile.userId,
        getProfileWorkSchedule(profile),
      ]),
    );

    return {
      startDate: range.startDate,
      endDate: range.endDate,
      branchId: targetBranchId ?? null,
      employees: branchAssignments.map((assignment: BranchAssignment) => {
        const user = userMap.get(String(assignment.userId));
        const userEvents = eventsByUser.get(assignment.userId) ?? [];

        return {
          userId: assignment.userId,
          name: user?.name ?? 'Employee',
          email: user?.email ?? '',
          records: buildDailyRecords(
            userEvents,
            range.startDate,
            range.endDate,
            scheduleByUser.get(assignment.userId) ?? DEFAULT_WORK_SCHEDULE,
          ),
        };
      }),
    };
  }
}

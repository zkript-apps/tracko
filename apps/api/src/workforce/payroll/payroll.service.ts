import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
} from '../attendance/attendance.store';
import {
  findProfileByUserId,
  getProfileWorkSchedule,
  listProfilesByOrganization,
} from '../employees/employee-profiles.store';
import { resolvePayRate } from '../employees/pay-rate.util';
import { DEFAULT_WORK_SCHEDULE } from '../employees/work-schedule.util';
import { buildDailyRecords, validateDateRange } from '../dtr/dtr.util';
import { listHolidaysForOrganization } from '../holidays/holidays.store';
import { listApprovedLeaveOverlappingPeriod } from '../leave/leave.store';
import { WorkforceContextService } from '../workforce-context.service';
import { BillingService } from '../../billing/billing.service';
import {
  createPayrollRun,
  finalizePayrollRun,
  findPayrollRunById,
  listPayrollRuns,
  serializePayrollRun,
} from './payroll.store';
import {
  buildApprovedLeaveDates,
  buildHolidayMap,
  computePayrollLineItem,
  computePayrollTotals,
} from './payroll.util';

function parseRangeStart(startDate: string): Date {
  return new Date(`${startDate}T00:00:00`);
}

function parseRangeEnd(endDate: string): Date {
  return endOfLocalDay(new Date(`${endDate}T00:00:00`));
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly workforce: WorkforceContextService,
    private readonly billing: BillingService,
  ) {}

  private async requirePayrollAccess(request: Request) {
    const context = await this.workforce.getMemberContext(request);

    if (!context.canViewBranchAttendance) {
      throw new ForbiddenException('HR or admin access required.');
    }

    await this.billing.requireFeature(
      context.organizationId,
      'payroll',
      'Payroll',
    );

    return context;
  }

  private resolveBranchId(
    context: Awaited<ReturnType<PayrollService['requirePayrollAccess']>>,
    branchId?: string,
  ) {
    const targetBranchId =
      branchId ?? (context.isHr ? context.branchId : null) ?? undefined;

    if (!targetBranchId && !context.isAdmin) {
      throw new BadRequestException('Branch is required.');
    }

    return targetBranchId ?? null;
  }

  private async buildPayrollPreview(input: {
    organizationId: string;
    startDate: string;
    endDate: string;
    branchId: string | null;
  }) {
    const db = await getMongoDb();
    const assignments = await listAssignmentsByOrganization(
      input.organizationId,
    );
    const branchAssignments = assignments.filter(
      (assignment: BranchAssignment) =>
        isWorkforceStaffRole(assignment.role) &&
        (!input.branchId || assignment.branchId === input.branchId),
    );

    const events = input.branchId
      ? await listAttendanceEventsForBranchBetween(
          input.organizationId,
          input.branchId,
          parseRangeStart(input.startDate),
          parseRangeEnd(input.endDate),
        )
      : await listAttendanceEventsForOrganizationBetween(
          input.organizationId,
          parseRangeStart(input.startDate),
          parseRangeEnd(input.endDate),
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
      input.organizationId,
      input.branchId ?? undefined,
    );
    const profileByUser = new Map(
      profiles.map((profile) => [profile.userId, profile]),
    );

    const leaveRequests = await listApprovedLeaveOverlappingPeriod({
      organizationId: input.organizationId,
      startDate: input.startDate,
      endDate: input.endDate,
      branchId: input.branchId ?? undefined,
    });
    const leaveByUser = new Map<string, typeof leaveRequests>();
    for (const leaveRequest of leaveRequests) {
      const bucket = leaveByUser.get(leaveRequest.userId) ?? [];
      bucket.push(leaveRequest);
      leaveByUser.set(leaveRequest.userId, bucket);
    }

    const holidays = await listHolidaysForOrganization({
      organizationId: input.organizationId,
      startDate: input.startDate,
      endDate: input.endDate,
      branchId: input.branchId ?? undefined,
    });

    const entries = branchAssignments.map((assignment: BranchAssignment) => {
      const user = userMap.get(String(assignment.userId));
      const profile = profileByUser.get(assignment.userId);
      const schedule = profile
        ? getProfileWorkSchedule(profile)
        : DEFAULT_WORK_SCHEDULE;
      const records = buildDailyRecords(
        eventsByUser.get(assignment.userId) ?? [],
        input.startDate,
        input.endDate,
        schedule,
      );
      const leaveDates = buildApprovedLeaveDates(
        leaveByUser.get(assignment.userId) ?? [],
        input.startDate,
        input.endDate,
        schedule,
      );
      const holidayMap = buildHolidayMap(holidays, assignment.branchId);

      return computePayrollLineItem({
        userId: assignment.userId,
        name: user?.name ?? 'Employee',
        email: user?.email ?? '',
        payRate: profile ? resolvePayRate(profile) : null,
        records,
        schedule,
        paidLeaveDates: leaveDates.paid,
        unpaidLeaveDates: leaveDates.unpaid,
        holidays: holidayMap,
      });
    });

    return {
      startDate: input.startDate,
      endDate: input.endDate,
      branchId: input.branchId,
      entries,
      totals: computePayrollTotals(entries),
    };
  }

  async preview(
    request: Request,
    input: {
      startDate?: string;
      endDate?: string;
      branchId?: string;
    },
  ) {
    const context = await this.requirePayrollAccess(request);

    if (!input.startDate || !input.endDate) {
      throw new BadRequestException('Start and end dates are required.');
    }

    try {
      validateDateRange(input.startDate, input.endDate);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid date range.',
      );
    }

    const branchId = this.resolveBranchId(context, input.branchId);

    return this.buildPayrollPreview({
      organizationId: context.organizationId,
      startDate: input.startDate,
      endDate: input.endDate,
      branchId,
    });
  }

  async listRuns(request: Request) {
    const context = await this.requirePayrollAccess(request);
    const runs = await listPayrollRuns(context.organizationId);
    return {
      runs: runs.map(serializePayrollRun),
    };
  }

  async getRun(request: Request, id: string) {
    const context = await this.requirePayrollAccess(request);
    const run = await findPayrollRunById(context.organizationId, id);

    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }

    return serializePayrollRun(run);
  }

  async createRun(
    request: Request,
    input: {
      startDate: string;
      endDate: string;
      branchId?: string;
    },
  ) {
    const context = await this.requirePayrollAccess(request);

    try {
      validateDateRange(input.startDate, input.endDate);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid date range.',
      );
    }

    const branchId = this.resolveBranchId(context, input.branchId);
    const preview = await this.buildPayrollPreview({
      organizationId: context.organizationId,
      startDate: input.startDate,
      endDate: input.endDate,
      branchId,
    });

    const run = await createPayrollRun({
      organizationId: context.organizationId,
      branchId,
      periodStart: preview.startDate,
      periodEnd: preview.endDate,
      entries: preview.entries,
      totals: preview.totals,
      createdBy: context.userId,
    });

    return serializePayrollRun(run);
  }

  async finalizeRun(request: Request, id: string) {
    const context = await this.requirePayrollAccess(request);
    const updated = await finalizePayrollRun({
      organizationId: context.organizationId,
      id,
      finalizedBy: context.userId,
    });

    if (!updated) {
      throw new NotFoundException('Draft payroll run not found.');
    }

    return serializePayrollRun(updated);
  }
}

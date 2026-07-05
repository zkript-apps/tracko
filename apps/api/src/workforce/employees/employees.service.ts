import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getMongoDb } from '../../database/mongo';
import {
  findAssignmentByUserId,
  listAssignmentsByOrganization,
} from '../../organizations/branch-assignments.store';
import { WorkforceContextService } from '../workforce-context.service';
import {
  createEmployeeProfile,
  EMPLOYMENT_TYPES,
  findProfileByUserId,
  serializeEmployeeProfile,
  updateEmployeeProfile,
  type EmploymentType,
} from './employee-profiles.store';
import {
  BALANCE_LEAVE_TYPES,
  ensureBalancesForUser,
  serializeLeaveBalance,
  setEntitledDays,
  type BalanceLeaveType,
} from './leave-balances.store';
import { isValidDateString, todayDateString, countLeaveDays } from './leave-days.util';
import {
  listLeaveRequestsForUser,
  type LeaveRequest as LeaveRequestRecord,
} from '../leave/leave.store';

function serializeLeaveHistoryItem(request: LeaveRequestRecord) {
  return {
    id: request._id,
    leaveType: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    status: request.status,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewNote: request.reviewNote ?? null,
    createdAt: request.createdAt.toISOString(),
    requestedDays: countLeaveDays(request.startDate, request.endDate),
  };
}

@Injectable()
export class EmployeesService {
  constructor(private readonly workforce: WorkforceContextService) {}

  private async requireManager(request: Request) {
    const context = await this.workforce.getMemberContext(request);

    if (!context.canManageLeave) {
      throw new ForbiddenException('HR or admin access required.');
    }

    return context;
  }

  private async loadUsers(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, { name?: string; email?: string }>();
    }

    const db = await getMongoDb();
    const users = await db
      .collection<{ _id: string; name?: string; email?: string }>('user')
      .find({ _id: { $in: userIds } })
      .toArray();

    return new Map(users.map((user) => [String(user._id), user]));
  }

  private async ensureEmployeeProfile(input: {
    organizationId: string;
    userId: string;
    memberId: string;
    branchId: string;
    updatedBy?: string;
  }) {
    const existing = await findProfileByUserId(
      input.organizationId,
      input.userId,
    );

    if (existing) {
      return existing;
    }

    const today = todayDateString();
    return createEmployeeProfile({
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      employmentType: 'probation',
      hireDate: today,
      contractStartDate: today,
      updatedBy: input.updatedBy,
    });
  }

  private assertEmployeeAccess(
    context: Awaited<ReturnType<WorkforceContextService['getMemberContext']>>,
    branchId: string,
  ) {
    if (context.isHr && context.branchId !== branchId) {
      throw new ForbiddenException('Employee is outside your branch.');
    }
  }

  private async buildEmployeeRecord(input: {
    organizationId: string;
    userId: string;
    memberId: string;
    branchId: string;
    periodYear: number;
    updatedBy?: string;
    userMap: Map<string, { name?: string; email?: string }>;
  }) {
    const profile = await this.ensureEmployeeProfile({
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      updatedBy: input.updatedBy,
    });

    const balances = await ensureBalancesForUser({
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      periodYear: input.periodYear,
    });

    const user = input.userMap.get(String(input.userId));

    return {
      userId: input.userId,
      memberId: input.memberId,
      name: user?.name ?? 'Employee',
      email: user?.email ?? '',
      branchId: input.branchId,
      profile: serializeEmployeeProfile(profile),
      leaveBalances: balances.map(serializeLeaveBalance),
    };
  }

  async listEmployees(request: Request, periodYear?: number) {
    const context = await this.requireManager(request);
    const branchId = context.isHr ? context.branchId ?? undefined : undefined;
    const year = periodYear ?? new Date().getFullYear();

    const assignments = await listAssignmentsByOrganization(
      context.organizationId,
    );
    const employeeAssignments = assignments.filter(
      (assignment) =>
        assignment.role === 'employee' &&
        (!branchId || assignment.branchId === branchId),
    );

    const userMap = await this.loadUsers(
      employeeAssignments.map((assignment) => assignment.userId),
    );

    const employees = await Promise.all(
      employeeAssignments.map((assignment) =>
        this.buildEmployeeRecord({
          organizationId: context.organizationId,
          userId: assignment.userId,
          memberId: assignment.memberId,
          branchId: assignment.branchId,
          periodYear: year,
          updatedBy: context.userId,
          userMap,
        }),
      ),
    );

    return { periodYear: year, employees };
  }

  async getEmployee(request: Request, userId: string, periodYear?: number) {
    const context = await this.requireManager(request);
    const year = periodYear ?? new Date().getFullYear();
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    const userMap = await this.loadUsers([userId]);
    const leaveHistory = await listLeaveRequestsForUser(
      context.organizationId,
      userId,
    );

    return {
      ...(await this.buildEmployeeRecord({
        organizationId: context.organizationId,
        userId,
        memberId: assignment.memberId,
        branchId: assignment.branchId,
        periodYear: year,
        updatedBy: context.userId,
        userMap,
      })),
      periodYear: year,
      leaveHistory: leaveHistory.map(serializeLeaveHistoryItem),
    };
  }

  async updateProfile(
    request: Request,
    userId: string,
    input: {
      employmentType?: EmploymentType;
      jobTitle?: string;
      hireDate?: string;
      contractStartDate?: string;
      contractEndDate?: string | null;
      probationEndDate?: string | null;
      notes?: string | null;
    },
  ) {
    const context = await this.requireManager(request);
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    if (
      input.employmentType &&
      !EMPLOYMENT_TYPES.includes(input.employmentType)
    ) {
      throw new BadRequestException('Invalid employment type.');
    }

    for (const field of [
      input.hireDate,
      input.contractStartDate,
      input.contractEndDate ?? undefined,
      input.probationEndDate ?? undefined,
    ]) {
      if (field && !isValidDateString(field)) {
        throw new BadRequestException('Dates must use YYYY-MM-DD format.');
      }
    }

    await this.ensureEmployeeProfile({
      organizationId: context.organizationId,
      userId,
      memberId: assignment.memberId,
      branchId: assignment.branchId,
      updatedBy: context.userId,
    });

    const updated = await updateEmployeeProfile({
      organizationId: context.organizationId,
      userId,
      ...input,
      branchId: assignment.branchId,
      updatedBy: context.userId,
    });

    if (!updated) {
      throw new NotFoundException('Employee profile not found.');
    }

    return serializeEmployeeProfile(updated);
  }

  async updateLeaveBalances(
    request: Request,
    userId: string,
    input: {
      periodYear?: number;
      balances: Array<{ leaveType: BalanceLeaveType; entitledDays: number }>;
    },
  ) {
    const context = await this.requireManager(request);
    const year = input.periodYear ?? new Date().getFullYear();
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    if (!input.balances.length) {
      throw new BadRequestException('At least one leave balance is required.');
    }

    const updatedBalances = [];

    for (const entry of input.balances) {
      if (!BALANCE_LEAVE_TYPES.includes(entry.leaveType)) {
        throw new BadRequestException('Invalid leave type for balance.');
      }

      if (entry.entitledDays < 0 || entry.entitledDays > 365) {
        throw new BadRequestException('Entitled days must be between 0 and 365.');
      }

      const balance = await setEntitledDays({
        organizationId: context.organizationId,
        userId,
        memberId: assignment.memberId,
        branchId: assignment.branchId,
        leaveType: entry.leaveType,
        periodYear: year,
        entitledDays: entry.entitledDays,
      });

      updatedBalances.push(serializeLeaveBalance(balance));
    }

    return { periodYear: year, leaveBalances: updatedBalances };
  }

  async getMyLeaveBalances(request: Request, periodYear?: number) {
    const context = await this.workforce.requireEmployee(request);
    const year = periodYear ?? new Date().getFullYear();

    await this.ensureEmployeeProfile({
      organizationId: context.organizationId,
      userId: context.userId,
      memberId: context.memberId,
      branchId: context.branchId!,
    });

    const balances = await ensureBalancesForUser({
      organizationId: context.organizationId,
      userId: context.userId,
      memberId: context.memberId,
      branchId: context.branchId!,
      periodYear: year,
    });

    return {
      periodYear: year,
      leaveBalances: balances.map(serializeLeaveBalance),
    };
  }
}

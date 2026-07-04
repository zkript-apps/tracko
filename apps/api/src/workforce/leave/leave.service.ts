import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getMongoDb } from '../../database/mongo';
import { WorkforceContextService } from '../workforce-context.service';
import {
  createLeaveRequest,
  findLeaveRequestById,
  LEAVE_TYPES,
  listLeaveRequestsForOrganization,
  listLeaveRequestsForUser,
  updateLeaveRequestStatus,
  type LeaveRequest,
  type LeaveType,
} from './leave.store';

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function serializeLeaveRequest(
  request: LeaveRequest,
  user?: { name?: string; email?: string },
) {
  return {
    id: request._id,
    leaveType: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    status: request.status,
    branchId: request.branchId,
    userId: request.userId,
    employeeName: user?.name ?? null,
    employeeEmail: user?.email ?? null,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewNote: request.reviewNote ?? null,
    createdAt: request.createdAt.toISOString(),
  };
}

@Injectable()
export class LeaveService {
  constructor(private readonly workforce: WorkforceContextService) {}

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

  async createRequest(
    request: Request,
    input: {
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      reason: string;
    },
  ) {
    const context = await this.workforce.requireEmployee(request);

    if (!LEAVE_TYPES.includes(input.leaveType)) {
      throw new BadRequestException('Invalid leave type.');
    }

    if (!isValidDateString(input.startDate) || !isValidDateString(input.endDate)) {
      throw new BadRequestException('Dates must use YYYY-MM-DD format.');
    }

    if (input.endDate < input.startDate) {
      throw new BadRequestException('End date must be on or after start date.');
    }

    if (!input.reason.trim()) {
      throw new BadRequestException('Reason is required.');
    }

    const leaveRequest = await createLeaveRequest({
      organizationId: context.organizationId,
      userId: context.userId,
      branchId: context.branchId!,
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
    });

    return serializeLeaveRequest(leaveRequest);
  }

  async listMyRequests(request: Request) {
    const context = await this.workforce.requireEmployee(request);
    const requests = await listLeaveRequestsForUser(
      context.organizationId,
      context.userId,
    );

    return requests.map((item) => serializeLeaveRequest(item));
  }

  async listManagedRequests(request: Request, status?: string) {
    const context = await this.workforce.requireLeaveManager(request);
    const branchId = context.isHr ? context.branchId ?? undefined : undefined;

    const requests = await listLeaveRequestsForOrganization({
      organizationId: context.organizationId,
      branchId,
      status:
        status === 'pending' ||
        status === 'approved' ||
        status === 'rejected' ||
        status === 'canceled'
          ? status
          : undefined,
    });

    const userMap = await this.loadUsers(requests.map((item) => item.userId));

    return requests.map((item) =>
      serializeLeaveRequest(
        item,
        userMap.get(String(item.userId)) ?? undefined,
      ),
    );
  }

  async reviewRequest(
    request: Request,
    id: string,
    action: 'approve' | 'reject',
    reviewNote?: string,
  ) {
    const context = await this.workforce.requireLeaveManager(request);
    const leaveRequest = await findLeaveRequestById(id);

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found.');
    }

    if (String(leaveRequest.organizationId) !== String(context.organizationId)) {
      throw new ForbiddenException('Leave request not in your organization.');
    }

    if (context.isHr && leaveRequest.branchId !== context.branchId) {
      throw new ForbiddenException('Leave request is outside your branch.');
    }

    if (leaveRequest.status !== 'pending') {
      throw new BadRequestException('This leave request was already reviewed.');
    }

    const updated = await updateLeaveRequestStatus({
      id,
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedBy: context.userId,
      reviewNote,
    });

    if (!updated) {
      throw new NotFoundException('Leave request not found.');
    }

    return serializeLeaveRequest(updated);
  }

  async cancelMyRequest(request: Request, id: string) {
    const context = await this.workforce.requireEmployee(request);
    const leaveRequest = await findLeaveRequestById(id);

    if (!leaveRequest || leaveRequest.userId !== context.userId) {
      throw new NotFoundException('Leave request not found.');
    }

    if (leaveRequest.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be canceled.');
    }

    const updated = await updateLeaveRequestStatus({
      id,
      status: 'canceled',
      reviewedBy: context.userId,
    });

    if (!updated) {
      throw new NotFoundException('Leave request not found.');
    }

    return serializeLeaveRequest(updated);
  }
}

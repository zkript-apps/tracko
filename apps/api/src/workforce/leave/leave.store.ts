import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';

export const LEAVE_TYPES = [
  'vacation',
  'sick',
  'emergency',
  'unpaid',
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'canceled',
] as const;

export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export interface LeaveRequest {
  _id: string;
  organizationId: string;
  userId: string;
  branchId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
}

const COLLECTION = 'leave_requests';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<LeaveRequest>(COLLECTION);
}

export async function createLeaveRequest(input: {
  organizationId: string;
  userId: string;
  branchId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<LeaveRequest> {
  const collection = await getCollection();
  const request: LeaveRequest = {
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    branchId: input.branchId,
    leaveType: input.leaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason.trim(),
    status: 'pending',
    createdAt: new Date(),
  };

  await collection.insertOne(request);
  return request;
}

export async function findLeaveRequestById(
  id: string,
): Promise<LeaveRequest | null> {
  const collection = await getCollection();
  return collection.findOne({ _id: id });
}

export async function listLeaveRequestsForUser(
  organizationId: string,
  userId: string,
): Promise<LeaveRequest[]> {
  const collection = await getCollection();
  return collection
    .find({ organizationId, userId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function listLeaveRequestsForOrganization(input: {
  organizationId: string;
  branchId?: string;
  status?: LeaveStatus;
}): Promise<LeaveRequest[]> {
  const collection = await getCollection();
  const filter: Record<string, unknown> = {
    organizationId: input.organizationId,
  };

  if (input.branchId) {
    filter.branchId = input.branchId;
  }

  if (input.status) {
    filter.status = input.status;
  }

  return collection.find(filter).sort({ createdAt: -1 }).toArray();
}

export async function updateLeaveRequestStatus(input: {
  id: string;
  status: LeaveStatus;
  reviewedBy: string;
  reviewNote?: string;
}): Promise<LeaveRequest | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { _id: input.id },
    {
      $set: {
        status: input.status,
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() || undefined,
      },
    },
    { returnDocument: 'after' },
  );

  return result ?? null;
}

import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';
import type { LeaveType } from '../leave/leave.store';

export const BALANCE_LEAVE_TYPES = [
  'vacation',
  'sick',
  'emergency',
] as const;

export type BalanceLeaveType = (typeof BALANCE_LEAVE_TYPES)[number];

export function isBalanceLeaveType(
  leaveType: LeaveType,
): leaveType is BalanceLeaveType {
  return BALANCE_LEAVE_TYPES.includes(leaveType as BalanceLeaveType);
}

export interface LeaveBalance {
  _id: string;
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  leaveType: BalanceLeaveType;
  periodYear: number;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'leave_balances';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<LeaveBalance>(COLLECTION);
}

export async function findBalance(
  organizationId: string,
  userId: string,
  leaveType: BalanceLeaveType,
  periodYear: number,
): Promise<LeaveBalance | null> {
  const collection = await getCollection();
  return collection.findOne({
    organizationId: String(organizationId),
    userId: String(userId),
    leaveType,
    periodYear,
  });
}

export async function listBalancesForUser(
  organizationId: string,
  userId: string,
  periodYear?: number,
): Promise<LeaveBalance[]> {
  const collection = await getCollection();
  const filter: Record<string, string | number> = {
    organizationId: String(organizationId),
    userId: String(userId),
  };

  if (periodYear !== undefined) {
    filter.periodYear = periodYear;
  }

  return collection.find(filter).sort({ leaveType: 1 }).toArray();
}

export async function ensureBalancesForUser(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  periodYear: number;
}): Promise<LeaveBalance[]> {
  const existing = await listBalancesForUser(
    input.organizationId,
    input.userId,
    input.periodYear,
  );
  const existingTypes = new Set(existing.map((balance) => balance.leaveType));
  const collection = await getCollection();
  const now = new Date();

  for (const leaveType of BALANCE_LEAVE_TYPES) {
    if (existingTypes.has(leaveType)) {
      continue;
    }

    const balance: LeaveBalance = {
      _id: createId(),
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      leaveType,
      periodYear: input.periodYear,
      entitledDays: 0,
      usedDays: 0,
      pendingDays: 0,
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(balance);
    existing.push(balance);
  }

  return existing.sort((a, b) => a.leaveType.localeCompare(b.leaveType));
}

export async function setEntitledDays(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  leaveType: BalanceLeaveType;
  periodYear: number;
  entitledDays: number;
}): Promise<LeaveBalance> {
  const collection = await getCollection();
  const now = new Date();
  const existing = await findBalance(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodYear,
  );

  if (existing) {
    const result = await collection.findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          entitledDays: input.entitledDays,
          branchId: input.branchId,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new Error('Unable to update leave balance.');
    }

    return result;
  }

  const balance: LeaveBalance = {
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    leaveType: input.leaveType,
    periodYear: input.periodYear,
    entitledDays: input.entitledDays,
    usedDays: 0,
    pendingDays: 0,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(balance);
  return balance;
}

export function availableDays(balance: LeaveBalance): number {
  return balance.entitledDays - balance.usedDays - balance.pendingDays;
}

export async function reservePendingDays(input: {
  organizationId: string;
  userId: string;
  leaveType: BalanceLeaveType;
  periodYear: number;
  days: number;
}): Promise<LeaveBalance> {
  const balance = await findBalance(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodYear,
  );

  if (!balance) {
    throw new Error('Leave balance not configured for this leave type.');
  }

  if (availableDays(balance) < input.days) {
    throw new Error('Insufficient leave balance.');
  }

  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { _id: balance._id },
    {
      $inc: { pendingDays: input.days },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' },
  );

  if (!result) {
    throw new Error('Unable to reserve leave days.');
  }

  return result;
}

export async function releasePendingDays(input: {
  organizationId: string;
  userId: string;
  leaveType: BalanceLeaveType;
  periodYear: number;
  days: number;
}): Promise<void> {
  const balance = await findBalance(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodYear,
  );

  if (!balance) {
    return;
  }

  const collection = await getCollection();
  await collection.updateOne(
    { _id: balance._id },
    {
      $inc: { pendingDays: -input.days },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function confirmApprovedDays(input: {
  organizationId: string;
  userId: string;
  leaveType: BalanceLeaveType;
  periodYear: number;
  days: number;
}): Promise<void> {
  const balance = await findBalance(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodYear,
  );

  if (!balance) {
    return;
  }

  const collection = await getCollection();
  await collection.updateOne(
    { _id: balance._id },
    {
      $inc: { pendingDays: -input.days, usedDays: input.days },
      $set: { updatedAt: new Date() },
    },
  );
}

export function serializeLeaveBalance(balance: LeaveBalance) {
  return {
    leaveType: balance.leaveType,
    periodYear: balance.periodYear,
    entitledDays: balance.entitledDays,
    usedDays: balance.usedDays,
    pendingDays: balance.pendingDays,
    availableDays: availableDays(balance),
  };
}

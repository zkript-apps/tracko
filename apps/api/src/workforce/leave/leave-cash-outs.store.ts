import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';
import type { BalanceLeaveType } from '../employees/leave-balances.store';

export type LeaveCashOutReason = 'sil_unused' | 'conversion';

export interface LeaveCashOut {
  _id: string;
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  periodKey: string;
  leaveType: BalanceLeaveType;
  days: number;
  reason: LeaveCashOutReason;
  createdAt: Date;
}

export interface LeavePeriodClosure {
  _id: string;
  organizationId: string;
  userId: string;
  periodKey: string;
  closedAt: Date;
}

const CASH_OUT_COLLECTION = 'leave_cash_outs';
const CLOSURE_COLLECTION = 'leave_period_closures';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCashOutCollection() {
  const db = await getMongoDb();
  return db.collection<LeaveCashOut>(CASH_OUT_COLLECTION);
}

async function getClosureCollection() {
  const db = await getMongoDb();
  return db.collection<LeavePeriodClosure>(CLOSURE_COLLECTION);
}

export async function createLeaveCashOut(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  periodKey: string;
  leaveType: BalanceLeaveType;
  days: number;
  reason: LeaveCashOutReason;
}): Promise<LeaveCashOut> {
  const collection = await getCashOutCollection();
  const record: LeaveCashOut = {
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    periodKey: input.periodKey,
    leaveType: input.leaveType,
    days: input.days,
    reason: input.reason,
    createdAt: new Date(),
  };

  await collection.insertOne(record);
  return record;
}

export async function listLeaveCashOutsForPeriod(input: {
  organizationId: string;
  userId: string;
  periodKey: string;
}): Promise<LeaveCashOut[]> {
  const collection = await getCashOutCollection();
  return collection
    .find({
      organizationId: input.organizationId,
      userId: input.userId,
      periodKey: input.periodKey,
    })
    .sort({ createdAt: 1 })
    .toArray();
}

export async function hasPeriodBeenClosed(input: {
  organizationId: string;
  userId: string;
  periodKey: string;
}): Promise<boolean> {
  const collection = await getClosureCollection();
  const existing = await collection.findOne({
    organizationId: input.organizationId,
    userId: input.userId,
    periodKey: input.periodKey,
  });

  return Boolean(existing);
}

export async function markLeavePeriodClosed(input: {
  organizationId: string;
  userId: string;
  periodKey: string;
}): Promise<void> {
  const collection = await getClosureCollection();
  const existing = await collection.findOne({
    organizationId: input.organizationId,
    userId: input.userId,
    periodKey: input.periodKey,
  });

  if (existing) {
    return;
  }

  await collection.insertOne({
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    periodKey: input.periodKey,
    closedAt: new Date(),
  });
}

export function serializeLeaveCashOut(record: LeaveCashOut) {
  return {
    id: record._id,
    periodKey: record.periodKey,
    leaveType: record.leaveType,
    days: record.days,
    reason: record.reason,
    createdAt: record.createdAt.toISOString(),
  };
}

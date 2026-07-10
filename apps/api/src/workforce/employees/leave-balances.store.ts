import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';
import type { LeaveType } from '../leave/leave.store';
import type { LeaveConversionTarget } from '../leave/leave-policy.types';
import { computeEffectiveEntitlement } from '../leave/leave-entitlement.util';
import type { LeavePolicyInput } from '../leave/leave-policy.types';
import { todayDateString } from './leave-days.util';

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
  periodKey: string;
  periodYear: number;
  periodStart?: string;
  periodEnd?: string;
  companyEntitledDays: number;
  carriedOverDays: number;
  silFloorDays: number;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
  periodClosed?: boolean;
  forfeitedDays?: number;
  convertedDays?: number;
  conversionTarget?: LeaveConversionTarget;
  periodAutoGrantApplied?: boolean;
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

function legacyPeriodKey(periodYear: number): string {
  return String(periodYear);
}

function normalizeBalance(balance: LeaveBalance): LeaveBalance {
  const periodKey = balance.periodKey ?? legacyPeriodKey(balance.periodYear);
  const companyEntitledDays =
    balance.companyEntitledDays ?? balance.entitledDays ?? 0;
  const carriedOverDays = balance.carriedOverDays ?? 0;
  const silFloorDays = balance.silFloorDays ?? 0;

  return {
    ...balance,
    periodKey,
    companyEntitledDays,
    carriedOverDays,
    silFloorDays,
    entitledDays: balance.entitledDays ?? companyEntitledDays + carriedOverDays,
  };
}

export async function findBalanceByPeriodKey(
  organizationId: string,
  userId: string,
  leaveType: BalanceLeaveType,
  periodKey: string,
): Promise<LeaveBalance | null> {
  const collection = await getCollection();
  const balance =
    (await collection.findOne({
      organizationId: String(organizationId),
      userId: String(userId),
      leaveType,
      periodKey,
    })) ??
    (/^\d{4}$/.test(periodKey)
      ? await collection.findOne({
          organizationId: String(organizationId),
          userId: String(userId),
          leaveType,
          periodYear: Number(periodKey),
          periodKey: { $exists: false },
        })
      : null);

  return balance ? normalizeBalance(balance) : null;
}

export async function findBalance(
  organizationId: string,
  userId: string,
  leaveType: BalanceLeaveType,
  periodYear: number,
): Promise<LeaveBalance | null> {
  const collection = await getCollection();
  const balance =
    (await collection.findOne({
      organizationId: String(organizationId),
      userId: String(userId),
      leaveType,
      periodKey: legacyPeriodKey(periodYear),
    })) ??
    (await collection.findOne({
      organizationId: String(organizationId),
      userId: String(userId),
      leaveType,
      periodYear,
      periodKey: { $exists: false },
    }));

  return balance ? normalizeBalance(balance) : null;
}

export async function listBalancesForUser(
  organizationId: string,
  userId: string,
  periodKey?: string,
): Promise<LeaveBalance[]> {
  const collection = await getCollection();
  const filter: Record<string, string | number> = {
    organizationId: String(organizationId),
    userId: String(userId),
  };

  if (periodKey !== undefined) {
    filter.periodKey = periodKey;
  }

  const balances = await collection.find(filter).sort({ leaveType: 1 }).toArray();
  return balances.map(normalizeBalance);
}

export async function ensureBalancesForUser(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  periodKey: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  policy: LeavePolicyInput;
  hireDate?: string;
}): Promise<LeaveBalance[]> {
  const existing = await listBalancesForUser(
    input.organizationId,
    input.userId,
    input.periodKey,
  );
  const existingTypes = new Set(existing.map((balance) => balance.leaveType));
  const collection = await getCollection();
  const now = new Date();

  for (const leaveType of BALANCE_LEAVE_TYPES) {
    if (existingTypes.has(leaveType)) {
      continue;
    }

    const { entitledDays, silFloorDays } = computeEffectiveEntitlement({
      companyEntitledDays: 0,
      carriedOverDays: 0,
      leaveType,
      policy: input.policy,
      hireDate: input.hireDate,
      asOfDate: todayDateString(),
    });

    const balance: LeaveBalance = {
      _id: createId(),
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      leaveType,
      periodKey: input.periodKey,
      periodYear: input.periodYear,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      companyEntitledDays: 0,
      carriedOverDays: 0,
      silFloorDays,
      entitledDays,
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

export async function setBalanceEntitlement(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  leaveType: BalanceLeaveType;
  periodKey: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  companyEntitledDays: number;
  carriedOverDays: number;
  entitledDays: number;
  silFloorDays: number;
  usedDays: number;
  pendingDays: number;
  periodAutoGrantApplied?: boolean;
}): Promise<LeaveBalance> {
  const collection = await getCollection();
  const now = new Date();
  const existing = await findBalanceByPeriodKey(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodKey,
  );

  if (existing) {
    const result = await collection.findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          branchId: input.branchId,
          periodYear: input.periodYear,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          companyEntitledDays: input.companyEntitledDays,
          carriedOverDays: input.carriedOverDays,
          silFloorDays: input.silFloorDays,
          entitledDays: input.entitledDays,
          usedDays: input.usedDays,
          pendingDays: input.pendingDays,
          periodAutoGrantApplied: input.periodAutoGrantApplied ?? false,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new Error('Unable to update leave balance.');
    }

    return normalizeBalance(result);
  }

  const balance: LeaveBalance = {
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    leaveType: input.leaveType,
    periodKey: input.periodKey,
    periodYear: input.periodYear,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    companyEntitledDays: input.companyEntitledDays,
    carriedOverDays: input.carriedOverDays,
    silFloorDays: input.silFloorDays,
    entitledDays: input.entitledDays,
    usedDays: input.usedDays,
    pendingDays: input.pendingDays,
    periodAutoGrantApplied: input.periodAutoGrantApplied ?? false,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(balance);
  return balance;
}

export async function upsertBalanceFromRollover(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  leaveType: BalanceLeaveType;
  periodKey: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  companyEntitledDays: number;
  carriedOverDays: number;
  policy: LeavePolicyInput;
  hireDate?: string;
}): Promise<LeaveBalance> {
  const existing = await findBalanceByPeriodKey(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodKey,
  );
  const { entitledDays, silFloorDays } = computeEffectiveEntitlement({
    companyEntitledDays: input.companyEntitledDays,
    carriedOverDays: input.carriedOverDays,
    leaveType: input.leaveType,
    policy: input.policy,
    hireDate: input.hireDate,
    asOfDate: todayDateString(),
  });

  return setBalanceEntitlement({
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    leaveType: input.leaveType,
    periodKey: input.periodKey,
    periodYear: input.periodYear,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    companyEntitledDays: input.companyEntitledDays,
    carriedOverDays: input.carriedOverDays,
    entitledDays,
    silFloorDays,
    usedDays: existing?.usedDays ?? 0,
    pendingDays: existing?.pendingDays ?? 0,
  });
}

export async function setEntitledDays(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  leaveType: BalanceLeaveType;
  periodKey: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  companyEntitledDays: number;
  policy: LeavePolicyInput;
  hireDate?: string;
}): Promise<LeaveBalance> {
  return applyEntitlementUpdate(input);
}

async function applyEntitlementUpdate(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  leaveType: BalanceLeaveType;
  periodKey: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  companyEntitledDays: number;
  policy: LeavePolicyInput;
  hireDate?: string;
}): Promise<LeaveBalance> {
  const existing = await findBalanceByPeriodKey(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodKey,
  );
  const carriedOverDays = existing?.carriedOverDays ?? 0;
  const { entitledDays, silFloorDays } = computeEffectiveEntitlement({
    companyEntitledDays: input.companyEntitledDays,
    carriedOverDays,
    leaveType: input.leaveType,
    policy: input.policy,
    hireDate: input.hireDate,
    asOfDate: todayDateString(),
  });

  return setBalanceEntitlement({
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    leaveType: input.leaveType,
    periodKey: input.periodKey,
    periodYear: input.periodYear,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    companyEntitledDays: input.companyEntitledDays,
    carriedOverDays,
    entitledDays,
    silFloorDays,
    usedDays: existing?.usedDays ?? 0,
    pendingDays: existing?.pendingDays ?? 0,
  });
}

export async function markPeriodClosed(
  balanceId: string,
  input: {
    forfeitedDays: number;
    convertedDays: number;
    conversionTarget?: LeaveConversionTarget;
  },
): Promise<void> {
  const collection = await getCollection();
  await collection.updateOne(
    { _id: balanceId },
    {
      $set: {
        periodClosed: true,
        forfeitedDays: input.forfeitedDays,
        convertedDays: input.convertedDays,
        conversionTarget: input.conversionTarget,
        updatedAt: new Date(),
      },
    },
  );
}

export function availableDays(balance: LeaveBalance): number {
  return balance.entitledDays - balance.usedDays - balance.pendingDays;
}

export async function reservePendingDays(input: {
  organizationId: string;
  userId: string;
  leaveType: BalanceLeaveType;
  periodKey: string;
  days: number;
}): Promise<LeaveBalance> {
  const balance = await findBalanceByPeriodKey(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodKey,
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

  return normalizeBalance(result);
}

export async function releasePendingDays(input: {
  organizationId: string;
  userId: string;
  leaveType: BalanceLeaveType;
  periodKey: string;
  days: number;
}): Promise<void> {
  const balance = await findBalanceByPeriodKey(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodKey,
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
  periodKey: string;
  days: number;
}): Promise<void> {
  const balance = await findBalanceByPeriodKey(
    input.organizationId,
    input.userId,
    input.leaveType,
    input.periodKey,
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
  const normalized = normalizeBalance(balance);

  return {
    leaveType: normalized.leaveType,
    periodKey: normalized.periodKey,
    periodYear: normalized.periodYear,
    periodStart: normalized.periodStart ?? null,
    periodEnd: normalized.periodEnd ?? null,
    companyEntitledDays: normalized.companyEntitledDays,
    carriedOverDays: normalized.carriedOverDays,
    silFloorDays: normalized.silFloorDays,
    entitledDays: normalized.entitledDays,
    usedDays: normalized.usedDays,
    pendingDays: normalized.pendingDays,
    availableDays: availableDays(normalized),
    periodClosed: normalized.periodClosed ?? false,
    forfeitedDays: normalized.forfeitedDays ?? 0,
    convertedDays: normalized.convertedDays ?? 0,
    conversionTarget: normalized.conversionTarget ?? null,
  };
}

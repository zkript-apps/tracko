import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';
import {
  DEFAULT_LEAVE_POLICY,
  type LeavePolicy,
  type LeavePolicyInput,
} from './leave-policy.types';

const COLLECTION = 'leave_policies';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<LeavePolicy>(COLLECTION);
}

export async function findLeavePolicy(
  organizationId: string,
): Promise<LeavePolicy | null> {
  const collection = await getCollection();
  return collection.findOne({ organizationId: String(organizationId) });
}

export async function ensureLeavePolicy(
  organizationId: string,
): Promise<LeavePolicy> {
  const existing = await findLeavePolicy(organizationId);

  if (existing) {
    return existing;
  }

  const collection = await getCollection();
  const now = new Date();
  const policy: LeavePolicy = {
    _id: createId(),
    organizationId: String(organizationId),
    ...DEFAULT_LEAVE_POLICY,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(policy);
  return policy;
}

export async function upsertLeavePolicy(
  organizationId: string,
  input: LeavePolicyInput,
): Promise<LeavePolicy> {
  const collection = await getCollection();
  const now = new Date();
  const existing = await findLeavePolicy(organizationId);

  if (existing) {
    const result = await collection.findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          resetType: input.resetType,
          fiscalYearStartMonth: input.fiscalYearStartMonth,
          silSafeguard: input.silSafeguard,
          vacation: input.vacation,
          sick: input.sick,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new Error('Unable to update leave policy.');
    }

    return result;
  }

  const policy: LeavePolicy = {
    _id: createId(),
    organizationId: String(organizationId),
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(policy);
  return policy;
}

export function serializeLeavePolicy(policy: LeavePolicy) {
  return {
    resetType: policy.resetType,
    fiscalYearStartMonth: policy.fiscalYearStartMonth,
    silSafeguard: policy.silSafeguard,
    vacation: policy.vacation,
    sick: policy.sick,
    updatedAt: policy.updatedAt.toISOString(),
  };
}

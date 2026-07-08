import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';
import type { PayrollLineItem, PayrollTotals } from './payroll.util';

export const PAYROLL_RUN_STATUSES = ['draft', 'finalized'] as const;
export type PayrollRunStatus = (typeof PAYROLL_RUN_STATUSES)[number];

export interface PayrollRun {
  _id: string;
  organizationId: string;
  branchId: string | null;
  periodStart: string;
  periodEnd: string;
  status: PayrollRunStatus;
  entries: PayrollLineItem[];
  totals: PayrollTotals;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt?: Date;
  finalizedBy?: string;
}

const COLLECTION = 'payroll_runs';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<PayrollRun>(COLLECTION);
}

export async function createPayrollRun(input: {
  organizationId: string;
  branchId: string | null;
  periodStart: string;
  periodEnd: string;
  entries: PayrollLineItem[];
  totals: PayrollTotals;
  createdBy: string;
}): Promise<PayrollRun> {
  const collection = await getCollection();
  const now = new Date();
  const run: PayrollRun = {
    _id: createId(),
    organizationId: input.organizationId,
    branchId: input.branchId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    status: 'draft',
    entries: input.entries,
    totals: input.totals,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(run);
  return run;
}

export async function findPayrollRunById(
  organizationId: string,
  id: string,
): Promise<PayrollRun | null> {
  const collection = await getCollection();
  return collection.findOne({
    _id: id,
    organizationId: String(organizationId),
  });
}

export async function listPayrollRuns(
  organizationId: string,
  limit = 20,
): Promise<PayrollRun[]> {
  const collection = await getCollection();
  return collection
    .find({ organizationId: String(organizationId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function finalizePayrollRun(input: {
  organizationId: string;
  id: string;
  finalizedBy: string;
}): Promise<PayrollRun | null> {
  const collection = await getCollection();
  const now = new Date();
  const result = await collection.findOneAndUpdate(
    {
      _id: input.id,
      organizationId: String(input.organizationId),
      status: 'draft',
    },
    {
      $set: {
        status: 'finalized',
        finalizedAt: now,
        finalizedBy: input.finalizedBy,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );

  return result ?? null;
}

export function serializePayrollRun(run: PayrollRun) {
  return {
    id: run._id,
    organizationId: run.organizationId,
    branchId: run.branchId,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    status: run.status,
    entries: run.entries,
    totals: run.totals,
    createdBy: run.createdBy,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    finalizedAt: run.finalizedAt?.toISOString() ?? null,
    finalizedBy: run.finalizedBy ?? null,
  };
}

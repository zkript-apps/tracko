import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';
import type { StatutoryHolidayType } from './holiday-type.util';

export const STATUTORY_HOLIDAY_TYPES = [
  'regular',
  'special_non_working',
] as const;

/** @deprecated Legacy custom pay rules — use holidayType instead. */
export const HOLIDAY_PAY_RULE_TYPES = [
  'fixed_per_hour',
  'multiplier',
  'percentage',
] as const;

export type HolidayPayRuleType = (typeof HOLIDAY_PAY_RULE_TYPES)[number];

/** @deprecated Legacy custom pay rules — use holidayType instead. */
export type HolidayPayRule = {
  type: HolidayPayRuleType;
  value: number;
};

export interface OrganizationHoliday {
  _id: string;
  organizationId: string;
  branchId: string | null;
  date: string;
  name: string;
  holidayType?: StatutoryHolidayType;
  /** @deprecated Legacy field kept for existing records. */
  payRule?: HolidayPayRule;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

const COLLECTION = 'organization_holidays';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<OrganizationHoliday>(COLLECTION);
}

export async function listHolidaysForOrganization(input: {
  organizationId: string;
  startDate: string;
  endDate: string;
  branchId?: string;
}): Promise<OrganizationHoliday[]> {
  const collection = await getCollection();
  const filter: Record<string, unknown> = {
    organizationId: input.organizationId,
    date: { $gte: input.startDate, $lte: input.endDate },
  };

  if (input.branchId) {
    filter.$or = [{ branchId: null }, { branchId: input.branchId }];
  }

  return collection.find(filter).sort({ date: 1 }).toArray();
}

export async function findHolidayById(
  organizationId: string,
  id: string,
): Promise<OrganizationHoliday | null> {
  const collection = await getCollection();
  return collection.findOne({
    _id: id,
    organizationId: String(organizationId),
  });
}

export async function findHolidayByDate(input: {
  organizationId: string;
  date: string;
  branchId?: string | null;
}): Promise<OrganizationHoliday | null> {
  const collection = await getCollection();
  const candidates = await collection
    .find({
      organizationId: input.organizationId,
      date: input.date,
      $or: [{ branchId: null }, { branchId: input.branchId ?? null }],
    })
    .toArray();

  if (candidates.length === 0) {
    return null;
  }

  const branchSpecific = candidates.find(
    (holiday) => holiday.branchId === input.branchId,
  );
  return branchSpecific ?? candidates.find((holiday) => !holiday.branchId) ?? null;
}

export async function createHoliday(input: {
  organizationId: string;
  branchId: string | null;
  date: string;
  name: string;
  holidayType: StatutoryHolidayType;
  createdBy: string;
}): Promise<OrganizationHoliday> {
  const collection = await getCollection();
  const now = new Date();
  const holiday: OrganizationHoliday = {
    _id: createId(),
    organizationId: input.organizationId,
    branchId: input.branchId,
    date: input.date,
    name: input.name.trim(),
    holidayType: input.holidayType,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };

  await collection.insertOne(holiday);
  return holiday;
}

export async function updateHoliday(input: {
  organizationId: string;
  id: string;
  name?: string;
  holidayType?: StatutoryHolidayType;
  branchId?: string | null;
}): Promise<OrganizationHoliday | null> {
  const collection = await getCollection();
  const updates: Partial<OrganizationHoliday> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    updates.name = input.name.trim();
  }

  if (input.holidayType) {
    updates.holidayType = input.holidayType;
  }

  if (input.branchId !== undefined) {
    updates.branchId = input.branchId;
  }

  const result = await collection.findOneAndUpdate(
    {
      _id: input.id,
      organizationId: String(input.organizationId),
    },
    {
      $set: updates,
      ...(input.holidayType ? { $unset: { payRule: '' } } : {}),
    },
    { returnDocument: 'after' },
  );

  return result ?? null;
}

export async function deleteHoliday(
  organizationId: string,
  id: string,
): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({
    _id: id,
    organizationId: String(organizationId),
  });
  return result.deletedCount > 0;
}

export function serializeHoliday(holiday: OrganizationHoliday) {
  return {
    id: holiday._id,
    organizationId: holiday.organizationId,
    branchId: holiday.branchId,
    date: holiday.date,
    name: holiday.name,
    holidayType: holiday.holidayType ?? null,
    createdAt: holiday.createdAt.toISOString(),
    updatedAt: holiday.updatedAt.toISOString(),
    createdBy: holiday.createdBy,
  };
}

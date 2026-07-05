import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';
import {
  DEFAULT_WORK_SCHEDULE,
  resolveWorkSchedule,
  serializeWorkSchedule,
  type Weekday,
  type WorkSchedule,
} from './work-schedule.util';

export const EMPLOYMENT_TYPES = [
  'full_time',
  'contractual',
  'intern',
  'probation',
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export interface EmployeeProfile {
  _id: string;
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  employmentType: EmploymentType;
  jobTitle?: string;
  hireDate: string;
  contractStartDate: string;
  contractEndDate?: string;
  probationEndDate?: string;
  notes?: string;
  weeklyRestDays?: Weekday[];
  workStartTime?: string;
  workEndTime?: string;
  extraDayOffDates?: string[];
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

const COLLECTION = 'employee_profiles';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<EmployeeProfile>(COLLECTION);
}

export async function createEmployeeProfile(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  employmentType?: EmploymentType;
  jobTitle?: string;
  hireDate: string;
  contractStartDate: string;
  contractEndDate?: string;
  probationEndDate?: string;
  notes?: string;
  weeklyRestDays?: Weekday[];
  workStartTime?: string;
  workEndTime?: string;
  extraDayOffDates?: string[];
  updatedBy?: string;
}): Promise<EmployeeProfile> {
  const collection = await getCollection();
  const now = new Date();
  const profile: EmployeeProfile = {
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    employmentType: input.employmentType ?? 'probation',
    jobTitle: input.jobTitle?.trim() || undefined,
    hireDate: input.hireDate,
    contractStartDate: input.contractStartDate,
    contractEndDate: input.contractEndDate || undefined,
    probationEndDate: input.probationEndDate || undefined,
    notes: input.notes?.trim() || undefined,
    weeklyRestDays: DEFAULT_WORK_SCHEDULE.weeklyRestDays,
    workStartTime: DEFAULT_WORK_SCHEDULE.workStartTime,
    workEndTime: DEFAULT_WORK_SCHEDULE.workEndTime,
    extraDayOffDates: [],
    createdAt: now,
    updatedAt: now,
    updatedBy: input.updatedBy,
  };

  await collection.insertOne(profile);
  return profile;
}

export async function findProfileByUserId(
  organizationId: string,
  userId: string,
): Promise<EmployeeProfile | null> {
  const collection = await getCollection();
  return collection.findOne({
    organizationId: String(organizationId),
    userId: String(userId),
  });
}

export async function listProfilesByOrganization(
  organizationId: string,
  branchId?: string,
): Promise<EmployeeProfile[]> {
  const collection = await getCollection();
  const filter: Record<string, string> = {
    organizationId: String(organizationId),
  };

  if (branchId) {
    filter.branchId = branchId;
  }

  return collection.find(filter).sort({ hireDate: -1 }).toArray();
}

export async function updateEmployeeProfile(input: {
  organizationId: string;
  userId: string;
  employmentType?: EmploymentType;
  jobTitle?: string;
  hireDate?: string;
  contractStartDate?: string;
  contractEndDate?: string | null;
  probationEndDate?: string | null;
  notes?: string | null;
  branchId?: string;
  updatedBy: string;
}): Promise<EmployeeProfile | null> {
  const collection = await getCollection();
  const updates: Partial<EmployeeProfile> = {
    updatedAt: new Date(),
    updatedBy: input.updatedBy,
  };

  if (input.employmentType) {
    updates.employmentType = input.employmentType;
  }

  if (input.jobTitle !== undefined) {
    updates.jobTitle = input.jobTitle.trim() || undefined;
  }

  if (input.hireDate) {
    updates.hireDate = input.hireDate;
  }

  if (input.contractStartDate) {
    updates.contractStartDate = input.contractStartDate;
  }

  if (input.contractEndDate !== undefined) {
    updates.contractEndDate = input.contractEndDate || undefined;
  }

  if (input.probationEndDate !== undefined) {
    updates.probationEndDate = input.probationEndDate || undefined;
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes?.trim() || undefined;
  }

  if (input.branchId) {
    updates.branchId = input.branchId;
  }

  const result = await collection.findOneAndUpdate(
    {
      organizationId: String(input.organizationId),
      userId: String(input.userId),
    },
    { $set: updates },
    { returnDocument: 'after' },
  );

  return result ?? null;
}

export async function updateEmployeeWorkSchedule(input: {
  organizationId: string;
  userId: string;
  weeklyRestDays: Weekday[];
  workStartTime: string;
  workEndTime: string;
  extraDayOffDates: string[];
  updatedBy: string;
}): Promise<EmployeeProfile | null> {
  const collection = await getCollection();

  const result = await collection.findOneAndUpdate(
    {
      organizationId: String(input.organizationId),
      userId: String(input.userId),
    },
    {
      $set: {
        weeklyRestDays: input.weeklyRestDays,
        workStartTime: input.workStartTime,
        workEndTime: input.workEndTime,
        extraDayOffDates: input.extraDayOffDates,
        updatedAt: new Date(),
        updatedBy: input.updatedBy,
      },
    },
    { returnDocument: 'after' },
  );

  return result ?? null;
}

export function getProfileWorkSchedule(profile: EmployeeProfile): WorkSchedule {
  return resolveWorkSchedule({
    weeklyRestDays: profile.weeklyRestDays,
    workStartTime: profile.workStartTime,
    workEndTime: profile.workEndTime,
    extraDayOffDates: profile.extraDayOffDates,
  });
}

export function serializeEmployeeProfile(profile: EmployeeProfile) {
  const workSchedule = getProfileWorkSchedule(profile);

  return {
    userId: profile.userId,
    memberId: profile.memberId,
    branchId: profile.branchId,
    employmentType: profile.employmentType,
    jobTitle: profile.jobTitle ?? null,
    hireDate: profile.hireDate,
    contractStartDate: profile.contractStartDate,
    contractEndDate: profile.contractEndDate ?? null,
    probationEndDate: profile.probationEndDate ?? null,
    notes: profile.notes ?? null,
    workSchedule: serializeWorkSchedule(workSchedule),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

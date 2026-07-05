import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';

export type AttendanceEventType = 'clock_in' | 'clock_out';

export interface AttendanceEvent {
  _id: string;
  organizationId: string;
  userId: string;
  branchId: string;
  type: AttendanceEventType;
  recordedAt: Date;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
}

const COLLECTION = 'attendance_events';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<AttendanceEvent>(COLLECTION);
}

export async function createAttendanceEvent(input: {
  organizationId: string;
  userId: string;
  branchId: string;
  type: AttendanceEventType;
  recordedAt?: Date;
  latitude?: number;
  longitude?: number;
}): Promise<AttendanceEvent> {
  const collection = await getCollection();
  const event: AttendanceEvent = {
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    branchId: input.branchId,
    type: input.type,
    recordedAt: input.recordedAt ?? new Date(),
    latitude: input.latitude,
    longitude: input.longitude,
    createdAt: new Date(),
  };

  await collection.insertOne(event);
  return event;
}

export async function findLatestAttendanceEvent(
  organizationId: string,
  userId: string,
): Promise<AttendanceEvent | null> {
  const collection = await getCollection();
  return collection.findOne(
    { organizationId, userId },
    { sort: { recordedAt: -1 } },
  );
}

export async function listAttendanceEventsForUser(
  organizationId: string,
  userId: string,
  limit = 20,
): Promise<AttendanceEvent[]> {
  const collection = await getCollection();
  return collection
    .find({ organizationId, userId })
    .sort({ recordedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function listAttendanceEventsForBranchSince(
  organizationId: string,
  branchId: string,
  since: Date,
): Promise<AttendanceEvent[]> {
  const collection = await getCollection();
  return collection
    .find({
      organizationId,
      branchId,
      recordedAt: { $gte: since },
    })
    .sort({ recordedAt: -1 })
    .toArray();
}

export async function listAttendanceEventsForOrganizationSince(
  organizationId: string,
  since: Date,
): Promise<AttendanceEvent[]> {
  const collection = await getCollection();
  return collection
    .find({
      organizationId,
      recordedAt: { $gte: since },
    })
    .sort({ recordedAt: -1 })
    .toArray();
}

export function isClockedIn(latest: AttendanceEvent | null): boolean {
  return latest?.type === 'clock_in';
}

export function startOfLocalDay(date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function endOfLocalDay(date = new Date()): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export async function listAttendanceEventsForUserBetween(
  organizationId: string,
  userId: string,
  start: Date,
  end: Date,
): Promise<AttendanceEvent[]> {
  const collection = await getCollection();
  return collection
    .find({
      organizationId,
      userId,
      recordedAt: { $gte: start, $lte: end },
    })
    .sort({ recordedAt: 1 })
    .toArray();
}

export async function listAttendanceEventsForBranchBetween(
  organizationId: string,
  branchId: string,
  start: Date,
  end: Date,
): Promise<AttendanceEvent[]> {
  const collection = await getCollection();
  return collection
    .find({
      organizationId,
      branchId,
      recordedAt: { $gte: start, $lte: end },
    })
    .sort({ recordedAt: 1 })
    .toArray();
}

export async function listAttendanceEventsForOrganizationBetween(
  organizationId: string,
  start: Date,
  end: Date,
): Promise<AttendanceEvent[]> {
  const collection = await getCollection();
  return collection
    .find({
      organizationId,
      recordedAt: { $gte: start, $lte: end },
    })
    .sort({ recordedAt: 1 })
    .toArray();
}

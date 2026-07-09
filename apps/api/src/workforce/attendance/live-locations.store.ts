import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';

export interface EmployeeLiveLocation {
  _id: string;
  organizationId: string;
  userId: string;
  branchId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'employee_live_locations';

function createId(): string {
  return randomBytes(12).toString('hex');
}

let indexesReady = false;

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<EmployeeLiveLocation>(COLLECTION);
}

export async function ensureLiveLocationIndexes(): Promise<void> {
  if (indexesReady) {
    return;
  }

  const collection = await getCollection();
  await collection.createIndex(
    { organizationId: 1, userId: 1 },
    { unique: true },
  );
  await collection.createIndex({ organizationId: 1, branchId: 1 });
  indexesReady = true;
}

export async function upsertLiveLocation(input: {
  organizationId: string;
  userId: string;
  branchId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt?: Date;
}): Promise<EmployeeLiveLocation> {
  await ensureLiveLocationIndexes();
  const collection = await getCollection();
  const now = new Date();
  const recordedAt = input.recordedAt ?? now;

  const result = await collection.findOneAndUpdate(
    {
      organizationId: String(input.organizationId),
      userId: String(input.userId),
    },
    {
      $set: {
        branchId: String(input.branchId),
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        recordedAt,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: createId(),
        organizationId: String(input.organizationId),
        userId: String(input.userId),
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  if (!result) {
    const existing = await collection.findOne({
      organizationId: String(input.organizationId),
      userId: String(input.userId),
    });
    if (!existing) {
      throw new Error('Failed to upsert live location.');
    }
    return existing;
  }

  return result;
}

export async function deleteLiveLocation(
  organizationId: string,
  userId: string,
): Promise<void> {
  const collection = await getCollection();
  await collection.deleteOne({
    organizationId: String(organizationId),
    userId: String(userId),
  });
}

export async function listLiveLocationsForOrg(input: {
  organizationId: string;
  branchId?: string;
}): Promise<EmployeeLiveLocation[]> {
  const collection = await getCollection();
  const filter: {
    organizationId: string;
    branchId?: string;
  } = {
    organizationId: String(input.organizationId),
  };

  if (input.branchId) {
    filter.branchId = String(input.branchId);
  }

  return collection.find(filter).sort({ updatedAt: -1 }).toArray();
}

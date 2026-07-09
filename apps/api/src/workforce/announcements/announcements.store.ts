import { randomBytes } from 'crypto';
import { getMongoDb } from '../../database/mongo';

export interface AnnouncementRecord {
  _id: string;
  organizationId: string;
  authorUserId: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'announcements';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<AnnouncementRecord>(COLLECTION);
}

export async function createAnnouncement(input: {
  organizationId: string;
  authorUserId: string;
  title: string;
  body: string;
}): Promise<AnnouncementRecord> {
  const collection = await getCollection();
  const now = new Date();
  const record: AnnouncementRecord = {
    _id: createId(),
    organizationId: String(input.organizationId),
    authorUserId: String(input.authorUserId),
    title: input.title.trim(),
    body: input.body.trim(),
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(record);
  return record;
}

export async function listAnnouncementsByOrganization(
  organizationId: string,
  limit?: number,
): Promise<AnnouncementRecord[]> {
  const collection = await getCollection();
  const cursor = collection
    .find({ organizationId: String(organizationId) })
    .sort({ createdAt: -1 });

  if (typeof limit === 'number') {
    cursor.limit(limit);
  }

  return cursor.toArray();
}

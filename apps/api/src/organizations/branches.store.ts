import { randomBytes } from 'crypto';
import { getMongoDb } from '../database/mongo';
import type { Branch, CreateBranchInput } from './organization.types';

const COLLECTION = 'branches';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<Branch>(COLLECTION);
}

export async function createBranchesForOrganization(
  organizationId: string,
  branches: CreateBranchInput[],
): Promise<Branch[]> {
  const collection = await getCollection();
  const now = new Date();

  const docs: Branch[] = branches.map((branch, index) => ({
    _id: createId(),
    organizationId,
    name: branch.name.trim(),
    address: branch.address?.trim() || undefined,
    city: branch.city?.trim() || undefined,
    isHeadOffice: branch.isHeadOffice ?? index === 0,
    createdAt: now,
  }));

  if (docs.length === 0) {
    return [];
  }

  await collection.insertMany(docs);
  return docs;
}

export async function listBranchesByOrganization(
  organizationId: string,
): Promise<Branch[]> {
  const collection = await getCollection();
  return collection.find({ organizationId }).sort({ createdAt: 1 }).toArray();
}

export async function getBranchById(branchId: string): Promise<Branch | null> {
  const collection = await getCollection();
  return collection.findOne({ _id: branchId });
}

export function slugifyOrganizationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

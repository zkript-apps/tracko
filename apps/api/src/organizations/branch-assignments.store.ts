import { randomBytes } from 'crypto';
import { getMongoDb } from '../database/mongo';

export interface BranchAssignment {
  _id: string;
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  role: string;
  createdAt: Date;
}

const COLLECTION = 'branch_assignments';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<BranchAssignment>(COLLECTION);
}

export async function createBranchAssignment(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  role: string;
}): Promise<BranchAssignment> {
  const collection = await getCollection();
  const assignment: BranchAssignment = {
    _id: createId(),
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    role: input.role,
    createdAt: new Date(),
  };

  await collection.insertOne(assignment);
  return assignment;
}

export async function listAssignmentsByOrganization(organizationId: string) {
  const collection = await getCollection();
  return collection.find({ organizationId }).sort({ createdAt: 1 }).toArray();
}

export async function findAssignmentByUserId(
  organizationId: string,
  userId: string,
) {
  const collection = await getCollection();
  return collection.findOne({ organizationId, userId });
}

import { randomBytes } from 'crypto';
import { getMongoDb } from '../database/mongo';
import type { BillableFeatureId } from './feature-catalog';

export type SubscriptionChangeAction = 'add' | 'remove';

export interface PendingSubscriptionChange {
  id: string;
  featureId: BillableFeatureId;
  action: SubscriptionChangeAction;
  effectiveAt: Date;
  requestedAt: Date;
  requestedByUserId: string;
}

export interface OrganizationSubscription {
  _id: string;
  organizationId: string;
  currency: 'PHP';
  activeFeatures: BillableFeatureId[];
  pendingChanges: PendingSubscriptionChange[];
  status: 'active' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'organization_subscriptions';

function createId(): string {
  return randomBytes(12).toString('hex');
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<OrganizationSubscription>(COLLECTION);
}

export async function ensureSubscriptionIndexes(): Promise<void> {
  const collection = await getCollection();
  await collection.createIndex({ organizationId: 1 }, { unique: true });
}

export async function findSubscriptionByOrganizationId(
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  const collection = await getCollection();
  return collection.findOne({ organizationId: String(organizationId) });
}

export async function createOrganizationSubscription(input: {
  organizationId: string;
  activeFeatures?: BillableFeatureId[];
}): Promise<OrganizationSubscription> {
  await ensureSubscriptionIndexes();
  const collection = await getCollection();
  const now = new Date();
  const subscription: OrganizationSubscription = {
    _id: createId(),
    organizationId: String(input.organizationId),
    currency: 'PHP',
    activeFeatures: input.activeFeatures ?? [],
    pendingChanges: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(subscription);
  return subscription;
}

export async function saveOrganizationSubscription(
  subscription: OrganizationSubscription,
): Promise<OrganizationSubscription> {
  const collection = await getCollection();
  const updatedAt = new Date();
  await collection.updateOne(
    { _id: subscription._id },
    {
      $set: {
        activeFeatures: subscription.activeFeatures,
        pendingChanges: subscription.pendingChanges,
        status: subscription.status,
        updatedAt,
      },
    },
  );

  return {
    ...subscription,
    updatedAt,
  };
}

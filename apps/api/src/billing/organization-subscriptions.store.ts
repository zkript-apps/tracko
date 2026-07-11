import { randomBytes } from 'crypto';
import { getMongoDb } from '../database/mongo';
import type { BillableFeatureId } from './feature-catalog';
import type { OrganizationScaleTier } from './organization-scale';

export type SubscriptionChangeAction = 'add' | 'remove';

export interface PendingSubscriptionChange {
  id: string;
  featureId: BillableFeatureId;
  action: SubscriptionChangeAction;
  effectiveAt: Date;
  requestedAt: Date;
  requestedByUserId: string;
}

export interface PendingScaleChange {
  id: string;
  scaleTier: OrganizationScaleTier;
  effectiveAt: Date;
  requestedAt: Date;
  requestedByUserId: string;
}

export type OrganizationSubscriptionStatus =
  | 'pending'
  | 'active'
  | 'rejected'
  | 'cancelled';

export interface OrganizationSubscription {
  _id: string;
  organizationId: string;
  currency: 'PHP';
  scaleTier: OrganizationScaleTier;
  activeFeatures: BillableFeatureId[];
  pendingChanges: PendingSubscriptionChange[];
  pendingScaleChange: PendingScaleChange | null;
  status: OrganizationSubscriptionStatus;
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
): Promise<
  | (OrganizationSubscription & { hasStoredScaleTier: boolean })
  | null
> {
  const collection = await getCollection();
  const subscription = await collection.findOne({
    organizationId: String(organizationId),
  });

  if (!subscription) {
    return null;
  }

  const hasStoredScaleTier =
    typeof subscription.scaleTier === 'string' &&
    subscription.scaleTier.length > 0;

  return {
    ...subscription,
    scaleTier: subscription.scaleTier ?? 'small',
    pendingScaleChange: subscription.pendingScaleChange ?? null,
    status: subscription.status ?? 'active',
    hasStoredScaleTier,
  };
}

export async function createOrganizationSubscription(input: {
  organizationId: string;
  activeFeatures?: BillableFeatureId[];
  scaleTier?: OrganizationScaleTier;
  status?: OrganizationSubscriptionStatus;
}): Promise<OrganizationSubscription> {
  await ensureSubscriptionIndexes();
  const collection = await getCollection();
  const now = new Date();
  const subscription: OrganizationSubscription = {
    _id: createId(),
    organizationId: String(input.organizationId),
    currency: 'PHP',
    scaleTier: input.scaleTier ?? 'small',
    activeFeatures: input.activeFeatures ?? [],
    pendingChanges: [],
    pendingScaleChange: null,
    status: input.status ?? 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(subscription);
  return subscription;
}

export async function listSubscriptionsByStatus(
  status: OrganizationSubscriptionStatus,
): Promise<OrganizationSubscription[]> {
  const collection = await getCollection();
  return collection.find({ status }).sort({ createdAt: -1 }).toArray();
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
        scaleTier: subscription.scaleTier,
        activeFeatures: subscription.activeFeatures,
        pendingChanges: subscription.pendingChanges,
        pendingScaleChange: subscription.pendingScaleChange,
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

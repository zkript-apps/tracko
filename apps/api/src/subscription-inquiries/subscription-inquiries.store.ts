import { randomBytes } from 'crypto';
import { getMongoDb } from '../database/mongo';
import type { BillableFeatureId } from '../billing/feature-catalog.types';
import { isBillableFeatureId } from '../billing/feature-catalog';
import type { OrganizationScaleTier } from '../billing/organization-scale';

export interface SubscriptionInquiry {
  _id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  message?: string;
  employeeCount: number;
  scaleTier: OrganizationScaleTier;
  selectedFeatures: BillableFeatureId[];
  createdAt: Date;
}

const COLLECTION = 'subscription_inquiries';

function createId(): string {
  return randomBytes(12).toString('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<SubscriptionInquiry>(COLLECTION);
}

export async function createSubscriptionInquiry(input: {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  message?: string;
  employeeCount: number;
  scaleTier: OrganizationScaleTier;
  selectedFeatures: BillableFeatureId[];
}): Promise<SubscriptionInquiry> {
  const collection = await getCollection();
  const inquiry: SubscriptionInquiry = {
    _id: createId(),
    companyName: input.companyName.trim(),
    contactName: input.contactName.trim(),
    email: normalizeEmail(input.email),
    phone: input.phone.trim(),
    message: input.message?.trim() || undefined,
    employeeCount: input.employeeCount,
    scaleTier: input.scaleTier,
    selectedFeatures: input.selectedFeatures,
    createdAt: new Date(),
  };

  await collection.insertOne(inquiry);
  return inquiry;
}

export function parseSelectedFeatures(
  selectedFeatures: string[],
): BillableFeatureId[] {
  const unique = new Set<BillableFeatureId>();

  for (const featureId of selectedFeatures) {
    if (isBillableFeatureId(featureId)) {
      unique.add(featureId);
    }
  }

  return Array.from(unique);
}

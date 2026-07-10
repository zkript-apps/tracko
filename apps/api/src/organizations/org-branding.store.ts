import { ObjectId } from 'mongodb';
import { getMongoDb } from '../database/mongo';
import {
  DEFAULT_ORG_BRANDING,
  normalizeOrgBranding,
  type OrgBranding,
} from './org-branding.types';

function organizationIdFilter(organizationId: string) {
  const id = String(organizationId);
  const filters: Array<Record<string, unknown>> = [{ _id: id }, { id }];

  if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
    filters.push({ _id: new ObjectId(id) });
  }

  return { $or: filters };
}

async function getOrganizationCollection() {
  const db = await getMongoDb();
  return db.collection('organization');
}

export async function findOrganizationBranding(
  organizationId: string,
): Promise<OrgBranding> {
  const collection = await getOrganizationCollection();
  const organization = await collection.findOne(
    organizationIdFilter(String(organizationId)),
  );

  if (!organization) {
    return { ...DEFAULT_ORG_BRANDING };
  }

  return normalizeOrgBranding({
    primaryColor:
      typeof organization.primaryColor === 'string'
        ? organization.primaryColor
        : undefined,
    secondaryColor:
      typeof organization.secondaryColor === 'string'
        ? organization.secondaryColor
        : undefined,
    accentColor:
      typeof organization.accentColor === 'string'
        ? organization.accentColor
        : undefined,
    logoFileName:
      typeof organization.logoFileName === 'string'
        ? organization.logoFileName
        : null,
  });
}

export async function updateOrganizationBranding(
  organizationId: string,
  branding: Pick<OrgBranding, 'primaryColor' | 'secondaryColor' | 'accentColor'>,
): Promise<OrgBranding> {
  const collection = await getOrganizationCollection();
  const normalized = normalizeOrgBranding(branding);
  const filter = organizationIdFilter(String(organizationId));

  const result = await collection.updateOne(filter, {
    $set: {
      primaryColor: normalized.primaryColor,
      secondaryColor: normalized.secondaryColor,
      accentColor: normalized.accentColor,
    },
  });

  if (result.matchedCount === 0) {
    throw new Error('Organization not found while saving branding.');
  }

  return findOrganizationBranding(organizationId);
}

export async function updateOrganizationLogoFileName(
  organizationId: string,
  logoFileName: string | null,
): Promise<OrgBranding> {
  const collection = await getOrganizationCollection();
  const filter = organizationIdFilter(String(organizationId));

  const result = await collection.updateOne(filter, {
    $set: {
      logoFileName,
    },
  });

  if (result.matchedCount === 0) {
    throw new Error('Organization not found while saving logo.');
  }

  return findOrganizationBranding(organizationId);
}

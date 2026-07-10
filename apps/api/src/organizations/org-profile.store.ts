import { ObjectId } from 'mongodb';
import { getMongoDb } from '../database/mongo';

export type OrganizationProfile = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  timezone: string | null;
  logoFileName: string | null;
};

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

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serializeOrganization(
  organization: Record<string, unknown>,
  organizationId: string,
): OrganizationProfile {
  const id =
    typeof organization.id === 'string'
      ? organization.id
      : typeof organization._id === 'string'
        ? organization._id
        : organizationId;

  return {
    id,
    name:
      typeof organization.name === 'string' && organization.name.trim()
        ? organization.name.trim()
        : 'Organization',
    slug: typeof organization.slug === 'string' ? organization.slug : '',
    description: asOptionalString(organization.description),
    industry: asOptionalString(organization.industry),
    website: asOptionalString(organization.website),
    phone: asOptionalString(organization.phone),
    address: asOptionalString(organization.address),
    city: asOptionalString(organization.city),
    timezone: asOptionalString(organization.timezone),
    logoFileName: asOptionalString(organization.logoFileName),
  };
}

export async function findOrganizationProfile(
  organizationId: string,
): Promise<OrganizationProfile | null> {
  const collection = await getOrganizationCollection();
  const organization = await collection.findOne(
    organizationIdFilter(String(organizationId)),
  );

  if (!organization) {
    return null;
  }

  return serializeOrganization(
    organization as Record<string, unknown>,
    organizationId,
  );
}

export async function updateOrganizationProfile(
  organizationId: string,
  input: {
    name: string;
    description?: string | null;
    industry?: string | null;
    website?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    timezone?: string | null;
  },
): Promise<OrganizationProfile> {
  const collection = await getOrganizationCollection();
  const filter = organizationIdFilter(String(organizationId));
  const name = input.name.trim();

  if (!name) {
    throw new Error('Organization name is required.');
  }

  const result = await collection.updateOne(filter, {
    $set: {
      name,
      description: asOptionalString(input.description),
      industry: asOptionalString(input.industry),
      website: asOptionalString(input.website),
      phone: asOptionalString(input.phone),
      address: asOptionalString(input.address),
      city: asOptionalString(input.city),
      timezone: asOptionalString(input.timezone),
    },
  });

  if (result.matchedCount === 0) {
    throw new Error('Organization not found while saving profile.');
  }

  const updated = await findOrganizationProfile(organizationId);

  if (!updated) {
    throw new Error('Organization not found after saving profile.');
  }

  return updated;
}

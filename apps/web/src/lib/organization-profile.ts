import { apiFetch } from './api';
import {
  removeOrgLogo,
  resolveBrandingLogoUrl,
  uploadOrgLogo,
} from './branding';

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
  hasLogo: boolean;
  logoUrl: string | null;
};

export type UpdateOrganizationProfileInput = {
  name: string;
  description?: string | null;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  timezone?: string | null;
};

export async function getOrganizationProfile(): Promise<OrganizationProfile> {
  return apiFetch('/organization/profile');
}

export async function updateOrganizationProfile(
  input: UpdateOrganizationProfileInput,
): Promise<OrganizationProfile> {
  return apiFetch('/organization/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export {
  removeOrgLogo,
  uploadOrgLogo,
  resolveBrandingLogoUrl as resolveOrganizationLogoUrl,
};

import { apiFetch } from './api';

export type PlatformOverview = {
  organizationCount: number;
  memberCount: number;
  branchCount: number;
  pendingAdminInvites: number;
  totalAdminInvites: number;
};

export type PlatformOrganization = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  city: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  memberCount: number;
  branchCount: number;
};

export type PlatformAdminInvitation = {
  token: string;
  email: string;
  planTier: string;
  status: string;
  paymentReference: string | null;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
  signupUrl: string | null;
};

export type BootstrapStatus = {
  bootstrapConfigured: boolean;
};

export async function getBootstrapStatus(): Promise<BootstrapStatus> {
  return apiFetch('/platform/bootstrap-status');
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  return apiFetch('/platform/overview');
}

export async function getPlatformOrganizations(): Promise<PlatformOrganization[]> {
  return apiFetch('/platform/organizations');
}

export async function getPlatformAdminInvitations(): Promise<
  PlatformAdminInvitation[]
> {
  return apiFetch('/platform/admin-invitations');
}

export async function createPlatformAdminInvitation(input: {
  email: string;
  planTier: 'small' | 'medium' | 'enterprise';
  paymentReference?: string;
}): Promise<{
  invitation: {
    token: string;
    email: string;
    planTier: string;
    status: string;
    expiresAt: string;
  };
  signupUrl: string;
}> {
  return apiFetch('/platform/admin-invitations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

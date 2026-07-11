import { apiFetch } from './api';

export type PlatformOverview = {
  organizationCount: number;
  memberCount: number;
  branchCount: number;
  pendingAdminInvites: number;
  pendingInquiries: number;
  pendingSubscriptions: number;
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
  subscriptionStatus: string | null;
  scaleTier: string | null;
};

export type PlatformAdminInvitation = {
  token: string;
  email: string;
  planTier: string;
  selectedFeatures: string[];
  status: string;
  paymentReference: string | null;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
  signupUrl: string | null;
};

export type PlatformSubscriptionInquiry = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  message: string | null;
  employeeCount: number;
  scaleTier: string;
  scaleTierLabel: string;
  selectedFeatures: string[];
  status: 'pending' | 'approved' | 'rejected';
  estimatedMonthlyTotalPhp: number;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export type PlatformPendingSubscription = {
  organizationId: string;
  organizationName: string;
  scaleTier: string;
  scaleTierLabel: string;
  activeFeatures: string[];
  status: string;
  createdAt: string;
  currentMonthlyTotalPhp: number;
};

export type BootstrapStatus = {
  bootstrapConfigured: boolean;
};

export type SubscriptionAccessStatus = {
  organizationId: string;
  status: 'pending' | 'active' | 'rejected' | 'cancelled';
  isAccessAllowed: boolean;
  scaleTier: string;
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

export async function getPlatformSubscriptionInquiries(): Promise<
  PlatformSubscriptionInquiry[]
> {
  return apiFetch('/platform/subscription-inquiries');
}

export async function approvePlatformSubscriptionInquiry(
  inquiryId: string,
): Promise<{ inquiry: PlatformSubscriptionInquiry; signupUrl: string }> {
  return apiFetch(`/platform/subscription-inquiries/${encodeURIComponent(inquiryId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function rejectPlatformSubscriptionInquiry(
  inquiryId: string,
  reason?: string,
): Promise<PlatformSubscriptionInquiry> {
  return apiFetch(`/platform/subscription-inquiries/${encodeURIComponent(inquiryId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function getPlatformPendingSubscriptions(): Promise<
  PlatformPendingSubscription[]
> {
  return apiFetch('/platform/subscriptions/pending');
}

export async function activatePlatformSubscription(
  organizationId: string,
): Promise<{ organizationId: string; status: string }> {
  return apiFetch(
    `/platform/subscriptions/${encodeURIComponent(organizationId)}/activate`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function rejectPlatformSubscription(
  organizationId: string,
): Promise<{ organizationId: string; status: string }> {
  return apiFetch(
    `/platform/subscriptions/${encodeURIComponent(organizationId)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function getSubscriptionAccessStatus(): Promise<SubscriptionAccessStatus> {
  return apiFetch('/billing/access-status');
}

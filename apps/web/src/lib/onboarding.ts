import { apiFetch } from './api';
import { getSession } from './auth-client';
import { getSubscriptionAccessStatus } from './platform';
import { getTeamOverview } from './team';
import { getPostInvitePath, isEmployeeRole, isSuperAdminRole } from './org-roles';

export type OnboardingStatus = {
  needsOnboarding: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
    onboardingCompleted: boolean;
  } | null;
  branches: Array<{
    _id: string;
    name: string;
    address?: string;
    city?: string;
    isHeadOffice: boolean;
  }>;
};

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  return apiFetch('/onboarding/status');
}

function isOrgAdminPlatformUser(platformRole: string | null | undefined) {
  return (
    !platformRole ||
    platformRole === 'org_admin' ||
    platformRole === 'owner' ||
    platformRole === 'admin'
  );
}

export async function getPostAuthPath(): Promise<
  | '/onboarding'
  | '/dashboard'
  | '/employee'
  | '/platform'
  | '/subscription-pending'
> {
  const sessionResult = await getSession();
  const platformRole = (
    sessionResult.data?.user as { platformRole?: string } | undefined
  )?.platformRole;

  if (isSuperAdminRole(platformRole)) {
    return '/platform';
  }

  if (isEmployeeRole(platformRole)) {
    return '/employee';
  }

  if (platformRole === 'hr') {
    return '/dashboard';
  }

  const status = await getOnboardingStatus();

  if (status.needsOnboarding && isOrgAdminPlatformUser(platformRole)) {
    return '/onboarding';
  }

  if (isOrgAdminPlatformUser(platformRole)) {
    try {
      const access = await getSubscriptionAccessStatus();
      if (!access.isAccessAllowed) {
        return '/subscription-pending';
      }
    } catch {
      // If access status is unavailable, fall through to normal routing.
    }
  }

  try {
    const team = await getTeamOverview();
    const role =
      team.currentMember?.role ??
      team.members.find((member) => member.role)?.role ??
      'member';

    if (isEmployeeRole(role)) {
      return '/employee';
    }

    return getPostInvitePath(role);
  } catch {
    return '/dashboard';
  }
}

export type InvitationValidation = {
  valid: boolean;
  reason?: string;
  invitation?: {
    email: string;
    planTier: string;
    expiresAt: string;
    status: string;
  };
};

export async function validateInvitationToken(
  token: string,
): Promise<InvitationValidation> {
  return apiFetch(`/admin-invitations/validate?token=${encodeURIComponent(token)}`);
}

import type { BillableFeatureId } from './billing';
import type { LeavePolicy } from './leave-policy';

export type BranchInput = {
  name: string;
  address?: string;
  city?: string;
  isHeadOffice?: boolean;
};

export type CompleteOnboardingInput = {
  name: string;
  slug?: string;
  industry?: string;
  timezone?: string;
  address?: string;
  city?: string;
  phone?: string;
  selectedFeatures?: BillableFeatureId[];
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  };
  leavePolicy?: Omit<LeavePolicy, 'updatedAt'>;
  branches: BranchInput[];
};

export async function completeOnboarding(input: CompleteOnboardingInput) {
  return apiFetch('/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

import { apiFetch } from './api';
import { getSession } from './auth-client';
import { getTeamOverview } from './team';
import { getPostInvitePath, isEmployeeRole, isOrgAdminRole, isSuperAdminRole } from './org-roles';

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

export async function getPostAuthPath(): Promise<
  '/onboarding' | '/dashboard' | '/employee' | '/platform'
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

  if (status.needsOnboarding && isOrgAdminRole(platformRole ?? 'org_admin')) {
    return '/onboarding';
  }

  if (status.needsOnboarding && !platformRole) {
    return '/onboarding';
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
  branches: BranchInput[];
};

export async function completeOnboarding(input: CompleteOnboardingInput) {
  return apiFetch('/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

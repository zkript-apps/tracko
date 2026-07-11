import { Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { findInvitationByUserId } from '../admin-invitations/admin-invitations.store';
import { isBillableFeatureId } from '../billing/feature-catalog';
import { BillingService } from '../billing/billing.service';
import type { OrganizationScaleTier } from '../billing/organization-scale';
import {
  DEFAULT_LEAVE_POLICY,
  type LeavePolicyInput,
} from '../workforce/leave/leave-policy.types';
import { upsertLeavePolicy } from '../workforce/leave/leave-policy.store';
import {
  createBranchesForOrganization,
  listBranchesByOrganization,
  slugifyOrganizationName,
} from './branches.store';
import type {
  CompleteOnboardingInput,
  OnboardingStatus,
} from './organization.types';
import { normalizeOrgBranding } from './org-branding.types';

type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  onboardingCompleted?: boolean;
};

function normalizeLeavePolicyInput(
  input: NonNullable<CompleteOnboardingInput['leavePolicy']>,
): LeavePolicyInput {
  return {
    resetType: input.resetType,
    fiscalYearStartMonth: input.fiscalYearStartMonth,
    silSafeguard: input.silSafeguard,
    periodAutoGrant: input.periodAutoGrant,
    accrual: input.accrual,
    vacation: input.vacation ?? DEFAULT_LEAVE_POLICY.vacation,
    sick: input.sick ?? DEFAULT_LEAVE_POLICY.sick,
  };
}

@Injectable()
export class OnboardingService {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly authService: AuthService<any>,
    private readonly billing: BillingService,
  ) {}

  getStatus(organizations: OrganizationRecord[]): OnboardingStatus {
    const organization = organizations[0] ?? null;

    return {
      needsOnboarding: !organization || !organization.onboardingCompleted,
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            onboardingCompleted: Boolean(organization.onboardingCompleted),
          }
        : null,
      branches: [],
    };
  }

  async getStatusForSession(headers: HeadersInit): Promise<OnboardingStatus> {
    const session = await this.authService.api.getSession({ headers });
    const platformRole = session?.user?.platformRole;

    const organizations = await this.authService.api.listOrganizations({
      headers,
    });

    const organization = organizations[0] ?? null;

    if (organization) {
      if (!session?.session?.activeOrganizationId) {
        await this.authService.api.setActiveOrganization({
          headers,
          body: { organizationId: organization.id },
        });
      }
    }

    const branches = organization
      ? await listBranchesByOrganization(organization.id)
      : [];

    const isInvitedMember =
      platformRole === 'hr' || platformRole === 'employee';

    return {
      needsOnboarding:
        !isInvitedMember &&
        (!organization || !organization.onboardingCompleted),
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            onboardingCompleted: Boolean(organization.onboardingCompleted),
          }
        : null,
      branches,
    };
  }

  async complete(headers: HeadersInit, input: CompleteOnboardingInput) {
    const session = await this.authService.api.getSession({ headers });
    const slug = input.slug?.trim() || slugifyOrganizationName(input.name);
    const branding = normalizeOrgBranding(input.branding);

    const organization = await this.authService.api.createOrganization({
      headers,
      body: {
        name: input.name.trim(),
        slug,
        industry: input.industry?.trim(),
        timezone: input.timezone?.trim() || 'Asia/Manila',
        address: input.address?.trim(),
        city: input.city?.trim(),
        phone: input.phone?.trim(),
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        onboardingCompleted: true,
      },
    });

    await this.authService.api.setActiveOrganization({
      headers,
      body: {
        organizationId: organization.id,
      },
    });

    const branches = await createBranchesForOrganization(
      organization.id,
      input.branches,
    );

    const invitation = session?.user?.id
      ? await findInvitationByUserId(session.user.id)
      : null;
    const scaleTier = (invitation?.planTier ??
      'small') as OrganizationScaleTier;
    const fromInput = (input.selectedFeatures ?? []).filter(isBillableFeatureId);
    const fromInvitation = (invitation?.selectedFeatures ?? []).filter(
      isBillableFeatureId,
    );
    const activeFeatures =
      fromInput.length > 0 ? fromInput : fromInvitation;

    await this.billing.seedSubscriptionForOrganization(organization.id, {
      scaleTier,
      activeFeatures,
      status: 'pending',
    });

    if (input.leavePolicy && activeFeatures.includes('leave')) {
      await upsertLeavePolicy(
        organization.id,
        normalizeLeavePolicyInput(input.leavePolicy),
      );
    }

    return {
      organization,
      branches,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  createBranchesForOrganization,
  listBranchesByOrganization,
  slugifyOrganizationName,
} from './branches.store';
import type {
  CompleteOnboardingInput,
  OnboardingStatus,
} from './organization.types';

type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  onboardingCompleted?: boolean;
};

@Injectable()
export class OnboardingService {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly authService: AuthService<any>,
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
    const slug = input.slug?.trim() || slugifyOrganizationName(input.name);

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

    return {
      organization,
      branches,
    };
  }
}

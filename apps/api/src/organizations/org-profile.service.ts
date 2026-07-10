import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { ORG_ADMIN_ROLES } from '../auth/org-roles';
import { findOrganizationBranding } from './org-branding.store';
import {
  findOrganizationProfile,
  updateOrganizationProfile,
  type OrganizationProfile,
} from './org-profile.store';

function rethrowProfileStoreError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.includes('Organization name is required')) {
      throw new BadRequestException(error.message);
    }

    if (error.message.includes('Organization not found')) {
      throw new BadRequestException(error.message);
    }
  }

  throw error;
}

@Injectable()
export class OrgProfileService {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly authService: AuthService<any>,
  ) {}

  private headersFrom(request: Request) {
    return fromNodeHeaders(request.headers);
  }

  private async getOrganizationContext(request: Request) {
    const headers = this.headersFrom(request);
    const session = await this.authService.api.getSession({ headers });

    if (!session?.user?.id) {
      throw new UnauthorizedException('Sign in required.');
    }

    const organizations = await this.authService.api.listOrganizations({
      headers,
    });

    if (!organizations?.length) {
      throw new BadRequestException('No organization found.');
    }

    const organization = organizations[0];

    if (!session.session?.activeOrganizationId) {
      await this.authService.api.setActiveOrganization({
        headers,
        body: { organizationId: organization.id },
      });
    }

    const fullOrganization = await this.authService.api.getFullOrganization({
      headers,
      query: { organizationId: organization.id },
    });

    if (!fullOrganization) {
      throw new BadRequestException('Unable to load organization.');
    }

    let activeMember;

    try {
      activeMember = await this.authService.api.getActiveMember({ headers });
    } catch {
      activeMember =
        fullOrganization.members?.find(
          (member: { userId: string }) => member.userId === session.user.id,
        ) ?? null;
    }

    const role = activeMember?.role ?? 'member';
    const isAdmin = ORG_ADMIN_ROLES.includes(
      role as (typeof ORG_ADMIN_ROLES)[number],
    );

    return {
      organizationId: String(fullOrganization.id),
      isAdmin,
    };
  }

  private async requireAdmin(request: Request) {
    const context = await this.getOrganizationContext(request);

    if (!context.isAdmin) {
      throw new ForbiddenException('Organization admin access required.');
    }

    return context;
  }

  private serializeProfile(
    profile: OrganizationProfile,
    hasLogo: boolean,
  ) {
    return {
      id: profile.id,
      name: profile.name,
      slug: profile.slug,
      description: profile.description,
      industry: profile.industry,
      website: profile.website,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      timezone: profile.timezone,
      hasLogo,
      logoUrl: hasLogo ? '/organization/branding/logo' : null,
    };
  }

  async getProfile(request: Request) {
    const context = await this.getOrganizationContext(request);
    const [profile, branding] = await Promise.all([
      findOrganizationProfile(context.organizationId),
      findOrganizationBranding(context.organizationId),
    ]);

    if (!profile) {
      throw new BadRequestException('Organization not found.');
    }

    return this.serializeProfile(profile, Boolean(branding.logoFileName));
  }

  async updateProfile(
    request: Request,
    input: {
      name?: string;
      description?: string | null;
      industry?: string | null;
      website?: string | null;
      phone?: string | null;
      address?: string | null;
      city?: string | null;
      timezone?: string | null;
    },
  ) {
    const context = await this.requireAdmin(request);
    const name = input.name?.trim();

    if (!name) {
      throw new BadRequestException('Company name is required.');
    }

    if (name.length > 120) {
      throw new BadRequestException(
        'Company name must be 120 characters or fewer.',
      );
    }

    const description = input.description?.trim() ?? '';
    if (description.length > 1000) {
      throw new BadRequestException(
        'Description must be 1000 characters or fewer.',
      );
    }

    const website = input.website?.trim() ?? '';
    if (website && !/^https?:\/\/.+/i.test(website) && !/^[\w.-]+\.[\w.-]+/.test(website)) {
      throw new BadRequestException(
        'Website must be a valid URL (e.g. https://company.com).',
      );
    }

    try {
      const profile = await updateOrganizationProfile(context.organizationId, {
        name,
        description: description || null,
        industry: input.industry ?? null,
        website: website || null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        timezone: input.timezone ?? null,
      });
      const branding = await findOrganizationBranding(context.organizationId);

      return this.serializeProfile(profile, Boolean(branding.logoFileName));
    } catch (error) {
      rethrowProfileStoreError(error);
    }
  }
}

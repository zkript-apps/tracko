import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { randomBytes } from 'crypto';
import { ORG_ADMIN_ROLES } from '../auth/org-roles';
import {
  deleteOrgLogoFile,
  getOrgLogoExtension,
  getAllowedOrgLogoExtensions,
  mimeTypeForLogoExtension,
  openOrgLogoFile,
  saveOrgLogoFile,
  MAX_ORG_LOGO_BYTES,
} from './org-branding-files.util';
import {
  findOrganizationBranding,
  updateOrganizationBranding,
  updateOrganizationLogoFileName,
} from './org-branding.store';
import {
  isValidHexColor,
  normalizeOrgBranding,
  type OrgBranding,
} from './org-branding.types';

function rethrowBrandingStoreError(error: unknown): never {
  if (error instanceof Error && error.message.includes('Organization not found')) {
    throw new BadRequestException(error.message);
  }

  throw error;
}

@Injectable()
export class OrgBrandingService {
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
    const isAdmin = ORG_ADMIN_ROLES.includes(role as (typeof ORG_ADMIN_ROLES)[number]);

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

  private serializeBranding(branding: OrgBranding, hasLogo: boolean) {
    return {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      hasLogo,
      logoUrl: hasLogo ? '/organization/branding/logo' : null,
    };
  }

  async getBranding(request: Request) {
    const context = await this.getOrganizationContext(request);
    const branding = await findOrganizationBranding(context.organizationId);

    return this.serializeBranding(branding, Boolean(branding.logoFileName));
  }

  async updateBranding(
    request: Request,
    input: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
    },
  ) {
    const context = await this.requireAdmin(request);

    for (const [label, value] of [
      ['Primary', input.primaryColor],
      ['Secondary', input.secondaryColor],
      ['Accent', input.accentColor],
    ] as const) {
      if (!isValidHexColor(value)) {
        throw new BadRequestException(
          `${label} color must be a hex value like #34d399.`,
        );
      }
    }

    try {
      const branding = await updateOrganizationBranding(context.organizationId, {
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        accentColor: input.accentColor,
      });

      return this.serializeBranding(branding, Boolean(branding.logoFileName));
    } catch (error) {
      rethrowBrandingStoreError(error);
    }
  }

  async uploadLogo(request: Request, file?: Express.Multer.File) {
    const context = await this.requireAdmin(request);

    if (!file) {
      throw new BadRequestException('Logo file is required.');
    }

    if (file.size > MAX_ORG_LOGO_BYTES) {
      throw new BadRequestException('Logo must be 2MB or smaller.');
    }

    const extension = getOrgLogoExtension(file.originalname);

    if (!extension) {
      throw new BadRequestException(
        `Logo must be one of: ${getAllowedOrgLogoExtensions().join(', ')}`,
      );
    }

    const existing = await findOrganizationBranding(context.organizationId);

    if (existing.logoFileName) {
      await deleteOrgLogoFile({
        organizationId: context.organizationId,
        storedFileName: existing.logoFileName,
      });
    }

    const storedFileName = `${randomBytes(8).toString('hex')}${extension}`;

    await saveOrgLogoFile({
      organizationId: context.organizationId,
      storedFileName,
      buffer: file.buffer,
    });

    try {
      const branding = await updateOrganizationLogoFileName(
        context.organizationId,
        storedFileName,
      );

      return this.serializeBranding(branding, true);
    } catch (error) {
      rethrowBrandingStoreError(error);
    }
  }

  async removeLogo(request: Request) {
    const context = await this.requireAdmin(request);
    const existing = await findOrganizationBranding(context.organizationId);

    if (existing.logoFileName) {
      await deleteOrgLogoFile({
        organizationId: context.organizationId,
        storedFileName: existing.logoFileName,
      });
    }

    try {
      const branding = await updateOrganizationLogoFileName(
        context.organizationId,
        null,
      );

      return this.serializeBranding(branding, false);
    } catch (error) {
      rethrowBrandingStoreError(error);
    }
  }

  async getLogoFile(request: Request) {
    const context = await this.getOrganizationContext(request);
    const branding = await findOrganizationBranding(context.organizationId);

    if (!branding.logoFileName) {
      throw new NotFoundException('Organization logo not found.');
    }

    const file = openOrgLogoFile({
      organizationId: context.organizationId,
      storedFileName: branding.logoFileName,
    });

    if (!file.exists) {
      throw new NotFoundException('Organization logo file missing.');
    }

    const extension = getOrgLogoExtension(branding.logoFileName) ?? '.png';

    return {
      stream: file.stream,
      mimeType: mimeTypeForLogoExtension(extension),
      fileName: branding.logoFileName,
    };
  }

  normalizeIncomingBranding(input?: Partial<OrgBranding> | null) {
    return normalizeOrgBranding(input);
  }
}

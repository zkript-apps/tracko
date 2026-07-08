import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import type { PlanTier } from '../admin-invitations/admin-invitation.types';
import { PLAN_TIERS } from '../admin-invitations/admin-invitations.store';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformService } from './platform.service';

class CreateAdminInviteDto {
  email!: string;
  planTier!: PlanTier;
  paymentReference?: string;
}

@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly platformAuth: PlatformAuthService,
  ) {}

  @Get('bootstrap-status')
  @AllowAnonymous()
  bootstrapStatus() {
    return {
      bootstrapConfigured: Boolean(this.platformAuth.getBootstrapSecret()),
    };
  }

  @Get('overview')
  overview(@Req() request: Request) {
    return this.platform.getOverview(request);
  }

  @Get('organizations')
  organizations(@Req() request: Request) {
    return this.platform.listOrganizations(request);
  }

  @Get('admin-invitations')
  adminInvitations(@Req() request: Request) {
    return this.platform.listAdminInvitations(request);
  }

  @Post('admin-invitations')
  createAdminInvitation(
    @Req() request: Request,
    @Body() body: CreateAdminInviteDto,
  ) {
    if (!body.email?.trim()) {
      throw new BadRequestException('Email is required.');
    }

    if (!PLAN_TIERS.includes(body.planTier)) {
      throw new BadRequestException('Invalid plan tier.');
    }

    return this.platform.createAdminInvitation(request, {
      email: body.email.trim(),
      planTier: body.planTier,
      paymentReference: body.paymentReference?.trim(),
    });
  }
}

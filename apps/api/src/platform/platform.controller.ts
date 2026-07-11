import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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

class RejectInquiryDto {
  reason?: string;
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

  @Get('subscription-inquiries')
  listSubscriptionInquiries(@Req() request: Request) {
    return this.platform.listSubscriptionInquiries(request);
  }

  @Post('subscription-inquiries/:id/approve')
  approveSubscriptionInquiry(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    return this.platform.approveSubscriptionInquiry(request, id);
  }

  @Post('subscription-inquiries/:id/reject')
  rejectSubscriptionInquiry(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: RejectInquiryDto,
  ) {
    return this.platform.rejectSubscriptionInquiry(request, id, body.reason);
  }

  @Get('subscriptions/pending')
  listPendingSubscriptions(@Req() request: Request) {
    return this.platform.listPendingSubscriptions(request);
  }

  @Post('subscriptions/:organizationId/activate')
  activateSubscription(
    @Req() request: Request,
    @Param('organizationId') organizationId: string,
  ) {
    return this.platform.activateSubscription(request, organizationId);
  }

  @Post('subscriptions/:organizationId/reject')
  rejectSubscription(
    @Req() request: Request,
    @Param('organizationId') organizationId: string,
  ) {
    return this.platform.rejectSubscription(request, organizationId);
  }
}

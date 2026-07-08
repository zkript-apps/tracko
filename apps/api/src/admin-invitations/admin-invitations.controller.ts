import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { PLAN_TIERS } from './admin-invitations.store';
import { AdminInvitationsService } from './admin-invitations.service';
import type { PlanTier } from './admin-invitation.types';

class PaymentWebhookDto {
  email!: string;
  planTier!: PlanTier;
  paymentReference?: string;
}

@Controller('admin-invitations')
export class AdminInvitationsController {
  constructor(private readonly invitations: AdminInvitationsService) {}

  @Get('validate')
  @AllowAnonymous()
  validate(@Query('token') token?: string) {
    if (!token) {
      throw new BadRequestException('Invitation token is required.');
    }

    return this.invitations.validateToken(token);
  }

  @Post('webhook/payment')
  @AllowAnonymous()
  async paymentWebhook(
    @Headers('x-payment-webhook-secret') secret: string | undefined,
    @Body() body: PaymentWebhookDto,
  ) {
    const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid payment webhook secret.');
    }

    if (!body.email?.trim()) {
      throw new BadRequestException('Email is required.');
    }

    if (!PLAN_TIERS.includes(body.planTier)) {
      throw new BadRequestException('Invalid plan tier.');
    }

    const { invitation, signupUrl } = await this.invitations.createFromPayment({
      email: body.email,
      planTier: body.planTier,
      paymentReference: body.paymentReference,
    });

    return {
      invitationToken: invitation.token,
      signupUrl,
      email: invitation.email,
      planTier: invitation.planTier,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }
}

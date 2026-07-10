import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { SubscriptionInquiriesService } from '../subscription-inquiries/subscription-inquiries.service';

class ScheduleFeatureChangeDto {
  featureId!: string;
  action!: 'add' | 'remove';
}

class ScheduleScaleChangeDto {
  scaleTier!: string;
}

class CreateSubscriptionInquiryDto {
  companyName!: string;
  contactName!: string;
  email!: string;
  phone!: string;
  message?: string;
  employeeCount!: number;
  selectedFeatures!: string[];
}

@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly inquiries: SubscriptionInquiriesService,
  ) {}

  @AllowAnonymous()
  @Get('billing/pricing-catalog')
  getPricingCatalog() {
    return this.inquiries.getPricingCatalog();
  }

  @AllowAnonymous()
  @Post('subscription-inquiries')
  createInquiry(@Body() body: CreateSubscriptionInquiryDto) {
    return this.inquiries.create(body);
  }

  @Get('billing/subscription')
  getSubscription(@Req() request: Request) {
    return this.billing.getSubscriptionForRequest(request);
  }

  @Post('billing/features')
  scheduleFeatureChange(
    @Req() request: Request,
    @Body() body: ScheduleFeatureChangeDto,
  ) {
    return this.billing.scheduleFeatureChange(
      request,
      body.featureId,
      body.action,
    );
  }

  @Post('billing/scale')
  scheduleScaleChange(
    @Req() request: Request,
    @Body() body: ScheduleScaleChangeDto,
  ) {
    return this.billing.scheduleScaleChange(request, body.scaleTier);
  }

  @Post('billing/demo/enable-all')
  enableAllForDemo(@Req() request: Request) {
    return this.billing.enableAllFeaturesForDemo(request);
  }

  @Delete('billing/features/pending/:changeId')
  cancelPendingChange(
    @Req() request: Request,
    @Param('changeId') changeId: string,
  ) {
    return this.billing.cancelPendingChange(request, changeId);
  }

  @Delete('billing/scale/pending')
  cancelPendingScaleChange(@Req() request: Request) {
    return this.billing.cancelPendingScaleChange(request);
  }
}

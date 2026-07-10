import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { OrganizationScaleService } from './organization-scale.service';
import { SubscriptionInquiriesService } from '../subscription-inquiries/subscription-inquiries.service';
import { WorkforceContextService } from '../workforce/workforce-context.service';
@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    OrganizationScaleService,
    SubscriptionInquiriesService,
    WorkforceContextService,
  ],
  exports: [BillingService, OrganizationScaleService],
})
export class BillingModule {}

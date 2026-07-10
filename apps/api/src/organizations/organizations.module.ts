import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OrgBrandingController } from './org-branding.controller';
import { OrgBrandingService } from './org-branding.service';
import { OrgProfileController } from './org-profile.controller';
import { OrgProfileService } from './org-profile.service';

@Module({
  imports: [BillingModule],
  controllers: [
    OnboardingController,
    OrgBrandingController,
    OrgProfileController,
  ],
  providers: [OnboardingService, OrgBrandingService, OrgProfileService],
  exports: [OnboardingService, OrgBrandingService, OrgProfileService],
})
export class OrganizationsModule {}

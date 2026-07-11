import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [BillingModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformAuthService],
})
export class PlatformModule {}

import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [BillingModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}

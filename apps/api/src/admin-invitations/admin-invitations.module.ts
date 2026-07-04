import { Module } from '@nestjs/common';
import { AdminInvitationsController } from './admin-invitations.controller';
import { AdminInvitationsService } from './admin-invitations.service';

@Module({
  controllers: [AdminInvitationsController],
  providers: [AdminInvitationsService],
  exports: [AdminInvitationsService],
})
export class AdminInvitationsModule {}

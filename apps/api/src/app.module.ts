import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminInvitationsModule } from './admin-invitations/admin-invitations.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { OrganizationsModule } from './organizations/organizations.module';
import { EmailModule } from './email/email.module';
import { PlatformModule } from './platform/platform.module';
import { TeamModule } from './team/team.module';
import { WorkforceModule } from './workforce/workforce.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    EmailModule,
    AdminInvitationsModule,
    OrganizationsModule,
    PlatformModule,
    TeamModule,
    WorkforceModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

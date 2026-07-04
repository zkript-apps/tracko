import { Global, Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { createAuth } from './auth';

@Global()
@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      useFactory: async () => ({
        auth: await createAuth(),
      }),
    }),
  ],
  exports: [BetterAuthModule],
})
export class AuthModule {}

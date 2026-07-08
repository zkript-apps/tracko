import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

export const SUPER_ADMIN_ROLE = 'super_admin';

@Injectable()
export class PlatformAuthService {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly authService: AuthService<any>,
  ) {}

  headersFrom(request: Request) {
    return fromNodeHeaders(request.headers);
  }

  getBootstrapSecret(): string | undefined {
    return process.env.PLATFORM_BOOTSTRAP_SECRET;
  }

  isValidBootstrapSecret(secret: string | undefined): boolean {
    const expected = this.getBootstrapSecret();
    return Boolean(expected && secret && secret === expected);
  }

  async requireSuperAdmin(request: Request) {
    const headers = this.headersFrom(request);
    const session = await this.authService.api.getSession({ headers });

    if (!session?.user) {
      throw new UnauthorizedException('Sign in required.');
    }

    if (session.user.platformRole !== SUPER_ADMIN_ROLE) {
      throw new ForbiddenException('Super admin access required.');
    }

    return session;
  }
}

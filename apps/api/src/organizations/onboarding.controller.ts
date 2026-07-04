import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { OnboardingService } from './onboarding.service';
import type { CompleteOnboardingInput } from './organization.types';

@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly authService: AuthService<any>,
  ) {}

  @Get('status')
  async status(@Req() request: Request) {
    const headers = fromNodeHeaders(request.headers);
    return this.onboarding.getStatusForSession(headers);
  }

  @Post('complete')
  async complete(
    @Req() request: Request,
    @Body() body: CompleteOnboardingInput,
  ) {
    if (!body.name?.trim()) {
      throw new BadRequestException('Organization name is required.');
    }

    if (!body.branches?.length) {
      throw new BadRequestException('Add at least one branch.');
    }

    for (const branch of body.branches) {
      if (!branch.name?.trim()) {
        throw new BadRequestException('Each branch needs a name.');
      }
    }

    const headers = fromNodeHeaders(request.headers);
    const organizations = await this.authService.api.listOrganizations({
      headers,
    });

    if (organizations.length > 0) {
      throw new BadRequestException('Organization already exists.');
    }

    return this.onboarding.complete(headers, body);
  }
}

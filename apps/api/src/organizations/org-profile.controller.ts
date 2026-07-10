import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OrgProfileService } from './org-profile.service';

class UpdateOrganizationProfileDto {
  name!: string;
  description?: string | null;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  timezone?: string | null;
}

@Controller('organization/profile')
export class OrgProfileController {
  constructor(private readonly profile: OrgProfileService) {}

  @Get()
  getProfile(@Req() request: Request) {
    return this.profile.getProfile(request);
  }

  @Put()
  updateProfile(
    @Req() request: Request,
    @Body() body: UpdateOrganizationProfileDto,
  ) {
    return this.profile.updateProfile(request, body);
  }
}

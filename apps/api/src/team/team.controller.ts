import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { getPublicOrgInvitationDetails } from '../org-invitations/org-invitations.store';
import { TeamService } from './team.service';

class InviteHrDto {
  email!: string;
  branchId!: string;
}

class InviteEmployeeDto {
  email!: string;
  branchId?: string;
}

@Controller()
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('org-invitations/validate')
  @AllowAnonymous()
  validateOrgInvitation(@Query('id') id?: string) {
    if (!id) {
      throw new BadRequestException('Invitation id is required.');
    }

    return getPublicOrgInvitationDetails(id);
  }

  @Get('branches')
  listBranches(@Req() request: Request) {
    return this.team.listBranches(request);
  }

  @Get('team/overview')
  overview(@Req() request: Request) {
    return this.team.getOverview(request);
  }

  @Post('team/invite-hr')
  inviteHr(@Req() request: Request, @Body() body: InviteHrDto) {
    if (!body.email?.trim()) {
      throw new BadRequestException('Email is required.');
    }

    if (!body.branchId?.trim()) {
      throw new BadRequestException('Branch is required.');
    }

    return this.team.inviteHr(request, {
      email: body.email.trim(),
      branchId: body.branchId.trim(),
    });
  }

  @Post('team/invite-employee')
  inviteEmployee(@Req() request: Request, @Body() body: InviteEmployeeDto) {
    if (!body.email?.trim()) {
      throw new BadRequestException('Email is required.');
    }

    return this.team.inviteEmployee(request, {
      email: body.email.trim(),
      branchId: body.branchId?.trim(),
    });
  }
}

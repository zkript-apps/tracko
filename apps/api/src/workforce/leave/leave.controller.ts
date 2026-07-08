import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { LEAVE_TYPES, type LeaveType } from './leave.store';
import { LeaveService } from './leave.service';
import { EmployeesService } from '../employees/employees.service';

class CreateLeaveDto {
  leaveType!: LeaveType;
  startDate!: string;
  endDate!: string;
  reason!: string;
}

class ReviewLeaveDto {
  reviewNote?: string;
}

@Controller('leave')
export class LeaveController {
  constructor(
    private readonly leave: LeaveService,
    private readonly employees: EmployeesService,
  ) {}

  @Post('requests')
  create(@Req() request: Request, @Body() body: CreateLeaveDto) {
    if (!body.leaveType || !LEAVE_TYPES.includes(body.leaveType)) {
      throw new BadRequestException('Invalid leave type.');
    }

    return this.leave.createRequest(request, body);
  }

  @Get('requests/me')
  listMine(@Req() request: Request) {
    return this.leave.listMyRequests(request);
  }

  @Get('balances/me')
  myBalances(
    @Req() request: Request,
    @Query('periodYear') periodYear?: string,
  ) {
    const year = periodYear ? Number(periodYear) : undefined;

    if (year !== undefined && (!Number.isInteger(year) || year < 2000)) {
      throw new BadRequestException('Invalid period year.');
    }

    return this.employees.getMyLeaveBalances(request, year);
  }

  @Get('requests')
  listManaged(@Req() request: Request, @Query('status') status?: string) {
    return this.leave.listManagedRequests(request, status);
  }

  @Post('requests/:id/approve')
  approve(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: ReviewLeaveDto,
  ) {
    return this.leave.reviewRequest(request, id, 'approve', body.reviewNote);
  }

  @Post('requests/:id/reject')
  reject(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: ReviewLeaveDto,
  ) {
    return this.leave.reviewRequest(request, id, 'reject', body.reviewNote);
  }

  @Post('requests/:id/cancel')
  cancel(@Req() request: Request, @Param('id') id: string) {
    return this.leave.cancelMyRequest(request, id);
  }
}

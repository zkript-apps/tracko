import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  BALANCE_LEAVE_TYPES,
  type BalanceLeaveType,
} from './leave-balances.store';
import {
  EMPLOYMENT_TYPES,
  PAY_RATE_TYPES,
  type EmploymentType,
  type PayRateType,
} from './employee-profiles.store';
import { EmployeesService } from './employees.service';

class UpdateProfileDto {
  employmentType?: EmploymentType;
  jobTitle?: string;
  hireDate?: string;
  contractStartDate?: string;
  contractEndDate?: string | null;
  probationEndDate?: string | null;
  notes?: string | null;
}

class LeaveBalanceEntryDto {
  leaveType!: BalanceLeaveType;
  entitledDays!: number;
}

class UpdateLeaveBalancesDto {
  periodYear?: number;
  balances!: LeaveBalanceEntryDto[];
}

class UpdateWorkScheduleDto {
  weeklyRestDays?: number[];
  workStartTime?: string;
  workEndTime?: string;
  extraDayOffDates?: string[];
}

class UpdateCompensationDto {
  payRateType!: PayRateType | null;
  payRateAmount!: number | null;
}

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(
    @Req() request: Request,
    @Query('periodYear') periodYear?: string,
  ) {
    const year = periodYear ? Number(periodYear) : undefined;

    if (year !== undefined && (!Number.isInteger(year) || year < 2000)) {
      throw new BadRequestException('Invalid period year.');
    }

    return this.employees.listEmployees(request, year);
  }

  @Get(':userId')
  getOne(
    @Req() request: Request,
    @Param('userId') userId: string,
    @Query('periodYear') periodYear?: string,
  ) {
    const year = periodYear ? Number(periodYear) : undefined;

    if (year !== undefined && (!Number.isInteger(year) || year < 2000)) {
      throw new BadRequestException('Invalid period year.');
    }

    return this.employees.getEmployee(request, userId, year);
  }

  @Patch(':userId/profile')
  updateProfile(
    @Req() request: Request,
    @Param('userId') userId: string,
    @Body() body: UpdateProfileDto,
  ) {
    if (
      body.employmentType &&
      !EMPLOYMENT_TYPES.includes(body.employmentType)
    ) {
      throw new BadRequestException('Invalid employment type.');
    }

    return this.employees.updateProfile(request, userId, body);
  }

  @Put(':userId/leave-balances')
  updateLeaveBalances(
    @Req() request: Request,
    @Param('userId') userId: string,
    @Body() body: UpdateLeaveBalancesDto,
  ) {
    if (!Array.isArray(body.balances)) {
      throw new BadRequestException('Balances must be an array.');
    }

    for (const entry of body.balances) {
      if (!BALANCE_LEAVE_TYPES.includes(entry.leaveType)) {
        throw new BadRequestException('Invalid leave type for balance.');
      }
    }

    return this.employees.updateLeaveBalances(request, userId, body);
  }

  @Patch(':userId/work-schedule')
  updateWorkSchedule(
    @Req() request: Request,
    @Param('userId') userId: string,
    @Body() body: UpdateWorkScheduleDto,
  ) {
    return this.employees.updateWorkSchedule(request, userId, body);
  }

  @Patch(':userId/compensation')
  updateCompensation(
    @Req() request: Request,
    @Param('userId') userId: string,
    @Body() body: UpdateCompensationDto,
  ) {
    if (body.payRateType && !PAY_RATE_TYPES.includes(body.payRateType)) {
      throw new BadRequestException('Invalid pay rate type.');
    }

    if (body.payRateAmount !== null && body.payRateAmount !== undefined) {
      if (!Number.isFinite(body.payRateAmount)) {
        throw new BadRequestException('Pay rate amount must be a number.');
      }
    }

    return this.employees.updateCompensation(request, userId, {
      payRateType: body.payRateType ?? null,
      payRateAmount: body.payRateAmount ?? null,
    });
  }
}

import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AttendanceService } from './attendance.service';

class ClockDto {
  latitude?: number;
  longitude?: number;
}

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('me/status')
  myStatus(@Req() request: Request) {
    return this.attendance.getMyStatus(request);
  }

  @Post('me/clock-in')
  clockIn(@Req() request: Request, @Body() body: ClockDto) {
    return this.attendance.clockIn(request, body);
  }

  @Post('me/clock-out')
  clockOut(@Req() request: Request, @Body() body: ClockDto) {
    return this.attendance.clockOut(request, body);
  }

  @Get('branch/overview')
  branchOverview(@Req() request: Request, @Query('branchId') branchId?: string) {
    return this.attendance.getBranchOverview(request, branchId);
  }
}

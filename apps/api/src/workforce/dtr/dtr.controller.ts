import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DtrService } from './dtr.service';

@Controller('dtr')
export class DtrController {
  constructor(private readonly dtr: DtrService) {}

  @Get('me')
  myRecords(
    @Req() request: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dtr.getMyRecords(request, startDate, endDate);
  }

  @Get('overview')
  overview(
    @Req() request: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.dtr.getOverview(request, {
      startDate,
      endDate,
      branchId,
      userId,
    });
  }
}

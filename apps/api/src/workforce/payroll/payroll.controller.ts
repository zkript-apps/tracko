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
import { PayrollService } from './payroll.service';

class CreatePayrollRunDto {
  startDate!: string;
  endDate!: string;
  branchId?: string;
}

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('preview')
  preview(
    @Req() request: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.payroll.preview(request, { startDate, endDate, branchId });
  }

  @Get('runs')
  listRuns(@Req() request: Request) {
    return this.payroll.listRuns(request);
  }

  @Get('runs/:id')
  getRun(@Req() request: Request, @Param('id') id: string) {
    return this.payroll.getRun(request, id);
  }

  @Post('runs')
  createRun(@Req() request: Request, @Body() body: CreatePayrollRunDto) {
    if (!body.startDate || !body.endDate) {
      throw new BadRequestException('Start and end dates are required.');
    }

    return this.payroll.createRun(request, body);
  }

  @Post('runs/:id/finalize')
  finalizeRun(@Req() request: Request, @Param('id') id: string) {
    return this.payroll.finalizeRun(request, id);
  }
}

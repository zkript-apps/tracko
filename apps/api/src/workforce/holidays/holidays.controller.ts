import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  STATUTORY_HOLIDAY_TYPES,
  type StatutoryHolidayType,
} from './holiday-type.util';
import { HolidaysService } from './holidays.service';

class CreateHolidayDto {
  date!: string;
  name!: string;
  holidayType!: StatutoryHolidayType;
  branchId?: string | null;
}

class UpdateHolidayDto {
  name?: string;
  holidayType?: StatutoryHolidayType;
  branchId?: string | null;
}

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  list(
    @Req() request: Request,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('Start and end dates are required.');
    }

    return this.holidays.list(request, { startDate, endDate, branchId });
  }

  @Get('ph-public')
  phPublic(@Req() request: Request, @Query('year') year?: string) {
    const parsedYear = year ? Number(year) : new Date().getFullYear();

    if (!Number.isInteger(parsedYear)) {
      throw new BadRequestException('Invalid year.');
    }

    return this.holidays.getPhilippinesPublicHolidays(request, parsedYear);
  }

  @Post()
  create(@Req() request: Request, @Body() body: CreateHolidayDto) {
    if (!body.date || !body.name || !body.holidayType) {
      throw new BadRequestException('Date, name, and holiday type are required.');
    }

    if (!STATUTORY_HOLIDAY_TYPES.includes(body.holidayType)) {
      throw new BadRequestException('Invalid holiday type.');
    }

    return this.holidays.create(request, body);
  }

  @Patch(':id')
  update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: UpdateHolidayDto,
  ) {
    if (
      body.holidayType &&
      !STATUTORY_HOLIDAY_TYPES.includes(body.holidayType)
    ) {
      throw new BadRequestException('Invalid holiday type.');
    }

    return this.holidays.update(request, id, body);
  }

  @Delete(':id')
  remove(@Req() request: Request, @Param('id') id: string) {
    return this.holidays.remove(request, id);
  }
}

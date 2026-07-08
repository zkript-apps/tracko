import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { isValidDateString } from '../employees/leave-days.util';
import { WorkforceContextService } from '../workforce-context.service';
import {
  classifyPhilippinesHoliday,
  resolveHolidayType,
  validateHolidayType,
  type StatutoryHolidayType,
} from './holiday-type.util';
import {
  createHoliday,
  deleteHoliday,
  findHolidayByDate,
  listHolidaysForOrganization,
  serializeHoliday,
  updateHoliday,
} from './holidays.store';
import {
  fetchPhilippinesPublicHolidays,
  serializePhilippinesPublicHoliday,
} from './ph-public-holidays.util';

@Injectable()
export class HolidaysService {
  constructor(private readonly workforce: WorkforceContextService) {}

  private async requireManager(request: Request) {
    const context = await this.workforce.getMemberContext(request);

    if (!context.canViewBranchAttendance) {
      throw new ForbiddenException('HR or admin access required.');
    }

    return context;
  }

  async list(
    request: Request,
    input: { startDate: string; endDate: string; branchId?: string },
  ) {
    const context = await this.requireManager(request);

    if (!isValidDateString(input.startDate) || !isValidDateString(input.endDate)) {
      throw new BadRequestException('Dates must use YYYY-MM-DD format.');
    }

    if (input.startDate > input.endDate) {
      throw new BadRequestException('Start date must be on or before end date.');
    }

    const branchId =
      input.branchId ??
      (context.isHr ? context.branchId ?? undefined : undefined);

    const holidays = await listHolidaysForOrganization({
      organizationId: context.organizationId,
      startDate: input.startDate,
      endDate: input.endDate,
      branchId,
    });

    return {
      startDate: input.startDate,
      endDate: input.endDate,
      branchId: branchId ?? null,
      holidays: holidays.map((holiday) => ({
        ...serializeHoliday(holiday),
        holidayType: resolveHolidayType(holiday),
      })),
    };
  }

  async create(
    request: Request,
    input: {
      date: string;
      name: string;
      holidayType: StatutoryHolidayType;
      branchId?: string | null;
    },
  ) {
    const context = await this.requireManager(request);

    if (!isValidDateString(input.date)) {
      throw new BadRequestException('Date must use YYYY-MM-DD format.');
    }

    if (!input.name.trim()) {
      throw new BadRequestException('Holiday name is required.');
    }

    let holidayType: StatutoryHolidayType;
    try {
      holidayType = validateHolidayType(input.holidayType);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid holiday type.',
      );
    }

    const branchId = context.isAdmin
      ? (input.branchId ?? null)
      : (context.branchId ?? null);

    const existing = await findHolidayByDate({
      organizationId: context.organizationId,
      date: input.date,
      branchId,
    });

    if (existing) {
      throw new BadRequestException(
        'A holiday already exists for this date and scope.',
      );
    }

    const holiday = await createHoliday({
      organizationId: context.organizationId,
      branchId,
      date: input.date,
      name: input.name,
      holidayType,
      createdBy: context.userId,
    });

    return {
      ...serializeHoliday(holiday),
      holidayType: resolveHolidayType(holiday),
    };
  }

  async update(
    request: Request,
    id: string,
    input: {
      name?: string;
      holidayType?: StatutoryHolidayType;
      branchId?: string | null;
    },
  ) {
    const context = await this.requireManager(request);

    if (input.name !== undefined && !input.name.trim()) {
      throw new BadRequestException('Holiday name is required.');
    }

    let holidayType: StatutoryHolidayType | undefined;
    if (input.holidayType) {
      try {
        holidayType = validateHolidayType(input.holidayType);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid holiday type.',
        );
      }
    }

    const branchId = context.isAdmin ? input.branchId : undefined;

    const updated = await updateHoliday({
      organizationId: context.organizationId,
      id,
      name: input.name,
      holidayType,
      branchId,
    });

    if (!updated) {
      throw new NotFoundException('Holiday not found.');
    }

    return {
      ...serializeHoliday(updated),
      holidayType: resolveHolidayType(updated),
    };
  }

  async remove(request: Request, id: string) {
    const context = await this.requireManager(request);
    const deleted = await deleteHoliday(context.organizationId, id);

    if (!deleted) {
      throw new NotFoundException('Holiday not found.');
    }

    return { success: true };
  }

  async getPhilippinesPublicHolidays(request: Request, year: number) {
    await this.requireManager(request);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Invalid year.');
    }

    const holidays = await fetchPhilippinesPublicHolidays(year);

    return {
      year,
      holidays: holidays.map((holiday) => ({
        ...serializePhilippinesPublicHoliday(holiday),
        holidayType: classifyPhilippinesHoliday(
          holiday.name,
          holiday.localName,
        ),
      })),
    };
  }
}

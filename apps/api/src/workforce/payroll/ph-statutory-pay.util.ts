import type { DtrSegment } from '../dtr/dtr.util';
import {
  isScheduledDayOff,
  type WorkSchedule,
} from '../employees/work-schedule.util';
import type { OrganizationHoliday } from '../holidays/holidays.store';
import { resolveHolidayType } from '../holidays/holiday-type.util';

export const STATUTORY_WORK_MINUTES = 8 * 60;

export const OT_HOURLY_MULTIPLIER = {
  ordinary: 1.25,
  rest_day: 1.69,
  special_holiday: 1.69,
  regular_holiday: 2.6,
} as const;

export const FIRST_BLOCK_MULTIPLIER = {
  ordinary: 1,
  rest_day: 1.3,
  special_holiday: 1.3,
  regular_holiday: 2,
} as const;

export type StatutoryDayContext =
  | 'ordinary'
  | 'rest_day'
  | 'special_holiday'
  | 'regular_holiday';

export type StatutoryDayPay = {
  regularPay: number;
  overtimePay: number;
  holidayPay: number;
  nightDiffPay: number;
  regularMinutes: number;
  overtimeMinutes: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resolveStatutoryHourlyRate(input: {
  payRateType: 'hourly' | 'monthly';
  payRateAmount: number;
  dailyRate: number | null;
}): number {
  if (input.payRateType === 'hourly') {
    return input.payRateAmount;
  }

  const dailyRate = input.dailyRate ?? 0;
  return dailyRate / 8;
}

export function resolveStatutoryDayContext(input: {
  date: string;
  schedule: WorkSchedule;
  holiday: OrganizationHoliday | null | undefined;
}): StatutoryDayContext {
  const holidayType = input.holiday
    ? resolveHolidayType(input.holiday)
    : null;

  if (holidayType === 'regular') {
    return 'regular_holiday';
  }

  if (holidayType === 'special_non_working') {
    return 'special_holiday';
  }

  if (isScheduledDayOff(input.date, input.schedule)) {
    return 'rest_day';
  }

  return 'ordinary';
}

function isNightMinute(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

export function countNightShiftMinutes(segments: DtrSegment[]): number {
  let total = 0;

  for (const segment of segments) {
    if (!segment.timeOut) {
      continue;
    }

    const start = new Date(segment.timeIn);
    const end = new Date(segment.timeOut);
    const cursor = new Date(start);

    while (cursor < end) {
      if (isNightMinute(cursor)) {
        total += 1;
      }
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
  }

  return total;
}

export function computeStatutoryWorkedDayPay(input: {
  workedMinutes: number;
  segments: DtrSegment[];
  hourlyRate: number;
  context: StatutoryDayContext;
}): StatutoryDayPay {
  const regularMinutes = Math.min(
    input.workedMinutes,
    STATUTORY_WORK_MINUTES,
  );
  const overtimeMinutes = Math.max(
    0,
    input.workedMinutes - STATUTORY_WORK_MINUTES,
  );
  const regularHours = regularMinutes / 60;
  const overtimeHours = overtimeMinutes / 60;
  const firstBlockMultiplier = FIRST_BLOCK_MULTIPLIER[input.context];
  const otMultiplier = OT_HOURLY_MULTIPLIER[input.context];

  const totalRegularBlockPay =
    regularHours * input.hourlyRate * firstBlockMultiplier;
  const baseRegularPay = regularHours * input.hourlyRate;
  const holidayPay = roundMoney(
    Math.max(0, totalRegularBlockPay - baseRegularPay),
  );
  const overtimePay = roundMoney(
    overtimeHours * input.hourlyRate * otMultiplier,
  );
  const nightMinutes = countNightShiftMinutes(input.segments);
  const nightDiffPay = roundMoney(
    (nightMinutes / 60) * input.hourlyRate * 0.1,
  );

  return {
    regularPay: roundMoney(baseRegularPay),
    overtimePay,
    holidayPay,
    nightDiffPay,
    regularMinutes,
    overtimeMinutes,
  };
}

export function computeUnworkedRegularHolidayPay(dailyRate: number): number {
  return roundMoney(dailyRate);
}

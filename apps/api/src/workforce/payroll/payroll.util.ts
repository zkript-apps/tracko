import type { DailyTimeRecord } from '../dtr/dtr.util';
import { enumerateDates } from '../dtr/dtr.util';
import type { PayRate } from '../employees/pay-rate.util';
import {
  countScheduledWorkDays,
  isScheduledDayOff,
  scheduledMinutesPerDay,
  type WorkSchedule,
} from '../employees/work-schedule.util';
import type { OrganizationHoliday } from '../holidays/holidays.store';
import type { LeaveRequest } from '../leave/leave.store';
import {
  computeStatutoryWorkedDayPay,
  computeUnworkedRegularHolidayPay,
  resolveStatutoryDayContext,
  resolveStatutoryHourlyRate,
} from './ph-statutory-pay.util';

export type PayrollLineItem = {
  userId: string;
  name: string;
  email: string;
  payRate: { type: 'hourly' | 'monthly'; amount: number } | null;
  scheduledWorkDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  dayOffDays: number;
  holidayDays: number;
  regularMinutes: number;
  overtimeMinutes: number;
  dailyRate: number | null;
  hourlyRate: number | null;
  regularPay: number;
  overtimePay: number;
  holidayPay: number;
  nightDiffPay: number;
  absentDeduction: number;
  grossPay: number;
  warnings: string[];
};

export type PayrollTotals = {
  employeeCount: number;
  totalGrossPay: number;
  totalRegularPay: number;
  totalOvertimePay: number;
  totalHolidayPay: number;
  totalNightDiffPay: number;
  totalAbsentDeduction: number;
  employeesMissingPayRate: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildApprovedLeaveDates(
  requests: LeaveRequest[],
  periodStart: string,
  periodEnd: string,
  schedule: WorkSchedule,
): { paid: Set<string>; unpaid: Set<string> } {
  const paid = new Set<string>();
  const unpaid = new Set<string>();

  for (const request of requests) {
    const rangeStart =
      request.startDate < periodStart ? periodStart : request.startDate;
    const rangeEnd =
      request.endDate > periodEnd ? periodEnd : request.endDate;
    const target = request.leaveType === 'unpaid' ? unpaid : paid;

    for (const date of enumerateDates(rangeStart, rangeEnd)) {
      if (!isScheduledDayOff(date, schedule)) {
        target.add(date);
      }
    }
  }

  return { paid, unpaid };
}

export function buildHolidayMap(
  holidays: OrganizationHoliday[],
  branchId: string,
): Map<string, OrganizationHoliday> {
  const map = new Map<string, OrganizationHoliday>();

  for (const holiday of holidays) {
    const existing = map.get(holiday.date);
    if (!existing) {
      map.set(holiday.date, holiday);
      continue;
    }

    if (holiday.branchId === branchId && existing.branchId !== branchId) {
      map.set(holiday.date, holiday);
    }
  }

  return map;
}

function computePaidLeaveDayPay(input: {
  payRate: PayRate;
  shiftMinutes: number;
  dailyRate: number | null;
  hourlyRate: number;
}): number {
  if (input.payRate.type === 'hourly') {
    return roundMoney((input.shiftMinutes / 60) * input.payRate.amount);
  }

  return roundMoney(input.dailyRate ?? 0);
}

export function computePayrollLineItem(input: {
  userId: string;
  name: string;
  email: string;
  payRate: PayRate | null;
  records: DailyTimeRecord[];
  schedule: WorkSchedule;
  paidLeaveDates: Set<string>;
  unpaidLeaveDates: Set<string>;
  holidays: Map<string, OrganizationHoliday>;
}): PayrollLineItem {
  const warnings: string[] = [];
  const payRate = input.payRate;

  if (!payRate) {
    warnings.push('Pay rate is not set.');
  }

  const dates = input.records.map((record) => record.date);
  const scheduledWorkDays = countScheduledWorkDays(dates, input.schedule);
  const shiftMinutes = scheduledMinutesPerDay(input.schedule);

  const dailyRate =
    payRate?.type === 'monthly' && scheduledWorkDays > 0
      ? payRate.amount / scheduledWorkDays
      : null;
  const hourlyRate = payRate
    ? resolveStatutoryHourlyRate({
        payRateType: payRate.type,
        payRateAmount: payRate.amount,
        dailyRate,
      })
    : null;

  let presentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  let dayOffDays = 0;
  let holidayDays = 0;
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let regularPay = 0;
  let overtimePay = 0;
  let holidayPay = 0;
  let nightDiffPay = 0;

  for (const record of input.records) {
    const orgHoliday = input.holidays.get(record.date) ?? null;
    const dayContext = resolveStatutoryDayContext({
      date: record.date,
      schedule: input.schedule,
      holiday: orgHoliday,
    });
    const isRestDay = isScheduledDayOff(record.date, input.schedule);

    if (record.status === 'day_off') {
      dayOffDays += 1;
      continue;
    }

    if (input.paidLeaveDates.has(record.date)) {
      paidLeaveDays += 1;
      if (payRate && hourlyRate !== null) {
        regularPay += computePaidLeaveDayPay({
          payRate,
          shiftMinutes,
          dailyRate,
          hourlyRate,
        });
      }
      continue;
    }

    if (input.unpaidLeaveDates.has(record.date)) {
      unpaidLeaveDays += 1;
      continue;
    }

    if (
      record.status === 'absent' &&
      dayContext === 'regular_holiday' &&
      !isRestDay &&
      payRate &&
      dailyRate !== null
    ) {
      holidayDays += 1;
      holidayPay += computeUnworkedRegularHolidayPay(dailyRate);
      continue;
    }

    if (record.status === 'absent') {
      absentDays += 1;
      continue;
    }

    if (
      record.workedMinutes > 0 ||
      record.status === 'complete' ||
      record.status === 'incomplete' ||
      record.status === 'in_progress'
    ) {
      presentDays += 1;

      if (!payRate || hourlyRate === null) {
        continue;
      }

      const dayPay = computeStatutoryWorkedDayPay({
        workedMinutes: record.workedMinutes,
        segments: record.segments,
        hourlyRate,
        context: dayContext,
      });

      regularMinutes += dayPay.regularMinutes;
      overtimeMinutes += dayPay.overtimeMinutes;
      regularPay += dayPay.regularPay;
      overtimePay += dayPay.overtimePay;
      holidayPay += dayPay.holidayPay;
      nightDiffPay += dayPay.nightDiffPay;

      if (dayContext === 'regular_holiday' || dayContext === 'special_holiday') {
        holidayDays += 1;
      }
    }
  }

  regularPay = roundMoney(regularPay);
  overtimePay = roundMoney(overtimePay);
  holidayPay = roundMoney(holidayPay);
  nightDiffPay = roundMoney(nightDiffPay);
  const absentDeduction = dailyRate
    ? roundMoney(dailyRate * (absentDays + unpaidLeaveDays))
    : payRate?.type === 'hourly' && hourlyRate !== null
      ? roundMoney((shiftMinutes / 60) * hourlyRate * (absentDays + unpaidLeaveDays))
      : 0;
  const grossPay = roundMoney(
    regularPay + overtimePay + holidayPay + nightDiffPay,
  );

  return {
    userId: input.userId,
    name: input.name,
    email: input.email,
    payRate,
    scheduledWorkDays,
    presentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    dayOffDays,
    holidayDays,
    regularMinutes,
    overtimeMinutes,
    dailyRate: dailyRate ? roundMoney(dailyRate) : null,
    hourlyRate: hourlyRate !== null ? roundMoney(hourlyRate) : null,
    regularPay,
    overtimePay,
    holidayPay,
    nightDiffPay,
    absentDeduction,
    grossPay,
    warnings,
  };
}

export function computePayrollTotals(entries: PayrollLineItem[]): PayrollTotals {
  return {
    employeeCount: entries.length,
    totalGrossPay: roundMoney(
      entries.reduce((sum, entry) => sum + entry.grossPay, 0),
    ),
    totalRegularPay: roundMoney(
      entries.reduce((sum, entry) => sum + entry.regularPay, 0),
    ),
    totalOvertimePay: roundMoney(
      entries.reduce((sum, entry) => sum + entry.overtimePay, 0),
    ),
    totalHolidayPay: roundMoney(
      entries.reduce((sum, entry) => sum + entry.holidayPay, 0),
    ),
    totalNightDiffPay: roundMoney(
      entries.reduce((sum, entry) => sum + entry.nightDiffPay, 0),
    ),
    totalAbsentDeduction: roundMoney(
      entries.reduce((sum, entry) => sum + entry.absentDeduction, 0),
    ),
    employeesMissingPayRate: entries.filter((entry) => !entry.payRate).length,
  };
}

import type { LeavePolicyInput, LeavePeriod, LeaveResetType } from './leave-policy.types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function compareDates(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function resolveCalendarPeriod(referenceDate: string): LeavePeriod {
  const { year } = parseDate(referenceDate);
  return {
    periodKey: String(year),
    periodYear: year,
    periodStart: formatDate(year, 1, 1),
    periodEnd: formatDate(year, 12, 31),
  };
}

function resolveAnniversaryPeriod(
  referenceDate: string,
  hireDate: string,
): LeavePeriod {
  const hire = parseDate(hireDate);
  const reference = parseDate(referenceDate);
  const anniversaryDay = clampDay(
    reference.year,
    hire.month,
    hire.day,
  );

  let periodStartYear = reference.year;
  const anniversaryThisYear = formatDate(
    reference.year,
    hire.month,
    anniversaryDay,
  );

  if (compareDates(referenceDate, anniversaryThisYear) < 0) {
    periodStartYear -= 1;
  }

  const periodStartDay = clampDay(periodStartYear, hire.month, hire.day);
  const periodStart = formatDate(periodStartYear, hire.month, periodStartDay);
  const periodEnd = addDays(
    formatDate(periodStartYear + 1, hire.month, hire.day),
    -1,
  );

  return {
    periodKey: `ann-${periodStartYear}`,
    periodYear: periodStartYear,
    periodStart,
    periodEnd,
  };
}

function resolveFiscalPeriod(
  referenceDate: string,
  fiscalYearStartMonth: number,
): LeavePeriod {
  const reference = parseDate(referenceDate);
  let fiscalStartYear = reference.year;

  if (reference.month < fiscalYearStartMonth) {
    fiscalStartYear -= 1;
  }

  const periodStart = formatDate(fiscalStartYear, fiscalYearStartMonth, 1);
  const nextFiscalStartYear =
    fiscalYearStartMonth === 1 ? fiscalStartYear + 1 : fiscalStartYear + 1;
  const periodEnd = addDays(
    formatDate(nextFiscalStartYear, fiscalYearStartMonth, 1),
    -1,
  );
  const fiscalEndYear = parseDate(periodEnd).year;

  return {
    periodKey: `fy-${fiscalEndYear}`,
    periodYear: fiscalEndYear,
    periodStart,
    periodEnd,
  };
}

export function resolveLeavePeriod(
  referenceDate: string,
  policy: Pick<LeavePolicyInput, 'resetType' | 'fiscalYearStartMonth'>,
  hireDate?: string,
): LeavePeriod {
  if (policy.resetType === 'anniversary' && hireDate) {
    return resolveAnniversaryPeriod(referenceDate, hireDate);
  }

  if (policy.resetType === 'fiscal') {
    return resolveFiscalPeriod(referenceDate, policy.fiscalYearStartMonth);
  }

  return resolveCalendarPeriod(referenceDate);
}

export function resolvePreviousLeavePeriod(
  period: LeavePeriod,
  policy: Pick<LeavePolicyInput, 'resetType' | 'fiscalYearStartMonth'>,
  hireDate?: string,
): LeavePeriod {
  const dayBefore = addDays(period.periodStart, -1);
  return resolveLeavePeriod(dayBefore, policy, hireDate);
}

export function monthsBetween(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  let months =
    (end.year - start.year) * 12 + (end.month - start.month);

  if (end.day < start.day) {
    months -= 1;
  }

  return months;
}

export function hasSilTenure(
  hireDate: string,
  asOfDate: string,
  tenureMonths: number,
): boolean {
  return monthsBetween(hireDate, asOfDate) >= tenureMonths;
}

export function formatResetTypeLabel(resetType: LeaveResetType): string {
  switch (resetType) {
    case 'calendar':
      return 'Calendar year';
    case 'anniversary':
      return 'Hire-date anniversary';
    case 'fiscal':
      return 'Fiscal year';
    default:
      return resetType;
  }
}

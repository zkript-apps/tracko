import { compareDates } from './leave-period.util';
import {
  DEFAULT_LEAVE_ACCRUAL,
  type LeaveAccrualMethod,
  type LeaveAccrualSettings,
  type LeavePeriod,
  type LeavePolicyInput,
} from './leave-policy.types';

function parseDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function formatDate(year: number, month: number, day: number): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function countInclusiveMonths(
  startDate: string,
  endDate: string,
): number {
  if (compareDates(startDate, endDate) > 0) {
    return 0;
  }

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  return (
    (end.year - start.year) * 12 +
    (end.month - start.month) +
    1
  );
}

function resolveMonthlyCutoffAccrualStart(
  hireDate: string,
  cutoffDay: number,
): string {
  const hire = parseDate(hireDate);
  const clampedCutoff = Math.min(Math.max(cutoffDay, 1), 28);

  if (hire.day <= clampedCutoff) {
    return formatDate(hire.year, hire.month, 1);
  }

  let month = hire.month + 1;
  let year = hire.year;

  if (month > 12) {
    month = 1;
    year += 1;
  }

  return formatDate(year, month, 1);
}

function roundLeaveDays(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeLeaveAccrual(
  policy: Pick<LeavePolicyInput, 'accrual'>,
): LeaveAccrualSettings {
  return policy.accrual ?? DEFAULT_LEAVE_ACCRUAL;
}

export function computeProratedGrantDays(input: {
  annualDays: number;
  hireDate?: string;
  period: LeavePeriod;
  policy: LeavePolicyInput;
}): number {
  if (input.annualDays <= 0) {
    return 0;
  }

  if (!input.hireDate) {
    return 0;
  }

  const accrual = normalizeLeaveAccrual(input.policy);
  const hiredBeforeOrOnPeriodStart =
    compareDates(input.hireDate, input.period.periodStart) <= 0;

  if (
    accrual.method === 'no_proration' ||
    accrual.method === 'anniversary_full' ||
    hiredBeforeOrOnPeriodStart
  ) {
    return input.annualDays;
  }

  const serviceStart = input.hireDate;

  switch (accrual.method) {
    case 'straight_line_monthly': {
      const months = countInclusiveMonths(serviceStart, input.period.periodEnd);
      return roundLeaveDays((input.annualDays / 12) * months);
    }
    case 'daily_precise': {
      const days = daysBetweenInclusive(serviceStart, input.period.periodEnd);
      return roundLeaveDays((input.annualDays / 365) * days);
    }
    case 'monthly_cutoff': {
      const accrualStart = resolveMonthlyCutoffAccrualStart(
        input.hireDate,
        accrual.monthlyCutoffDay,
      );
      const effectiveStart =
        compareDates(accrualStart, input.period.periodStart) > 0
          ? accrualStart
          : input.period.periodStart;
      const months = countInclusiveMonths(
        effectiveStart,
        input.period.periodEnd,
      );
      return roundLeaveDays((input.annualDays / 12) * months);
    }
    default:
      return input.annualDays;
  }
}

export function formatAccrualMethodLabel(method: LeaveAccrualMethod): string {
  switch (method) {
    case 'straight_line_monthly':
      return 'Straight-line monthly accrual';
    case 'daily_precise':
      return 'Daily / precise accrual';
    case 'monthly_cutoff':
      return 'Monthly accrual with cutoff rule';
    case 'no_proration':
      return 'No proration (full grant)';
    case 'anniversary_full':
      return 'Anniversary-based (full grant)';
    default:
      return method;
  }
}

export function describeAccrualMethod(method: LeaveAccrualMethod): string {
  switch (method) {
    case 'straight_line_monthly':
      return '(Annual credits ÷ 12) × months of service remaining in the period.';
    case 'daily_precise':
      return '(Annual credits ÷ 365) × days of service remaining in the period.';
    case 'monthly_cutoff':
      return 'Monthly rate with a hire-day cutoff. Starts counting the hire month only if hired on or before the cutoff day.';
    case 'no_proration':
      return 'Grants the full annual credits even for mid-period hires.';
    case 'anniversary_full':
      return 'Grants full annual credits each period. Works best with hire-date anniversary resets.';
    default:
      return '';
  }
}

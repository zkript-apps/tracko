import { apiFetch } from './api';

export const LEAVE_RESET_TYPES = [
  { value: 'calendar', label: 'Calendar year (Jan 1)' },
  { value: 'anniversary', label: 'Hire-date anniversary' },
  { value: 'fiscal', label: 'Fiscal year' },
] as const;

export const LEAVE_CONVERSION_TARGETS = [
  { value: 'vacation', label: 'Vacation leave' },
  { value: 'sick', label: 'Sick leave' },
  { value: 'cash', label: 'Cash payout' },
] as const;

export type LeaveResetType = (typeof LEAVE_RESET_TYPES)[number]['value'];
export type LeaveConversionTarget =
  (typeof LEAVE_CONVERSION_TARGETS)[number]['value'];

export type LeaveTypeRules = {
  carryOver: {
    enabled: boolean;
    maxDays: number;
  };
  forfeiture: {
    enabled: boolean;
  };
  conversion: {
    enabled: boolean;
    target: LeaveConversionTarget;
    maxDays: number;
  };
};

export type SilSafeguard = {
  enabled: boolean;
  minDays: number;
  tenureMonths: number;
  cashOutUnused: boolean;
};

export type PeriodAutoGrant = {
  vacation: number;
  sick: number;
  emergency: number;
};

export const LEAVE_ACCRUAL_METHODS = [
  {
    value: 'straight_line_monthly',
    label: 'Straight-line monthly accrual',
    description:
      '(Annual credits ÷ 12) × months of service remaining in the period. Most common.',
  },
  {
    value: 'daily_precise',
    label: 'Daily / precise accrual',
    description:
      '(Annual credits ÷ 365) × days of service remaining in the period. More granular.',
  },
  {
    value: 'monthly_cutoff',
    label: 'Monthly accrual with cutoff rule',
    description:
      'Monthly rate with a hire-day cutoff. Hired on or before the cutoff day counts the hire month; otherwise accrual starts next month.',
  },
  {
    value: 'no_proration',
    label: 'No proration (full grant)',
    description:
      'Grants the full annual credits even for mid-period hires. Simple but more generous.',
  },
  {
    value: 'anniversary_full',
    label: 'Anniversary-based (full grant)',
    description:
      'Grants full annual credits each period. Works best with hire-date anniversary resets.',
  },
] as const;

export type LeaveAccrualMethod =
  (typeof LEAVE_ACCRUAL_METHODS)[number]['value'];

export type LeaveAccrualSettings = {
  method: LeaveAccrualMethod;
  monthlyCutoffDay: number;
};

export type LeavePolicy = {
  resetType: LeaveResetType;
  fiscalYearStartMonth: number;
  silSafeguard: SilSafeguard;
  periodAutoGrant: PeriodAutoGrant;
  accrual: LeaveAccrualSettings;
  vacation: LeaveTypeRules;
  sick: LeaveTypeRules;
  updatedAt: string;
};

export const DEFAULT_PERIOD_AUTO_GRANT: PeriodAutoGrant = {
  vacation: 0,
  sick: 0,
  emergency: 0,
};

export const DEFAULT_LEAVE_ACCRUAL: LeaveAccrualSettings = {
  method: 'straight_line_monthly',
  monthlyCutoffDay: 15,
};

export const DEFAULT_LEAVE_POLICY: LeavePolicy = {
  resetType: 'calendar',
  fiscalYearStartMonth: 1,
  silSafeguard: {
    enabled: true,
    minDays: 5,
    tenureMonths: 12,
    cashOutUnused: true,
  },
  periodAutoGrant: DEFAULT_PERIOD_AUTO_GRANT,
  accrual: DEFAULT_LEAVE_ACCRUAL,
  vacation: {
    carryOver: { enabled: false, maxDays: 0 },
    forfeiture: { enabled: true },
    conversion: { enabled: false, target: 'cash', maxDays: 0 },
  },
  sick: {
    carryOver: { enabled: false, maxDays: 0 },
    forfeiture: { enabled: true },
    conversion: { enabled: false, target: 'vacation', maxDays: 0 },
  },
  updatedAt: '',
};

export async function getLeavePolicy(): Promise<LeavePolicy> {
  return apiFetch('/leave/policy');
}

export async function updateLeavePolicy(
  input: Omit<LeavePolicy, 'updatedAt'>,
): Promise<LeavePolicy> {
  return apiFetch('/leave/policy', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function formatResetType(resetType: LeaveResetType): string {
  return (
    LEAVE_RESET_TYPES.find((item) => item.value === resetType)?.label ??
    resetType
  );
}

export function formatConversionTarget(target: LeaveConversionTarget): string {
  return (
    LEAVE_CONVERSION_TARGETS.find((item) => item.value === target)?.label ??
    target
  );
}

export function formatAccrualMethod(method: LeaveAccrualMethod): string {
  return (
    LEAVE_ACCRUAL_METHODS.find((item) => item.value === method)?.label ??
    method
  );
}

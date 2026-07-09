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

export type LeavePolicy = {
  resetType: LeaveResetType;
  fiscalYearStartMonth: number;
  silSafeguard: SilSafeguard;
  vacation: LeaveTypeRules;
  sick: LeaveTypeRules;
  updatedAt: string;
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

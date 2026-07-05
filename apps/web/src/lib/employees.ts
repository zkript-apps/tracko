import { apiFetch } from './api';
import type { LeaveRequest } from './leave';

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full time' },
  { value: 'contractual', label: 'Contractual' },
  { value: 'intern', label: 'Intern / OJT' },
  { value: 'probation', label: 'Probation' },
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]['value'];

export type EmployeeProfile = {
  userId: string;
  memberId: string;
  branchId: string;
  employmentType: EmploymentType;
  jobTitle: string | null;
  hireDate: string;
  contractStartDate: string;
  contractEndDate: string | null;
  probationEndDate: string | null;
  notes: string | null;
  updatedAt: string;
};

export type LeaveBalance = {
  leaveType: string;
  periodYear: number;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
};

export type EmployeeRecord = {
  userId: string;
  memberId: string;
  name: string;
  email: string;
  branchId: string;
  profile: EmployeeProfile;
  leaveBalances: LeaveBalance[];
};

export type EmployeeDetail = EmployeeRecord & {
  periodYear: number;
  leaveHistory: LeaveRequest[];
};

export async function listEmployeeRecords(
  periodYear?: number,
): Promise<{ periodYear: number; employees: EmployeeRecord[] }> {
  const query =
    periodYear !== undefined
      ? `?periodYear=${encodeURIComponent(String(periodYear))}`
      : '';
  return apiFetch(`/employees${query}`);
}

export async function getEmployeeRecord(
  userId: string,
  periodYear?: number,
): Promise<EmployeeDetail> {
  const query =
    periodYear !== undefined
      ? `?periodYear=${encodeURIComponent(String(periodYear))}`
      : '';
  return apiFetch(`/employees/${encodeURIComponent(userId)}${query}`);
}

export async function updateEmployeeProfile(
  userId: string,
  input: {
    employmentType?: EmploymentType;
    jobTitle?: string;
    hireDate?: string;
    contractStartDate?: string;
    contractEndDate?: string | null;
    probationEndDate?: string | null;
    notes?: string | null;
  },
): Promise<EmployeeProfile> {
  return apiFetch(`/employees/${encodeURIComponent(userId)}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function updateEmployeeLeaveBalances(
  userId: string,
  input: {
    periodYear?: number;
    balances: Array<{ leaveType: string; entitledDays: number }>;
  },
): Promise<{ periodYear: number; leaveBalances: LeaveBalance[] }> {
  return apiFetch(`/employees/${encodeURIComponent(userId)}/leave-balances`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function formatEmploymentType(type: string): string {
  return EMPLOYMENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function formatEmploymentPeriod(profile: EmployeeProfile): string {
  const end = profile.contractEndDate ?? 'Present';
  return `${profile.contractStartDate} → ${end}`;
}

export function formatDateLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

import { apiFetch } from './api';

export const LEAVE_TYPES = [
  { value: 'vacation', label: 'Vacation leave' },
  { value: 'sick', label: 'Sick leave' },
  { value: 'emergency', label: 'Emergency leave' },
  { value: 'unpaid', label: 'Unpaid leave' },
] as const;

export const BALANCE_LEAVE_TYPES = ['vacation', 'sick', 'emergency'] as const;

export type LeaveRequest = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  branchId: string;
  userId: string;
  employeeName: string | null;
  employeeEmail: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  requestedDays?: number;
};

export type LeaveBalance = {
  leaveType: string;
  periodYear: number;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
};

export async function getMyLeaveRequests(): Promise<LeaveRequest[]> {
  return apiFetch('/leave/requests/me');
}

export async function getMyLeaveBalances(
  periodYear?: number,
): Promise<{ periodYear: number; leaveBalances: LeaveBalance[] }> {
  const query =
    periodYear !== undefined
      ? `?periodYear=${encodeURIComponent(String(periodYear))}`
      : '';
  return apiFetch(`/leave/balances/me${query}`);
}

export async function createLeaveRequest(input: {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<LeaveRequest> {
  return apiFetch('/leave/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiFetch(`/leave/requests/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getManagedLeaveRequests(
  status?: string,
): Promise<LeaveRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch(`/leave/requests${query}`);
}

export async function approveLeaveRequest(
  id: string,
  reviewNote?: string,
): Promise<LeaveRequest> {
  return apiFetch(`/leave/requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reviewNote }),
  });
}

export async function rejectLeaveRequest(
  id: string,
  reviewNote?: string,
): Promise<LeaveRequest> {
  return apiFetch(`/leave/requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reviewNote }),
  });
}

export function formatLeaveType(type: string): string {
  return LEAVE_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function formatLeaveStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getLeaveStatusClassName(status: string): string {
  switch (status) {
    case 'approved':
      return 'border-transparent bg-emerald-500/15 text-emerald-300';
    case 'rejected':
      return 'border-transparent bg-red-500/15 text-red-300';
    case 'pending':
      return 'border-transparent bg-amber-500/15 text-amber-300';
    default:
      return 'border-transparent bg-secondary text-muted-foreground';
  }
}

export function getSelectableLeaveTypes(balances: LeaveBalance[]) {
  return LEAVE_TYPES.filter((type) => {
    if (type.value === 'unpaid') {
      return true;
    }

    const isBalanceType = BALANCE_LEAVE_TYPES.includes(
      type.value as (typeof BALANCE_LEAVE_TYPES)[number],
    );

    if (!isBalanceType) {
      return true;
    }

    const balance = balances.find((item) => item.leaveType === type.value);
    return (balance?.availableDays ?? 0) > 0;
  });
}

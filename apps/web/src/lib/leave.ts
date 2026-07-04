import { apiFetch } from './api';

export const LEAVE_TYPES = [
  { value: 'vacation', label: 'Vacation leave' },
  { value: 'sick', label: 'Sick leave' },
  { value: 'emergency', label: 'Emergency leave' },
  { value: 'unpaid', label: 'Unpaid leave' },
] as const;

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
};

export async function getMyLeaveRequests(): Promise<LeaveRequest[]> {
  return apiFetch('/leave/requests/me');
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

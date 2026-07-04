import { apiFetch } from './api';

export type AttendanceEvent = {
  id: string;
  type: 'clock_in' | 'clock_out';
  recordedAt: string;
  branchId: string;
  latitude: number | null;
  longitude: number | null;
};

export type AttendanceStatus = {
  isClockedIn: boolean;
  lastEvent: AttendanceEvent | null;
  todayEvents: AttendanceEvent[];
};

export type BranchAttendanceOverview = {
  branchId: string | null;
  date: string;
  employees: Array<{
    userId: string;
    name: string;
    email: string;
    isClockedIn: boolean;
    lastEvent: AttendanceEvent | null;
  }>;
};

export async function getMyAttendanceStatus(): Promise<AttendanceStatus> {
  return apiFetch('/attendance/me/status');
}

export async function clockIn(input?: {
  latitude?: number;
  longitude?: number;
}): Promise<AttendanceEvent> {
  return apiFetch('/attendance/me/clock-in', {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}

export async function clockOut(input?: {
  latitude?: number;
  longitude?: number;
}): Promise<AttendanceEvent> {
  return apiFetch('/attendance/me/clock-out', {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}

export async function getBranchAttendanceOverview(
  branchId?: string,
): Promise<BranchAttendanceOverview> {
  const query = branchId
    ? `?branchId=${encodeURIComponent(branchId)}`
    : '';
  return apiFetch(`/attendance/branch/overview${query}`);
}

export function formatAttendanceTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

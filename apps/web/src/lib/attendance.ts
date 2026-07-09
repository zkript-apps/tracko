import { apiFetch } from './api';
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';

export type AttendanceEvent = {
  id: string;
  type: 'clock_in' | 'clock_out';
  recordedAt: string;
  branchId: string;
  latitude: number | null;
  longitude: number | null;
  verificationMethod: 'webauthn' | 'none' | null;
  biometricVerified: boolean;
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

export type LiveLocationEmployee = {
  userId: string;
  name: string;
  email: string;
  branchId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
};

export type LiveLocationsOverview = {
  updatedAt: string;
  branchId: string | null;
  employees: LiveLocationEmployee[];
};

export type GeoCoordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export async function getRequiredLocation(): Promise<GeoCoordinates> {
  if (!navigator.geolocation) {
    throw new Error('Location is not supported on this device.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new Error(
              'Location permission is required to clock in or out. Allow location access and try again.',
            ),
          );
          return;
        }

        reject(
          new Error(
            'Unable to read your location. Move to an open area and try again.',
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export async function getMyAttendanceStatus(): Promise<AttendanceStatus> {
  return apiFetch('/attendance/me/status');
}

export async function clockIn(input: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  biometricResponse?: AuthenticationResponseJSON;
}): Promise<AttendanceEvent> {
  return apiFetch('/attendance/me/clock-in', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function clockOut(input: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  biometricResponse?: AuthenticationResponseJSON;
}): Promise<AttendanceEvent> {
  return apiFetch('/attendance/me/clock-out', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function postMyLiveLocation(input: {
  latitude: number;
  longitude: number;
  accuracy?: number;
}): Promise<{
  userId: string;
  branchId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
}> {
  return apiFetch('/attendance/me/location', {
    method: 'POST',
    body: JSON.stringify(input),
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

export async function getLiveLocations(
  branchId?: string,
): Promise<LiveLocationsOverview> {
  const query = branchId
    ? `?branchId=${encodeURIComponent(branchId)}`
    : '';
  return apiFetch(`/attendance/live-locations${query}`);
}

export function formatAttendanceTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

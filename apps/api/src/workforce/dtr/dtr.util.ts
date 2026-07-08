import { isValidDateString, todayDateString } from '../employees/leave-days.util';
import {
  DEFAULT_WORK_SCHEDULE,
  isScheduledDayOff,
  type WorkSchedule,
} from '../employees/work-schedule.util';
import type { AttendanceEvent } from '../attendance/attendance.store';

export type DtrStatus =
  | 'complete'
  | 'in_progress'
  | 'incomplete'
  | 'absent'
  | 'day_off';
export type DtrSegment = {
  timeIn: string;
  timeOut: string | null;
  workedMinutes: number;
};

export type DailyTimeRecord = {
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  workedMinutes: number;
  status: DtrStatus;
  segments: DtrSegment[];
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateString(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function addDays(dateString: string, days: number): string {
  const date = parseDateString(dateString);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}

export function validateDateRange(
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string } {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    throw new Error('Dates must use YYYY-MM-DD format.');
  }

  if (startDate > endDate) {
    throw new Error('Start date must be on or before end date.');
  }

  const spanDays = enumerateDates(startDate, endDate).length;
  if (spanDays > 93) {
    throw new Error('Date range cannot exceed 93 days.');
  }

  return { startDate, endDate };
}

export function defaultDtrRange(): { startDate: string; endDate: string } {
  const endDate = todayDateString();
  const start = parseDateString(endDate);
  start.setDate(1);
  return {
    startDate: localDateKey(start),
    endDate,
  };
}

function buildDayRecord(
  date: string,
  events: AttendanceEvent[],
  isToday: boolean,
  schedule: WorkSchedule = DEFAULT_WORK_SCHEDULE,
): DailyTimeRecord {
  if (events.length === 0) {
    return {
      date,
      timeIn: null,
      timeOut: null,
      workedMinutes: 0,
      status: isScheduledDayOff(date, schedule) ? 'day_off' : 'absent',
      segments: [],
    };
  }
  const sorted = [...events].sort(
    (left, right) => left.recordedAt.getTime() - right.recordedAt.getTime(),
  );

  const segments: DtrSegment[] = [];
  let openIn: AttendanceEvent | null = null;
  let workedMinutes = 0;

  for (const event of sorted) {
    if (event.type === 'clock_in') {
      openIn = event;
      continue;
    }

    if (event.type === 'clock_out') {
      if (openIn) {
        const minutes = Math.max(
          0,
          Math.round(
            (event.recordedAt.getTime() - openIn.recordedAt.getTime()) /
              (1000 * 60),
          ),
        );
        workedMinutes += minutes;
        segments.push({
          timeIn: openIn.recordedAt.toISOString(),
          timeOut: event.recordedAt.toISOString(),
          workedMinutes: minutes,
        });
        openIn = null;
      }
    }
  }

  const firstIn = sorted.find((event) => event.type === 'clock_in') ?? null;
  const lastOut = [...sorted]
    .reverse()
    .find((event) => event.type === 'clock_out') ?? null;

  if (openIn) {
    segments.push({
      timeIn: openIn.recordedAt.toISOString(),
      timeOut: null,
      workedMinutes: 0,
    });
  }

  let status: DtrStatus;
  if (openIn && isToday) {
    status = 'in_progress';
  } else if (openIn) {
    status = 'incomplete';
  } else if (segments.some((segment) => segment.timeOut)) {
    status = 'complete';
  } else {
    status = 'incomplete';
  }

  return {
    date,
    timeIn: firstIn?.recordedAt.toISOString() ?? null,
    timeOut: lastOut?.recordedAt.toISOString() ?? null,
    workedMinutes,
    status,
    segments,
  };
}

export function buildDailyRecords(
  events: AttendanceEvent[],
  startDate: string,
  endDate: string,
  schedule: WorkSchedule = DEFAULT_WORK_SCHEDULE,
): DailyTimeRecord[] {
  const today = todayDateString();
  const grouped = new Map<string, AttendanceEvent[]>();

  for (const event of events) {
    const key = localDateKey(event.recordedAt);
    const bucket = grouped.get(key) ?? [];
    bucket.push(event);
    grouped.set(key, bucket);
  }

  return enumerateDates(startDate, endDate).map((date) =>
    buildDayRecord(
      date,
      grouped.get(date) ?? [],
      date === today,
      schedule,
    ),
  );
}
export function formatWorkedMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, '0')}m`;
}

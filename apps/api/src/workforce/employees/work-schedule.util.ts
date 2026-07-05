import { isValidDateString } from './leave-days.util';

export const WEEKDAY_LABELS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

export type Weekday = (typeof WEEKDAY_LABELS)[number]['value'];

export type WorkSchedule = {
  weeklyRestDays: Weekday[];
  workStartTime: string;
  workEndTime: string;
  extraDayOffDates: string[];
};

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  weeklyRestDays: [0, 6],
  workStartTime: '09:00',
  workEndTime: '17:00',
  extraDayOffDates: [],
};

export function isValidTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function resolveWorkSchedule(input?: Partial<WorkSchedule> | null): WorkSchedule {
  const weeklyRestDays =
    input?.weeklyRestDays?.filter((day) => day >= 0 && day <= 6) ??
    DEFAULT_WORK_SCHEDULE.weeklyRestDays;

  return {
    weeklyRestDays: [...new Set(weeklyRestDays)].sort((left, right) => left - right),
    workStartTime: input?.workStartTime ?? DEFAULT_WORK_SCHEDULE.workStartTime,
    workEndTime: input?.workEndTime ?? DEFAULT_WORK_SCHEDULE.workEndTime,
    extraDayOffDates: [...(input?.extraDayOffDates ?? [])].sort(),
  };
}

export function isScheduledDayOff(date: string, schedule: WorkSchedule): boolean {
  if (schedule.extraDayOffDates.includes(date)) {
    return true;
  }

  const weekday = new Date(`${date}T00:00:00`).getDay() as Weekday;
  return schedule.weeklyRestDays.includes(weekday);
}

export function validateWorkScheduleInput(input: {
  weeklyRestDays?: number[];
  workStartTime?: string;
  workEndTime?: string;
  extraDayOffDates?: string[];
}): WorkSchedule {
  if (input.weeklyRestDays !== undefined) {
    if (
      !Array.isArray(input.weeklyRestDays) ||
      input.weeklyRestDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    ) {
      throw new Error('Weekly rest days must be integers from 0 (Sunday) to 6 (Saturday).');
    }
  }

  if (input.workStartTime && !isValidTimeString(input.workStartTime)) {
    throw new Error('Work start time must use HH:mm format.');
  }

  if (input.workEndTime && !isValidTimeString(input.workEndTime)) {
    throw new Error('Work end time must use HH:mm format.');
  }

  const startTime = input.workStartTime ?? DEFAULT_WORK_SCHEDULE.workStartTime;
  const endTime = input.workEndTime ?? DEFAULT_WORK_SCHEDULE.workEndTime;

  if (startTime >= endTime) {
    throw new Error('Work end time must be after work start time.');
  }

  if (input.extraDayOffDates) {
    for (const date of input.extraDayOffDates) {
      if (!isValidDateString(date)) {
        throw new Error('Extra day off dates must use YYYY-MM-DD format.');
      }
    }
  }

  return resolveWorkSchedule({
    weeklyRestDays: input.weeklyRestDays as Weekday[] | undefined,
    workStartTime: input.workStartTime,
    workEndTime: input.workEndTime,
    extraDayOffDates: input.extraDayOffDates,
  });
}

export function serializeWorkSchedule(schedule: WorkSchedule) {
  return {
    weeklyRestDays: schedule.weeklyRestDays,
    workStartTime: schedule.workStartTime,
    workEndTime: schedule.workEndTime,
    extraDayOffDates: schedule.extraDayOffDates,
  };
}

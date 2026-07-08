import { apiFetch } from './api';

export const STATUTORY_HOLIDAY_TYPES = [
  {
    value: 'regular',
    label: 'Regular holiday',
    description: '200% for first 8 hours worked · 100% daily wage if unworked',
  },
  {
    value: 'special_non_working',
    label: 'Special non-working day',
    description: '130% for first 8 hours worked · no work, no pay if unworked',
  },
] as const;

export type StatutoryHolidayType =
  (typeof STATUTORY_HOLIDAY_TYPES)[number]['value'];

export type Holiday = {
  id: string;
  organizationId: string;
  branchId: string | null;
  date: string;
  name: string;
  holidayType: StatutoryHolidayType;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type HolidaysResponse = {
  startDate: string;
  endDate: string;
  branchId: string | null;
  holidays: Holiday[];
};

export type PhilippinesPublicHoliday = {
  date: string;
  localName: string;
  name: string;
  types: string[];
  holidayType: StatutoryHolidayType;
};

export type PhilippinesPublicHolidaysResponse = {
  year: number;
  holidays: PhilippinesPublicHoliday[];
};

export async function getPhilippinesPublicHolidays(
  year: number,
): Promise<PhilippinesPublicHolidaysResponse> {
  return apiFetch(
    `/holidays/ph-public?year=${encodeURIComponent(String(year))}`,
  );
}

export async function listHolidays(input: {
  startDate: string;
  endDate: string;
  branchId?: string;
}): Promise<HolidaysResponse> {
  const params = new URLSearchParams({
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (input.branchId) {
    params.set('branchId', input.branchId);
  }

  return apiFetch(`/holidays?${params.toString()}`);
}

export async function createHoliday(input: {
  date: string;
  name: string;
  holidayType: StatutoryHolidayType;
  branchId?: string | null;
}): Promise<Holiday> {
  return apiFetch('/holidays', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateHoliday(
  id: string,
  input: {
    name?: string;
    holidayType?: StatutoryHolidayType;
    branchId?: string | null;
  },
): Promise<Holiday> {
  return apiFetch(`/holidays/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteHoliday(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/holidays/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function formatHolidayType(holidayType: StatutoryHolidayType): string {
  return (
    STATUTORY_HOLIDAY_TYPES.find((type) => type.value === holidayType)?.label ??
    holidayType
  );
}

export function getMonthBounds(year: number, month: number) {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

export function buildCalendarDays(year: number, month: number): Array<{
  date: string | null;
  day: number | null;
}> {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ date: null, day: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ date, day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }

  return cells;
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });
}

export const PH_STATUTORY_PAY_RULES = [
  {
    title: 'Ordinary overtime',
    description: '+25% of hourly rate for work beyond 8 hours on a regular day.',
  },
  {
    title: 'Rest day / special day overtime',
    description: '+30% on top of the rest-day or special-day rate (169% hourly).',
  },
  {
    title: 'Regular holiday overtime',
    description: '+30% on top of the holiday rate (260% hourly).',
  },
  {
    title: 'Night shift differential',
    description: '+10% of hourly rate for work between 10:00 PM and 6:00 AM.',
  },
  {
    title: 'Regular holiday (unworked)',
    description: '100% of daily wage even when the employee did not work.',
  },
  {
    title: 'Special non-working day (unworked)',
    description: 'No work, no pay unless company policy says otherwise.',
  },
] as const;

import type { OrganizationHoliday } from './holidays.store';

export const STATUTORY_HOLIDAY_TYPES = [
  'regular',
  'special_non_working',
] as const;

export type StatutoryHolidayType = (typeof STATUTORY_HOLIDAY_TYPES)[number];

const REGULAR_HOLIDAY_KEYWORDS = [
  'new year',
  'bagong taon',
  'maundy thursday',
  'huwebes santo',
  'good friday',
  'biyernes santo',
  'araw ng kagitingan',
  'day of valor',
  'labor day',
  'araw ng paggawa',
  'independence day',
  'araw ng kalayaan',
  'national heroes',
  'araw ng mga bayani',
  'bonifacio',
  'christmas day',
  'araw ng pasko',
  'rizal',
  "eid'l fitr",
  "eid'l adha",
  'eidul fitr',
  'eidul adha',
];

const SPECIAL_HOLIDAY_KEYWORDS = [
  'chinese new year',
  'black saturday',
  'sabado de gloria',
  'holy saturday',
  'ninoy aquino',
  "all saints' day eve",
  'all saints day eve',
  "all saints' day",
  'araw ng mga santo',
  'immaculate conception',
  'christmas eve',
  'last day of the year',
  'huling araw ng taon',
];

function normalizeHolidayLabel(value: string): string {
  return value.trim().toLowerCase();
}

export function classifyPhilippinesHoliday(
  name: string,
  localName?: string,
): StatutoryHolidayType {
  const labels = [name, localName ?? ''].map(normalizeHolidayLabel);

  for (const label of labels) {
    if (SPECIAL_HOLIDAY_KEYWORDS.some((keyword) => label.includes(keyword))) {
      return 'special_non_working';
    }
  }

  for (const label of labels) {
    if (REGULAR_HOLIDAY_KEYWORDS.some((keyword) => label.includes(keyword))) {
      return 'regular';
    }
  }

  return 'special_non_working';
}

export function resolveHolidayType(
  holiday: OrganizationHoliday,
): StatutoryHolidayType {
  if (holiday.holidayType) {
    return holiday.holidayType;
  }

  if (holiday.payRule) {
    if (
      holiday.payRule.type === 'multiplier' &&
      holiday.payRule.value >= 2
    ) {
      return 'regular';
    }

    if (
      holiday.payRule.type === 'percentage' &&
      holiday.payRule.value >= 100
    ) {
      return 'regular';
    }
  }

  return classifyPhilippinesHoliday(holiday.name);
}

export function validateHolidayType(
  holidayType: StatutoryHolidayType,
): StatutoryHolidayType {
  if (!STATUTORY_HOLIDAY_TYPES.includes(holidayType)) {
    throw new Error('Invalid holiday type.');
  }

  return holidayType;
}

export function formatHolidayType(holidayType: StatutoryHolidayType): string {
  return holidayType === 'regular'
    ? 'Regular holiday (200% if worked, 100% if unworked)'
    : 'Special non-working day (130% if worked, no work no pay)';
}

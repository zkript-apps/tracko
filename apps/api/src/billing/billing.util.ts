const DEFAULT_TIMEZONE = 'Asia/Manila';

export function getFirstDayOfNextMonth(
  from = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(from);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

export function formatEffectiveDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  });
}

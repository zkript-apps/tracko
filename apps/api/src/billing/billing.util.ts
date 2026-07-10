const DEFAULT_TIMEZONE = 'Asia/Manila';

/** Days after a subscription change is requested before it takes effect. */
export const BILLING_CHANGE_DELAY_DAYS = 30;

/**
 * Effective date for subscription changes: 30 calendar days after `from`
 * (Manila date), at the start of that day in UTC.
 */
export function getChangeEffectiveDate(
  from = new Date(),
  timeZone = DEFAULT_TIMEZONE,
  days = BILLING_CHANGE_DELAY_DAYS,
): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(from);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  const base = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

export function formatEffectiveDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  });
}

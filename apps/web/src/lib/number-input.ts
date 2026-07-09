import type { FocusEvent } from 'react';

export function parseIntegerInput(
  value: string,
  options?: { min?: number; max?: number; fallback?: number },
): number {
  const trimmed = value.trim();

  if (trimmed === '') {
    return options?.fallback ?? 0;
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(parsed)) {
    return options?.fallback ?? 0;
  }

  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;

  return Math.min(max, Math.max(min, parsed));
}

export function selectZeroNumberInputOnFocus(
  event: FocusEvent<HTMLInputElement>,
  value: number | string | undefined,
): void {
  const numeric = Number(value);

  if (numeric === 0) {
    event.currentTarget.select();
  }
}

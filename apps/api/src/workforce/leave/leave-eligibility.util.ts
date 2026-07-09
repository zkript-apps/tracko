import { monthsBetween } from './leave-period.util';
import type { LeavePolicyInput } from './leave-policy.types';

export type LeaveEligibility = {
  eligible: boolean;
  tenureMonthsRequired: number;
  tenureMonthsServed: number;
  hireDate: string | null;
};

export function resolveLeaveEligibility(input: {
  policy: LeavePolicyInput;
  hireDate?: string;
  asOfDate: string;
}): LeaveEligibility {
  const tenureMonthsRequired = input.policy.silSafeguard.tenureMonths;
  const hireDate = input.hireDate ?? null;

  if (!hireDate) {
    return {
      eligible: false,
      tenureMonthsRequired,
      tenureMonthsServed: 0,
      hireDate,
    };
  }

  const tenureMonthsServed = monthsBetween(hireDate, input.asOfDate);

  return {
    eligible: tenureMonthsServed >= tenureMonthsRequired,
    tenureMonthsRequired,
    tenureMonthsServed,
    hireDate,
  };
}

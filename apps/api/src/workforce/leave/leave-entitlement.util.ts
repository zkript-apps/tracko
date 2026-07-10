import { hasSilTenure } from './leave-period.util';
import type { LeavePolicyInput } from './leave-policy.types';

type EntitlementLeaveType = 'vacation' | 'sick' | 'emergency';

export function computeSilFloorDays(
  policy: LeavePolicyInput,
  hireDate: string | undefined,
  asOfDate: string,
): number {
  if (!policy.silSafeguard.enabled || !hireDate) {
    return 0;
  }

  if (
    !hasSilTenure(
      hireDate,
      asOfDate,
      policy.silSafeguard.tenureMonths,
    )
  ) {
    return 0;
  }

  return policy.silSafeguard.minDays;
}

export function computeEffectiveEntitlement(input: {
  companyEntitledDays: number;
  carriedOverDays: number;
  leaveType: EntitlementLeaveType;
  policy: LeavePolicyInput;
  hireDate?: string;
  asOfDate: string;
}): {
  entitledDays: number;
  silFloorDays: number;
} {
  const baseEntitlement =
    input.companyEntitledDays + input.carriedOverDays;

  if (input.leaveType !== 'vacation') {
    return {
      entitledDays: baseEntitlement,
      silFloorDays: 0,
    };
  }

  const silFloorDays = computeSilFloorDays(
    input.policy,
    input.hireDate,
    input.asOfDate,
  );

  return {
    entitledDays: Math.max(baseEntitlement, silFloorDays),
    silFloorDays,
  };
}

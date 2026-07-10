import type { BalanceLeaveType } from '../employees/leave-balances.store';
import {
  findBalanceByPeriodKey,
  setBalanceEntitlement,
} from '../employees/leave-balances.store';
import { computeProratedGrantDays } from './leave-accrual.util';
import { computeEffectiveEntitlement } from './leave-entitlement.util';
import { resolveLeaveEligibility } from './leave-eligibility.util';
import {
  DEFAULT_PERIOD_AUTO_GRANT,
  type LeavePeriod,
  type LeavePolicyInput,
  type PeriodAutoGrant,
} from './leave-policy.types';

const BALANCE_LEAVE_TYPES: BalanceLeaveType[] = [
  'vacation',
  'sick',
  'emergency',
];

export function normalizePeriodAutoGrant(
  policy: Pick<LeavePolicyInput, 'periodAutoGrant'>,
): PeriodAutoGrant {
  return policy.periodAutoGrant ?? DEFAULT_PERIOD_AUTO_GRANT;
}

export async function applyPeriodAutoGrantIfNeeded(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  policy: LeavePolicyInput;
  period: LeavePeriod;
  hireDate?: string;
}): Promise<void> {
  const eligibility = resolveLeaveEligibility({
    policy: input.policy,
    hireDate: input.hireDate,
    asOfDate: input.period.periodStart,
  });

  if (!eligibility.eligible) {
    return;
  }

  const grants = normalizePeriodAutoGrant(input.policy);

  for (const leaveType of BALANCE_LEAVE_TYPES) {
    const annualDays = grants[leaveType];

    if (annualDays <= 0) {
      continue;
    }

    const grantDays = computeProratedGrantDays({
      annualDays,
      hireDate: input.hireDate,
      period: input.period,
      policy: input.policy,
    });

    if (grantDays <= 0) {
      continue;
    }

    const existing = await findBalanceByPeriodKey(
      input.organizationId,
      input.userId,
      leaveType,
      input.period.periodKey,
    );

    if (existing?.periodAutoGrantApplied) {
      continue;
    }

    if (existing && existing.companyEntitledDays > 0) {
      continue;
    }

    const carriedOverDays = existing?.carriedOverDays ?? 0;
    const { entitledDays, silFloorDays } = computeEffectiveEntitlement({
      companyEntitledDays: grantDays,
      carriedOverDays,
      leaveType,
      policy: input.policy,
      hireDate: input.hireDate,
      asOfDate: input.period.periodStart,
    });

    await setBalanceEntitlement({
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      leaveType,
      periodKey: input.period.periodKey,
      periodYear: input.period.periodYear,
      periodStart: input.period.periodStart,
      periodEnd: input.period.periodEnd,
      companyEntitledDays: grantDays,
      carriedOverDays,
      entitledDays,
      silFloorDays,
      usedDays: existing?.usedDays ?? 0,
      pendingDays: existing?.pendingDays ?? 0,
      periodAutoGrantApplied: true,
    });
  }
}

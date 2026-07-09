import type { BalanceLeaveType } from '../employees/leave-balances.store';
import {
  findBalance,
  findBalanceByPeriodKey,
  type LeaveBalance,
  markPeriodClosed,
  setBalanceEntitlement,
  upsertBalanceFromRollover,
} from '../employees/leave-balances.store';
import { todayDateString } from '../employees/leave-days.util';
import { findProfileByUserId } from '../employees/employee-profiles.store';
import { compareDates } from './leave-period.util';
import { computeSilFloorDays } from './leave-entitlement.util';
import {
  resolveLeavePeriod,
  resolvePreviousLeavePeriod,
} from './leave-period.util';
import type {
  LeaveConversionTarget,
  LeavePolicy,
  LeavePolicyInput,
  LeaveTypeRules,
} from './leave-policy.types';
import {
  createLeaveCashOut,
  hasPeriodBeenClosed,
  markLeavePeriodClosed,
} from './leave-cash-outs.store';

type PolicyLeaveType = 'vacation' | 'sick';

function rulesForType(
  policy: LeavePolicyInput,
  leaveType: PolicyLeaveType,
): LeaveTypeRules {
  return leaveType === 'vacation' ? policy.vacation : policy.sick;
}

function unusedDays(balance: LeaveBalance): number {
  return Math.max(
    0,
    balance.entitledDays - balance.usedDays - balance.pendingDays,
  );
}

function applyRolloverRules(input: {
  unusedDays: number;
  rules: LeaveTypeRules;
}): {
  carryOverDays: number;
  convertedDays: number;
  forfeitedDays: number;
  conversionTarget?: LeaveConversionTarget;
} {
  const { unusedDays, rules } = input;

  if (unusedDays <= 0) {
    return {
      carryOverDays: 0,
      convertedDays: 0,
      forfeitedDays: 0,
    };
  }

  let remaining = unusedDays;
  let carryOverDays = 0;

  if (rules.carryOver.enabled) {
    const maxCarryOver =
      rules.carryOver.maxDays > 0
        ? rules.carryOver.maxDays
        : remaining;
    carryOverDays = Math.min(remaining, maxCarryOver);
    remaining -= carryOverDays;
  }

  let convertedDays = 0;
  let conversionTarget: LeaveConversionTarget | undefined;

  if (remaining > 0 && rules.conversion.enabled) {
    const maxConversion =
      rules.conversion.maxDays > 0
        ? rules.conversion.maxDays
        : remaining;
    convertedDays = Math.min(remaining, maxConversion);
    conversionTarget = rules.conversion.target;
    remaining -= convertedDays;
  }

  const forfeitedDays =
    remaining > 0 && rules.forfeiture.enabled ? remaining : 0;

  return {
    carryOverDays,
    convertedDays,
    forfeitedDays,
    conversionTarget,
  };
}

async function processSilCashOut(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  policy: LeavePolicy;
  previousBalance: LeaveBalance;
  previousPeriodKey: string;
  hireDate?: string;
}): Promise<number> {
  if (
    !input.policy.silSafeguard.enabled ||
    !input.policy.silSafeguard.cashOutUnused ||
    !input.hireDate
  ) {
    return 0;
  }

  const silFloorDays = computeSilFloorDays(
    input.policy,
    input.hireDate,
    input.previousBalance.periodEnd ?? todayDateString(),
  );

  if (silFloorDays <= 0) {
    return 0;
  }

  const silUsedDays = Math.min(
    input.previousBalance.usedDays,
    silFloorDays,
  );
  const unusedSilDays = Math.max(0, silFloorDays - silUsedDays);

  if (unusedSilDays <= 0) {
    return 0;
  }

  await createLeaveCashOut({
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    periodKey: input.previousPeriodKey,
    leaveType: 'vacation',
    days: unusedSilDays,
    reason: 'sil_unused',
  });

  return unusedSilDays;
}

export async function syncLeaveBalancesForPeriod(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  policy: LeavePolicy;
  referenceDate?: string;
}): Promise<void> {
  const referenceDate = input.referenceDate ?? todayDateString();
  const profile = await findProfileByUserId(
    input.organizationId,
    input.userId,
  );
  const hireDate = profile?.hireDate;
  const currentPeriod = resolveLeavePeriod(
    referenceDate,
    input.policy,
    hireDate,
  );
  const previousPeriod = resolvePreviousLeavePeriod(
    currentPeriod,
    input.policy,
    hireDate,
  );

  if (compareDates(referenceDate, previousPeriod.periodEnd) <= 0) {
    return;
  }

  const alreadyClosed = await hasPeriodBeenClosed({
    organizationId: input.organizationId,
    userId: input.userId,
    periodKey: previousPeriod.periodKey,
  });

  if (alreadyClosed) {
    return;
  }

  const rolloverTargets: PolicyLeaveType[] = ['vacation', 'sick'];
  const carryOverByType = new Map<PolicyLeaveType, number>();
  const conversionByType = new Map<
    PolicyLeaveType,
    { days: number; target: LeaveConversionTarget }
  >();

  for (const leaveType of rolloverTargets) {
    const previousBalance =
      (await findBalanceByPeriodKey(
        input.organizationId,
        input.userId,
        leaveType,
        previousPeriod.periodKey,
      )) ??
      (await findBalance(
        input.organizationId,
        input.userId,
        leaveType,
        previousPeriod.periodYear,
      ));

    if (!previousBalance) {
      continue;
    }

    const rules = rulesForType(input.policy, leaveType);
    const rollover = applyRolloverRules({
      unusedDays: unusedDays(previousBalance),
      rules,
    });

    if (rollover.carryOverDays > 0) {
      carryOverByType.set(leaveType, rollover.carryOverDays);
    }

    if (rollover.convertedDays > 0 && rollover.conversionTarget) {
      conversionByType.set(leaveType, {
        days: rollover.convertedDays,
        target: rollover.conversionTarget,
      });
    }

    if (leaveType === 'vacation') {
      await processSilCashOut({
        organizationId: input.organizationId,
        userId: input.userId,
        memberId: input.memberId,
        branchId: input.branchId,
        policy: input.policy,
        previousBalance: {
          ...previousBalance,
          periodEnd: previousPeriod.periodEnd,
        },
        previousPeriodKey: previousPeriod.periodKey,
        hireDate,
      });
    }

    await markPeriodClosed(previousBalance._id, {
      forfeitedDays: rollover.forfeitedDays,
      convertedDays: rollover.convertedDays,
      conversionTarget: rollover.conversionTarget,
    });
  }

  for (const [leaveType, carriedOverDays] of carryOverByType) {
    const existingCurrent = await findBalanceByPeriodKey(
      input.organizationId,
      input.userId,
      leaveType,
      currentPeriod.periodKey,
    );
    const companyEntitledDays = existingCurrent?.companyEntitledDays ?? 0;

    await upsertBalanceFromRollover({
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      leaveType,
      periodKey: currentPeriod.periodKey,
      periodYear: currentPeriod.periodYear,
      periodStart: currentPeriod.periodStart,
      periodEnd: currentPeriod.periodEnd,
      companyEntitledDays,
      carriedOverDays,
      policy: input.policy,
      hireDate,
    });
  }

  for (const [sourceType, conversion] of conversionByType) {
    if (conversion.target === 'cash') {
      await createLeaveCashOut({
        organizationId: input.organizationId,
        userId: input.userId,
        memberId: input.memberId,
        branchId: input.branchId,
        periodKey: previousPeriod.periodKey,
        leaveType: sourceType,
        days: conversion.days,
        reason: 'conversion',
      });
      continue;
    }

    const targetType = conversion.target;
    const existingTarget = await findBalanceByPeriodKey(
      input.organizationId,
      input.userId,
      targetType,
      currentPeriod.periodKey,
    );

    await upsertBalanceFromRollover({
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      leaveType: targetType,
      periodKey: currentPeriod.periodKey,
      periodYear: currentPeriod.periodYear,
      periodStart: currentPeriod.periodStart,
      periodEnd: currentPeriod.periodEnd,
      companyEntitledDays: existingTarget?.companyEntitledDays ?? 0,
      carriedOverDays:
        (existingTarget?.carriedOverDays ?? 0) + conversion.days,
      policy: input.policy,
      hireDate,
    });
  }

  await markLeavePeriodClosed({
    organizationId: input.organizationId,
    userId: input.userId,
    periodKey: previousPeriod.periodKey,
  });
}

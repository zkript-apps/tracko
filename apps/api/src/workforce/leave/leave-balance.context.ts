import { findProfileByUserId } from '../employees/employee-profiles.store';
import {
  ensureBalancesForUser,
  listBalancesForUser,
  serializeLeaveBalance,
} from '../employees/leave-balances.store';
import { todayDateString } from '../employees/leave-days.util';
import { syncLeaveBalancesForPeriod } from './leave-policy.engine';
import { applyPeriodAutoGrantIfNeeded } from './leave-period-grant.util';
import { resolveLeavePeriod } from './leave-period.util';
import { ensureLeavePolicy } from './leave-policy.store';

export async function prepareEmployeeLeaveBalances(input: {
  organizationId: string;
  userId: string;
  memberId: string;
  branchId: string;
  referenceDate?: string;
}) {
  const referenceDate = input.referenceDate ?? todayDateString();
  const policy = await ensureLeavePolicy(input.organizationId);
  const profile = await findProfileByUserId(
    input.organizationId,
    input.userId,
  );
  const hireDate = profile?.hireDate;
  const period = resolveLeavePeriod(referenceDate, policy, hireDate);

  await syncLeaveBalancesForPeriod({
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    policy,
    referenceDate,
  });

  const balances = await ensureBalancesForUser({
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    periodKey: period.periodKey,
    periodYear: period.periodYear,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    policy,
    hireDate,
  });

  await applyPeriodAutoGrantIfNeeded({
    organizationId: input.organizationId,
    userId: input.userId,
    memberId: input.memberId,
    branchId: input.branchId,
    policy,
    period,
    hireDate,
  });

  const refreshedBalances = await listBalancesForUser(
    input.organizationId,
    input.userId,
    period.periodKey,
  );

  return {
    policy,
    period,
    hireDate,
    balances: refreshedBalances.map(serializeLeaveBalance),
  };
}

export async function resolveLeavePeriodForRequest(input: {
  organizationId: string;
  userId: string;
  startDate: string;
}) {
  const policy = await ensureLeavePolicy(input.organizationId);
  const profile = await findProfileByUserId(
    input.organizationId,
    input.userId,
  );

  return {
    policy,
    hireDate: profile?.hireDate,
    period: resolveLeavePeriod(
      input.startDate,
      policy,
      profile?.hireDate,
    ),
  };
}

export async function listSerializedBalancesForPeriod(input: {
  organizationId: string;
  userId: string;
  periodKey: string;
}) {
  const balances = await listBalancesForUser(
    input.organizationId,
    input.userId,
    input.periodKey,
  );

  return balances.map(serializeLeaveBalance);
}

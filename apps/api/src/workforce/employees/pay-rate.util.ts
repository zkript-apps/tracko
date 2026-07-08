import type { EmployeeProfile } from './employee-profiles.store';

export const PAY_RATE_TYPES = ['hourly', 'monthly'] as const;
export type PayRateType = (typeof PAY_RATE_TYPES)[number];

export type PayRate = {
  type: PayRateType;
  amount: number;
};

export function resolvePayRate(profile: EmployeeProfile): PayRate | null {
  if (
    profile.payRateType &&
    profile.payRateAmount !== undefined &&
    profile.payRateAmount > 0
  ) {
    return {
      type: profile.payRateType,
      amount: profile.payRateAmount,
    };
  }

  if (profile.monthlySalary && profile.monthlySalary > 0) {
    return {
      type: 'monthly',
      amount: profile.monthlySalary,
    };
  }

  return null;
}

export function serializePayRate(profile: EmployeeProfile) {
  const payRate = resolvePayRate(profile);

  return {
    type: payRate?.type ?? null,
    amount: payRate?.amount ?? null,
  };
}

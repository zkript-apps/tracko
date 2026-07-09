import type { BillableFeatureId } from './feature-catalog';

export type OrganizationScaleTier = 'small' | 'medium' | 'enterprise';

export type ScaleTierDefinition = {
  id: OrganizationScaleTier;
  label: string;
  employeeRange: string;
  minEmployees: number;
  maxEmployees: number | null;
  pricing: {
    base: number;
    leave: number;
    live_tracking: number;
    payroll: number;
  };
};

export const ORGANIZATION_SCALE_TIERS: ScaleTierDefinition[] = [
  {
    id: 'small',
    label: 'Small',
    employeeRange: 'Up to 20 employees',
    minEmployees: 0,
    maxEmployees: 20,
    pricing: {
      base: 299,
      leave: 99,
      live_tracking: 199,
      payroll: 149,
    },
  },
  {
    id: 'medium',
    label: 'Medium',
    employeeRange: '21–100 employees',
    minEmployees: 21,
    maxEmployees: 100,
    pricing: {
      base: 699,
      leave: 229,
      live_tracking: 449,
      payroll: 349,
    },
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    employeeRange: '101+ employees',
    minEmployees: 101,
    maxEmployees: null,
    pricing: {
      base: 1299,
      leave: 399,
      live_tracking: 799,
      payroll: 599,
    },
  },
];

export function resolveScaleTierFromEmployeeCount(
  employeeCount: number,
): OrganizationScaleTier {
  if (employeeCount >= 101) {
    return 'enterprise';
  }

  if (employeeCount >= 21) {
    return 'medium';
  }

  return 'small';
}

export function getScaleTierDefinition(
  tier: OrganizationScaleTier,
): ScaleTierDefinition {
  return (
    ORGANIZATION_SCALE_TIERS.find((entry) => entry.id === tier) ??
    ORGANIZATION_SCALE_TIERS[0]
  );
}

export function getFeaturePriceForTier(
  featureId: 'base' | BillableFeatureId,
  tier: OrganizationScaleTier,
): number {
  const definition = getScaleTierDefinition(tier);
  return definition.pricing[featureId === 'base' ? 'base' : featureId];
}

export function calculateMonthlyTotalPhp(
  activeFeatures: BillableFeatureId[],
  tier: OrganizationScaleTier,
): number {
  const definition = getScaleTierDefinition(tier);
  const addonTotal = activeFeatures.reduce(
    (total, featureId) => total + definition.pricing[featureId],
    0,
  );

  return definition.pricing.base + addonTotal;
}

export function isOrganizationScaleTier(
  value: string,
): value is OrganizationScaleTier {
  return ORGANIZATION_SCALE_TIERS.some((tier) => tier.id === value);
}

import {
  calculateMonthlyTotalPhp,
  getFeaturePriceForTier,
  ORGANIZATION_SCALE_TIERS,
  type OrganizationScaleTier,
} from './organization-scale';
import type { BillableFeatureId } from './feature-catalog.types';

export type { BillableFeatureId } from './feature-catalog.types';
export {
  calculateMonthlyTotalPhp,
  getFeaturePriceForTier,
  ORGANIZATION_SCALE_TIERS,
  type OrganizationScaleTier,
} from './organization-scale';

export type FeatureCatalogEntry = {
  id: BillableFeatureId | 'base';
  name: string;
  description: string;
  optional: boolean;
};

const FEATURE_DEFINITIONS: FeatureCatalogEntry[] = [
  {
    id: 'base',
    name: 'Base plan',
    description:
      'Sign-in, admin and HR panels, employee biometric clock-in, attendance, DTR, and employee records.',
    optional: false,
  },
  {
    id: 'leave',
    name: 'Leave requests and approvals',
    description: 'Employee leave requests, balances, and manager approvals.',
    optional: true,
  },
  {
    id: 'live_tracking',
    name: 'Live tracking',
    description: 'Real-time employee location map while on duty.',
    optional: true,
  },
  {
    id: 'payroll',
    name: 'Payroll system',
    description: 'Payroll runs computed from attendance and leave data.',
    optional: true,
  },
];

export const BILLABLE_FEATURE_IDS: BillableFeatureId[] = [
  'leave',
  'live_tracking',
  'payroll',
];

export function getFeatureCatalogForTier(
  tier: OrganizationScaleTier,
): Array<FeatureCatalogEntry & { pricePhp: number }> {
  return FEATURE_DEFINITIONS.map((feature) => ({
    ...feature,
    pricePhp: getFeaturePriceForTier(feature.id, tier),
  }));
}

export function getFeatureById(
  featureId: string,
  tier: OrganizationScaleTier = 'small',
): (FeatureCatalogEntry & { pricePhp: number }) | undefined {
  return getFeatureCatalogForTier(tier).find(
    (feature) => feature.id === featureId,
  );
}

export function isBillableFeatureId(
  featureId: string,
): featureId is BillableFeatureId {
  return BILLABLE_FEATURE_IDS.includes(featureId as BillableFeatureId);
}

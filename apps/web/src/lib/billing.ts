import { apiFetch } from './api';

export type BillableFeatureId = 'live_tracking' | 'payroll' | 'leave';

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

export type FeatureCatalogEntry = {
  id: BillableFeatureId | 'base';
  name: string;
  description: string;
  pricePhp: number;
  optional: boolean;
};

export type PendingSubscriptionChange = {
  id: string;
  featureId: BillableFeatureId;
  action: 'add' | 'remove';
  effectiveAt: string;
  effectiveDateLabel: string;
  requestedAt: string;
};

export type OrganizationSubscription = {
  organizationId: string;
  currency: 'PHP';
  status: 'active' | 'cancelled';
  employeeCount: number;
  scaleTier: OrganizationScaleTier;
  scaleTierLabel: string;
  scaleTierRange: string;
  scaleTiers: ScaleTierDefinition[];
  basePlan?: FeatureCatalogEntry;
  features: FeatureCatalogEntry[];
  activeFeatures: BillableFeatureId[];
  pendingChanges: PendingSubscriptionChange[];
  nextChangeEffectiveAt: string;
  nextChangeEffectiveDateLabel: string;
  currentMonthlyTotalPhp: number;
  projectedMonthlyTotalPhp: number;
};

export type SubscriptionInquiryResponse = {
  id: string;
  employeeCount: number;
  scaleTier: OrganizationScaleTier;
  scaleTierLabel: string;
  estimatedMonthlyTotalPhp: number;
  selectedFeatures: BillableFeatureId[];
  features: FeatureCatalogEntry[];
  message: string;
};

export type PricingCatalog = {
  scaleTiers: Array<{
    id: OrganizationScaleTier;
    label: string;
    employeeRange: string;
    features: FeatureCatalogEntry[];
  }>;
};

export const ORGANIZATION_SCALE_TIERS: ScaleTierDefinition[] = [
  {
    id: 'small',
    label: 'Small',
    employeeRange: 'Up to 20 employees',
    minEmployees: 0,
    maxEmployees: 20,
    pricing: { base: 299, leave: 99, live_tracking: 199, payroll: 149 },
  },
  {
    id: 'medium',
    label: 'Medium',
    employeeRange: '21–100 employees',
    minEmployees: 21,
    maxEmployees: 100,
    pricing: { base: 699, leave: 229, live_tracking: 449, payroll: 349 },
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    employeeRange: '101+ employees',
    minEmployees: 101,
    maxEmployees: null,
    pricing: { base: 1299, leave: 399, live_tracking: 799, payroll: 599 },
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

export function getFeatureCatalogForTier(
  tier: OrganizationScaleTier,
): FeatureCatalogEntry[] {
  const definition = getScaleTierDefinition(tier);

  return [
    {
      id: 'base',
      name: 'Base plan',
      description:
        'Sign-in, admin and HR panels, employee biometric clock-in, attendance, DTR, and employee records.',
      pricePhp: definition.pricing.base,
      optional: false,
    },
    {
      id: 'leave',
      name: 'Leave requests and approvals',
      description: 'Employee leave requests, balances, and manager approvals.',
      pricePhp: definition.pricing.leave,
      optional: true,
    },
    {
      id: 'live_tracking',
      name: 'Live tracking',
      description: 'Real-time employee location map while on duty.',
      pricePhp: definition.pricing.live_tracking,
      optional: true,
    },
    {
      id: 'payroll',
      name: 'Payroll system',
      description: 'Payroll runs computed from attendance and leave data.',
      pricePhp: definition.pricing.payroll,
      optional: true,
    },
  ];
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

export async function getPricingCatalog(): Promise<PricingCatalog> {
  return apiFetch('/billing/pricing-catalog');
}

export async function submitSubscriptionInquiry(input: {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  message?: string;
  employeeCount: number;
  selectedFeatures: BillableFeatureId[];
}): Promise<SubscriptionInquiryResponse> {
  return apiFetch('/subscription-inquiries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getOrganizationSubscription(): Promise<OrganizationSubscription> {
  return apiFetch('/billing/subscription');
}

export async function scheduleSubscriptionFeatureChange(input: {
  featureId: BillableFeatureId;
  action: 'add' | 'remove';
}): Promise<OrganizationSubscription> {
  return apiFetch('/billing/features', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function cancelPendingSubscriptionChange(
  changeId: string,
): Promise<OrganizationSubscription> {
  return apiFetch(`/billing/features/pending/${encodeURIComponent(changeId)}`, {
    method: 'DELETE',
  });
}

export async function enableAllFeaturesForDemo(): Promise<OrganizationSubscription> {
  return apiFetch('/billing/demo/enable-all', {
    method: 'POST',
  });
}

export function formatPhp(amount: number): string {
  return `PHP ${amount.toLocaleString('en-PH')}`;
}

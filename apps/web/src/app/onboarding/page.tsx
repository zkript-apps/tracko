'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import {
  completeOnboarding,
  getOnboardingStatus,
  getPostAuthPath,
  type BranchInput,
} from '@/lib/onboarding';
import {
  DEFAULT_ORG_BRANDING,
  normalizeHexColor,
  uploadOrgLogo,
  type BrandingColors,
} from '@/lib/branding';
import {
  formatPhp,
  getFeatureCatalogForTier,
  type BillableFeatureId,
} from '@/lib/billing';
import {
  DEFAULT_LEAVE_POLICY,
  LEAVE_ACCRUAL_METHODS,
  LEAVE_RESET_TYPES,
  type LeaveAccrualMethod,
  type LeavePolicy,
  type LeaveResetType,
} from '@/lib/leave-policy';
import { BrandingEditor } from '@/components/branding/branding-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { NativeSelect } from '@/components/ui/native-select';
import { OnboardingSkeleton } from '@/components/ui/onboarding-skeleton';
import { isOrgAppearanceEnabled } from '@/lib/feature-flags';

type OnboardingStepId =
  | 'organization'
  | 'branches'
  | 'features'
  | 'leave'
  | 'appearance';

function buildOnboardingSteps(
  leaveSelected: boolean,
  appearanceEnabled: boolean,
): OnboardingStepId[] {
  const steps: OnboardingStepId[] = [
    'organization',
    'branches',
    'features',
  ];
  if (leaveSelected) {
    steps.push('leave');
  }
  if (appearanceEnabled) {
    steps.push('appearance');
  }
  return steps;
}

const industries = [
  'Retail',
  'Food & Beverage',
  'Construction',
  'Healthcare',
  'Logistics',
  'Manufacturing',
  'Professional Services',
  'Other',
];

const timezones = [
  { value: 'Asia/Manila', label: 'Philippines (Asia/Manila)' },
  { value: 'Asia/Singapore', label: 'Singapore (Asia/Singapore)' },
  { value: 'Asia/Tokyo', label: 'Japan (Asia/Tokyo)' },
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type OnboardingDraft = {
  stepId?: OnboardingStepId;
  /** @deprecated Prefer stepId; kept for older drafts */
  step?: number;
  name: string;
  industry: string;
  timezone: string;
  address: string;
  city: string;
  phone: string;
  branches: BranchInput[];
  selectedFeatures?: BillableFeatureId[];
  leavePolicy: LeavePolicy;
  branding: BrandingColors;
};

function onboardingDraftKey(userId: string) {
  return `tracko:onboarding-draft:${userId}`;
}

function readOnboardingDraft(userId: string): OnboardingDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(onboardingDraftKey(userId));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    return null;
  }
}

function writeOnboardingDraft(userId: string, draft: OnboardingDraft) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(onboardingDraftKey(userId), JSON.stringify(draft));
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

function clearOnboardingDraft(userId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(onboardingDraftKey(userId));
  } catch {
    // Ignore storage failures
  }
}

function emptyBranch(): BranchInput {
  return { name: '', address: '', city: '', isHeadOffice: false };
}

function parseIntegerInput(
  value: string,
  options: { min: number; max: number },
): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return options.min;
  }
  return Math.min(options.max, Math.max(options.min, parsed));
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [stepId, setStepId] = useState<OnboardingStepId>('organization');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState('Asia/Manila');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [branches, setBranches] = useState<BranchInput[]>([
    { ...emptyBranch(), name: 'Head Office', isHeadOffice: true },
  ]);
  const [selectedFeatures, setSelectedFeatures] = useState<BillableFeatureId[]>(
    [],
  );
  const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>({
    ...DEFAULT_LEAVE_POLICY,
    periodAutoGrant: {
      vacation: 5,
      sick: 5,
      emergency: 0,
    },
  });
  const [branding, setBranding] = useState<BrandingColors>({
    primaryColor: DEFAULT_ORG_BRANDING.primaryColor,
    secondaryColor: DEFAULT_ORG_BRANDING.secondaryColor,
    accentColor: DEFAULT_ORG_BRANDING.accentColor,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const appearanceEnabled = isOrgAppearanceEnabled();
  const leaveSelected = selectedFeatures.includes('leave');
  const stepSequence = useMemo(
    () => buildOnboardingSteps(leaveSelected, appearanceEnabled),
    [appearanceEnabled, leaveSelected],
  );
  const totalSteps = stepSequence.length;
  const step = Math.max(1, stepSequence.indexOf(stepId) + 1);
  const featureCatalog = useMemo(() => getFeatureCatalogForTier('small'), []);
  const addonMonthlyTotal = useMemo(() => {
    const pricing = getFeatureCatalogForTier('small');
    return selectedFeatures.reduce((total, featureId) => {
      const entry = pricing.find((feature) => feature.id === featureId);
      return total + (entry?.pricePhp ?? 0);
    }, 0);
  }, [selectedFeatures]);
  const basePlanPrice =
    featureCatalog.find((feature) => feature.id === 'base')?.pricePhp ?? 0;

  function goToNextStep() {
    const index = stepSequence.indexOf(stepId);
    if (index >= 0 && index < stepSequence.length - 1) {
      setStepId(stepSequence[index + 1]);
    }
  }

  function goToPreviousStep() {
    const index = stepSequence.indexOf(stepId);
    if (index > 0) {
      setStepId(stepSequence[index - 1]);
    }
  }

  function toggleFeature(featureId: BillableFeatureId) {
    setSelectedFeatures((current) =>
      current.includes(featureId)
        ? current.filter((id) => id !== featureId)
        : [...current, featureId],
    );
  }

  const isLastStep = stepId === stepSequence[stepSequence.length - 1];

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace('/sign-in');
      return;
    }

    void getOnboardingStatus()
      .then(async (status) => {
        if (!status.needsOnboarding) {
          clearOnboardingDraft(session.user.id);
          const nextPath = await getPostAuthPath();
          router.replace(nextPath);
          return;
        }

        const draft = readOnboardingDraft(session.user.id);
        if (draft) {
          const draftFeatures = (draft.selectedFeatures ?? []).filter(
            (featureId): featureId is BillableFeatureId =>
              featureId === 'leave' ||
              featureId === 'live_tracking' ||
              featureId === 'payroll',
          );
          setSelectedFeatures(draftFeatures);
          const restoredSequence = buildOnboardingSteps(
            draftFeatures.includes('leave'),
            appearanceEnabled,
          );
          if (
            draft.stepId &&
            restoredSequence.includes(draft.stepId)
          ) {
            setStepId(draft.stepId);
          } else if (draft.step) {
            const clamped = Math.min(
              Math.max(draft.step, 1),
              restoredSequence.length,
            );
            setStepId(restoredSequence[clamped - 1] ?? 'organization');
          }
          setName(draft.name ?? '');
          setIndustry(draft.industry ?? '');
          setTimezone(draft.timezone || 'Asia/Manila');
          setAddress(draft.address ?? '');
          setCity(draft.city ?? '');
          setPhone(draft.phone ?? '');
          setBranches(
            draft.branches?.length
              ? draft.branches
              : [{ ...emptyBranch(), name: 'Head Office', isHeadOffice: true }],
          );
          setLeavePolicy({
            ...DEFAULT_LEAVE_POLICY,
            ...draft.leavePolicy,
            periodAutoGrant: {
              ...DEFAULT_LEAVE_POLICY.periodAutoGrant,
              ...draft.leavePolicy?.periodAutoGrant,
            },
            accrual: {
              ...DEFAULT_LEAVE_POLICY.accrual,
              ...draft.leavePolicy?.accrual,
            },
            silSafeguard: {
              ...DEFAULT_LEAVE_POLICY.silSafeguard,
              ...draft.leavePolicy?.silSafeguard,
            },
            vacation: {
              ...DEFAULT_LEAVE_POLICY.vacation,
              ...draft.leavePolicy?.vacation,
            },
            sick: {
              ...DEFAULT_LEAVE_POLICY.sick,
              ...draft.leavePolicy?.sick,
            },
          });
          setBranding({
            primaryColor:
              draft.branding?.primaryColor ?? DEFAULT_ORG_BRANDING.primaryColor,
            secondaryColor:
              draft.branding?.secondaryColor ??
              DEFAULT_ORG_BRANDING.secondaryColor,
            accentColor:
              draft.branding?.accentColor ?? DEFAULT_ORG_BRANDING.accentColor,
          });
        } else if (status.organization?.name) {
          setName(status.organization.name);
        }
      })
      .finally(() => {
        setDraftReady(true);
        setCheckingStatus(false);
      });
  }, [appearanceEnabled, isPending, router, session]);

  useEffect(() => {
    if (!stepSequence.includes(stepId)) {
      setStepId('features');
    }
  }, [stepId, stepSequence]);

  useEffect(() => {
    if (!session?.user.id || !draftReady || checkingStatus) {
      return;
    }

    writeOnboardingDraft(session.user.id, {
      stepId,
      name,
      industry,
      timezone,
      address,
      city,
      phone,
      branches,
      selectedFeatures,
      leavePolicy,
      branding,
    });
  }, [
    address,
    branding,
    branches,
    checkingStatus,
    city,
    draftReady,
    industry,
    leavePolicy,
    name,
    phone,
    selectedFeatures,
    session?.user.id,
    stepId,
    timezone,
  ]);

  function updateBranch(index: number, patch: Partial<BranchInput>) {
    setBranches((current) =>
      current.map((branch, branchIndex) =>
        branchIndex === index ? { ...branch, ...patch } : branch,
      ),
    );
  }

  function addBranch() {
    setBranches((current) => [...current, emptyBranch()]);
  }

  function removeBranch(index: number) {
    setBranches((current) =>
      current.filter((_, branchIndex) => branchIndex !== index),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { updatedAt: _updatedAt, ...leavePolicyInput } = leavePolicy;

      await completeOnboarding({
        name,
        industry,
        timezone,
        address,
        city,
        phone,
        branches,
        selectedFeatures,
        ...(leaveSelected ? { leavePolicy: leavePolicyInput } : {}),
        ...(appearanceEnabled
          ? {
              branding: {
                primaryColor: normalizeHexColor(
                  branding.primaryColor,
                  DEFAULT_ORG_BRANDING.primaryColor,
                ),
                secondaryColor: normalizeHexColor(
                  branding.secondaryColor,
                  DEFAULT_ORG_BRANDING.secondaryColor,
                ),
                accentColor: normalizeHexColor(
                  branding.accentColor,
                  DEFAULT_ORG_BRANDING.accentColor,
                ),
              },
            }
          : {}),
      });

      if (appearanceEnabled && logoFile) {
        try {
          await uploadOrgLogo(logoFile);
        } catch {
          // Org is created; logo can be uploaded later from settings.
        }
      }

      if (session?.user.id) {
        clearOnboardingDraft(session.user.id);
      }

      const nextPath = await getPostAuthPath();
      router.push(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to complete onboarding.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (isPending || checkingStatus) {
    return <OnboardingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Organization setup
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Set up {session?.user.name.split(' ')[0]}&apos;s company
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of {totalSteps} — organization, branches, features
            {leaveSelected ? ', leave policy' : ''}
            {appearanceEnabled ? ', then branding' : ''}.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-8 shadow-xl"
        >
          {stepId === 'organization' ? (
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-muted-foreground">
                  Organization name
                </span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                  placeholder="Acme Logistics Inc."
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-muted-foreground">Industry</span>
                <NativeSelect
                  required
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  className="border-border bg-background text-foreground"
                >
                  <option value="">Select industry</option>
                  {industries.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-muted-foreground">Timezone</span>
                <NativeSelect
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="border-border bg-background text-foreground"
                >
                  {timezones.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm text-muted-foreground">City</span>
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                    placeholder="Quezon City"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                    placeholder="+63 912 345 6789"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm text-muted-foreground">
                  Head office address
                </span>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                  placeholder="123 Main Street, Barangay Example"
                />
              </label>

              <Button
                type="button"
                size="lg"
                onClick={() => setStepId('branches')}
                disabled={!name.trim() || !industry}
                className="w-full"
              >
                Continue to branches
              </Button>
            </div>
          ) : null}

          {stepId === 'branches' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-foreground">Branches</h2>
                <p className="text-sm text-muted-foreground">
                  Add each office or site your organization operates. HR users
                  will be assigned to oversee specific branches later.
                </p>
              </div>

              {branches.map((branch, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      Branch {index + 1}
                    </p>
                    {branches.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeBranch(index)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <input
                    required
                    value={branch.name}
                    onChange={(event) =>
                      updateBranch(index, { name: event.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                    placeholder="Branch name"
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={branch.city ?? ''}
                      onChange={(event) =>
                        updateBranch(index, { city: event.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                      placeholder="City"
                    />
                    <input
                      value={branch.address ?? ''}
                      onChange={(event) =>
                        updateBranch(index, { address: event.target.value })
                      }
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                      placeholder="Address"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(branch.isHeadOffice)}
                      onChange={(event) =>
                        updateBranch(index, {
                          isHeadOffice: event.target.checked,
                        })
                      }
                      className="rounded border-border"
                    />
                    Head office
                  </label>
                </div>
              ))}

              <button
                type="button"
                onClick={addBranch}
                className="w-full rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                + Add another branch
              </button>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setStepId('organization')}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setStepId('features')}
                  className="flex-1"
                >
                  Continue to features
                </Button>
              </div>
            </div>
          ) : null}

          {stepId === 'features' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-foreground">
                  Features
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose the add-ons you want to avail. Base plan is always
                  included. Your subscription stays pending until Tracko
                  activates it.
                </p>
              </div>

              <div className="space-y-3">
                {featureCatalog.map((feature) => {
                  const isBase = feature.id === 'base';
                  const checked =
                    isBase ||
                    selectedFeatures.includes(feature.id as BillableFeatureId);

                  return (
                    <label
                      key={feature.id}
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                        isBase
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border bg-background'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isBase}
                        onChange={() => {
                          if (!isBase) {
                            toggleFeature(feature.id as BillableFeatureId);
                          }
                        }}
                        className="mt-1 rounded border-border"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-medium text-foreground">
                            {feature.name}
                          </span>
                          <span className="shrink-0 text-sm text-primary">
                            {formatPhp(feature.pricePhp)}/mo
                          </span>
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {feature.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="rounded-xl border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Selected add-ons
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {formatPhp(addonMonthlyTotal)}
                  <span className="text-base font-normal text-muted-foreground">
                    /mo
                  </span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Plus base plan (from {formatPhp(basePlanPrice)}/mo depending on
                  your invited scale). Subscription activates after Tracko
                  approval.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setStepId('branches')}
                >
                  Back
                </Button>
                {isLastStep ? (
                  <LoadingButton
                    type="submit"
                    size="lg"
                    loading={loading}
                    loadingText="Creating organization…"
                    className="flex-1"
                  >
                    Finish setup
                  </LoadingButton>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={goToNextStep}
                    className="flex-1"
                  >
                    {leaveSelected
                      ? 'Continue to leave policy'
                      : appearanceEnabled
                        ? 'Continue to appearance'
                        : 'Continue'}
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {stepId === 'leave' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-foreground">
                  Leave policy
                </h2>
                <p className="text-sm text-muted-foreground">
                  Set how leave resets, accrues, and how many annual credits
                  employees receive. You can refine rules later in Leave
                  settings.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reset schedule</Label>
                  <NativeSelect
                    value={leavePolicy.resetType}
                    onChange={(event) =>
                      setLeavePolicy((current) => ({
                        ...current,
                        resetType: event.target.value as LeaveResetType,
                      }))
                    }
                    className="border-border bg-background text-foreground"
                  >
                    {LEAVE_RESET_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                {leavePolicy.resetType === 'fiscal' ? (
                  <div className="space-y-2">
                    <Label>Fiscal year starts</Label>
                    <NativeSelect
                      value={String(leavePolicy.fiscalYearStartMonth)}
                      onChange={(event) =>
                        setLeavePolicy((current) => ({
                          ...current,
                          fiscalYearStartMonth: Number(event.target.value),
                        }))
                      }
                      className="border-border bg-background text-foreground"
                    >
                      {MONTHS.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Accrual method</Label>
                <NativeSelect
                  value={leavePolicy.accrual.method}
                  onChange={(event) =>
                    setLeavePolicy((current) => ({
                      ...current,
                      accrual: {
                        ...current.accrual,
                        method: event.target.value as LeaveAccrualMethod,
                      },
                    }))
                  }
                  className="border-border bg-background text-foreground"
                >
                  {LEAVE_ACCRUAL_METHODS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-sm text-muted-foreground">
                  {
                    LEAVE_ACCRUAL_METHODS.find(
                      (option) => option.value === leavePolicy.accrual.method,
                    )?.description
                  }
                </p>
              </div>

              {leavePolicy.accrual.method === 'monthly_cutoff' ? (
                <div className="space-y-2">
                  <Label>Monthly cutoff day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={leavePolicy.accrual.monthlyCutoffDay}
                    onChange={(event) =>
                      setLeavePolicy((current) => ({
                        ...current,
                        accrual: {
                          ...current.accrual,
                          monthlyCutoffDay: parseIntegerInput(
                            event.target.value,
                            { min: 1, max: 28 },
                          ),
                        },
                      }))
                    }
                  />
                </div>
              ) : null}

              <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Annual leave credits
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Days granted each leave period before proration.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {(
                    [
                      ['vacation', 'Vacation'],
                      ['sick', 'Sick'],
                      ['emergency', 'Emergency'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={leavePolicy.periodAutoGrant[key]}
                        onChange={(event) =>
                          setLeavePolicy((current) => ({
                            ...current,
                            periodAutoGrant: {
                              ...current.periodAutoGrant,
                              [key]: parseIntegerInput(event.target.value, {
                                min: 0,
                                max: 365,
                              }),
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={leavePolicy.silSafeguard.enabled}
                    onChange={(event) =>
                      setLeavePolicy((current) => ({
                        ...current,
                        silSafeguard: {
                          ...current.silSafeguard,
                          enabled: event.target.checked,
                        },
                      }))
                    }
                    className="rounded border-border"
                  />
                  Enable SIL safeguard (PH statutory leave floor)
                </label>
                {leavePolicy.silSafeguard.enabled ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Minimum SIL days</Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={leavePolicy.silSafeguard.minDays}
                        onChange={(event) =>
                          setLeavePolicy((current) => ({
                            ...current,
                            silSafeguard: {
                              ...current.silSafeguard,
                              minDays: parseIntegerInput(event.target.value, {
                                min: 0,
                                max: 30,
                              }),
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tenure months required</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={leavePolicy.silSafeguard.tenureMonths}
                        onChange={(event) =>
                          setLeavePolicy((current) => ({
                            ...current,
                            silSafeguard: {
                              ...current.silSafeguard,
                              tenureMonths: parseIntegerInput(
                                event.target.value,
                                { min: 1, max: 24 },
                              ),
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {error && isLastStep ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={goToPreviousStep}
                >
                  Back
                </Button>
                {isLastStep ? (
                  <LoadingButton
                    type="submit"
                    size="lg"
                    loading={loading}
                    loadingText="Creating organization…"
                    className="flex-1"
                  >
                    Finish setup
                  </LoadingButton>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={goToNextStep}
                    className="flex-1"
                  >
                    Continue to appearance
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {stepId === 'appearance' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-foreground">
                  Appearance
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose your brand colors and logo. The dashboard UI will use
                  these across backgrounds, buttons, and borders.
                </p>
              </div>

              <BrandingEditor
                value={branding}
                onChange={setBranding}
                onLogoFileChange={setLogoFile}
              />

              {error ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={goToPreviousStep}
                >
                  Back
                </Button>
                <LoadingButton
                  type="submit"
                  size="lg"
                  loading={loading}
                  loadingText="Creating organization…"
                  className="flex-1"
                >
                  Finish setup
                </LoadingButton>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

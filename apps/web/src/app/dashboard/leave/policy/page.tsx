'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCog, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
import {
  DEFAULT_LEAVE_POLICY,
  DEFAULT_LEAVE_ACCRUAL,
  DEFAULT_PERIOD_AUTO_GRANT,
  getLeavePolicy,
  LEAVE_ACCRUAL_METHODS,
  LEAVE_CONVERSION_TARGETS,
  LEAVE_RESET_TYPES,
  updateLeavePolicy,
  type LeaveAccrualMethod,
  type LeaveConversionTarget,
  type LeavePolicy,
  type LeaveResetType,
  type LeaveTypeRules,
} from '@/lib/leave-policy';
import { getOrganizationSubscription } from '@/lib/billing';
import { parseIntegerInput } from '@/lib/number-input';
import { isOrgAdminRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-border"
      />
      {label}
    </label>
  );
}

function LeaveTypeRulesEditor({
  title,
  rules,
  onChange,
}: {
  title: string;
  rules: LeaveTypeRules;
  onChange: (rules: LeaveTypeRules) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-5">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="mt-4 space-y-4">
        <Toggle
          label="Allow carry-over of unused days"
          checked={rules.carryOver.enabled}
          onChange={(enabled) =>
            onChange({
              ...rules,
              carryOver: { ...rules.carryOver, enabled },
            })
          }
        />
        {rules.carryOver.enabled ? (
          <label className="block space-y-2">
            <Label>Maximum carry-over days (0 = unlimited)</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={rules.carryOver.maxDays}
              onChange={(event) =>
                onChange({
                  ...rules,
                  carryOver: {
                    ...rules.carryOver,
                    maxDays: parseIntegerInput(event.target.value, {
                      min: 0,
                      max: 365,
                    }),
                  },
                })
              }
              className="max-w-xs"
            />
          </label>
        ) : null}

        <Toggle
          label="Forfeit remaining unused days at period end"
          checked={rules.forfeiture.enabled}
          onChange={(enabled) =>
            onChange({
              ...rules,
              forfeiture: { enabled },
            })
          }
        />

        <Toggle
          label="Convert unused days instead of forfeiting"
          checked={rules.conversion.enabled}
          onChange={(enabled) =>
            onChange({
              ...rules,
              conversion: { ...rules.conversion, enabled },
            })
          }
        />
        {rules.conversion.enabled ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Conversion target</Label>
              <Select
                value={rules.conversion.target}
                onValueChange={(value) =>
                  onChange({
                    ...rules,
                    conversion: {
                      ...rules.conversion,
                      target: value as LeaveConversionTarget,
                    },
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select conversion target" />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_CONVERSION_TARGETS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="block space-y-2">
              <Label>Maximum converted days (0 = unlimited)</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={rules.conversion.maxDays}
                onChange={(event) =>
                  onChange({
                    ...rules,
                    conversion: {
                      ...rules.conversion,
                      maxDays: parseIntegerInput(event.target.value, {
                        min: 0,
                        max: 365,
                      }),
                    },
                  })
                }
              />
            </label>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function normalizePolicy(policy: LeavePolicy): LeavePolicy {
  return {
    ...DEFAULT_LEAVE_POLICY,
    ...policy,
    periodAutoGrant: policy.periodAutoGrant ?? DEFAULT_PERIOD_AUTO_GRANT,
    accrual: policy.accrual ?? DEFAULT_LEAVE_ACCRUAL,
  };
}

function getPolicySnapshot(policy: LeavePolicy) {
  return JSON.stringify({
    resetType: policy.resetType,
    fiscalYearStartMonth: policy.fiscalYearStartMonth,
    silSafeguard: policy.silSafeguard,
    periodAutoGrant: policy.periodAutoGrant,
    accrual: policy.accrual,
    vacation: policy.vacation,
    sick: policy.sick,
  });
}

export default function LeavePolicyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [policy, setPolicy] = useState<LeavePolicy>(DEFAULT_LEAVE_POLICY);
  const [savedPolicy, setSavedPolicy] = useState<LeavePolicy>(DEFAULT_LEAVE_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasChanges =
    getPolicySnapshot(policy) !== getPolicySnapshot(savedPolicy);

  useEffect(() => {
    if (!session) {
      return;
    }

    void Promise.all([getTeamOverview(), getOrganizationSubscription()])
      .then(([nextTeam, subscription]) => {
        const role = nextTeam.currentMember?.role ?? 'member';
        if (!isOrgAdminRole(role)) {
          router.replace('/dashboard');
          return;
        }

        if (!subscription.activeFeatures.includes('leave')) {
          router.replace('/dashboard');
          return;
        }

        setTeam(nextTeam);
        return getLeavePolicy();
      })
      .then((nextPolicy) => {
        if (nextPolicy) {
          const normalized = normalizePolicy(nextPolicy);
          setPolicy(normalized);
          setSavedPolicy(normalized);
        }
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false));
  }, [router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasChanges) {
      return;
    }

    setSaving(true);

    try {
      const updated = await updateLeavePolicy({
        resetType: policy.resetType,
        fiscalYearStartMonth: policy.fiscalYearStartMonth,
        silSafeguard: policy.silSafeguard,
        periodAutoGrant: policy.periodAutoGrant,
        accrual: policy.accrual,
        vacation: policy.vacation,
        sick: policy.sick,
      });
      const normalized = normalizePolicy(updated);
      setPolicy(normalized);
      setSavedPolicy(normalized);
      toast.success('Leave policy updated.');
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update leave policy.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !team) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Leave policy</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Configure how leave balances reset each period, the statutory SIL
          safeguard, and company-specific vacation and sick leave rules.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CalendarCog className="size-5 text-primary" />
            Period reset
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <Label>Reset schedule</Label>
              <Select
                value={policy.resetType}
                onValueChange={(value) =>
                  setPolicy((current) => ({
                    ...current,
                    resetType: value as LeaveResetType,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select reset schedule" />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_RESET_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {policy.resetType === 'fiscal' ? (
              <label className="block space-y-2">
                <Label>Fiscal year starts in month</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={policy.fiscalYearStartMonth}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      fiscalYearStartMonth: parseIntegerInput(
                        event.target.value,
                        { min: 1, max: 12 },
                      ),
                    }))
                  }
                />
              </label>
            ) : null}
          </div>

          <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted/20 p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Accrual / proration method
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                How annual leave credits are calculated for employees who start
                mid-period. Employees hired before the period starts receive the
                full annual credits.
              </p>
            </div>
            <label className="block space-y-2">
              <Label>Accrual method</Label>
              <Select
                value={policy.accrual.method}
                onValueChange={(value) =>
                  setPolicy((current) => ({
                    ...current,
                    accrual: {
                      ...current.accrual,
                      method: value as LeaveAccrualMethod,
                    },
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select accrual method" />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_ACCRUAL_METHODS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {
                  LEAVE_ACCRUAL_METHODS.find(
                    (option) => option.value === policy.accrual.method,
                  )?.description
                }
              </p>
            </label>
            {policy.accrual.method === 'monthly_cutoff' ? (
              <label className="block max-w-xs space-y-2">
                <Label>Monthly cutoff day</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={policy.accrual.monthlyCutoffDay}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      accrual: {
                        ...current.accrual,
                        monthlyCutoffDay: parseIntegerInput(event.target.value, {
                          min: 1,
                          max: 28,
                        }),
                      },
                    }))
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Hired on or before this day counts the hire month toward
                  accrual. Hired after it starts next month.
                </p>
              </label>
            ) : null}
            {policy.accrual.method === 'anniversary_full' &&
            policy.resetType !== 'anniversary' ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Anniversary-based full grant works best when the reset schedule
                is set to hire-date anniversary.
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-3 rounded-xl border border-border bg-muted/20 p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Period auto-grant (annual credits)
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Annual leave credits per type. For mid-period hires, the chosen
                accrual method prorates these credits when a new period starts
                for employees who have completed the required tenure.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block space-y-2">
                <Label>Annual vacation leave credits</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={policy.periodAutoGrant.vacation}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      periodAutoGrant: {
                        ...current.periodAutoGrant,
                        vacation: parseIntegerInput(event.target.value, {
                          min: 0,
                          max: 365,
                        }),
                      },
                    }))
                  }
                />
              </label>
              <label className="block space-y-2">
                <Label>Annual sick leave credits</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={policy.periodAutoGrant.sick}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      periodAutoGrant: {
                        ...current.periodAutoGrant,
                        sick: parseIntegerInput(event.target.value, {
                          min: 0,
                          max: 365,
                        }),
                      },
                    }))
                  }
                />
              </label>
              <label className="block space-y-2">
                <Label>Annual emergency leave credits</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={policy.periodAutoGrant.emergency}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      periodAutoGrant: {
                        ...current.periodAutoGrant,
                        emergency: parseIntegerInput(event.target.value, {
                          min: 0,
                          max: 365,
                        }),
                      },
                    }))
                  }
                />
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="size-5 text-primary" />
            SIL safeguard
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enforces the statutory Service Incentive Leave minimum on vacation
            leave after the employee reaches the required tenure.
          </p>
          <div className="mt-4 space-y-4">
            <Toggle
              label="Enable SIL safeguard"
              checked={policy.silSafeguard.enabled}
              onChange={(enabled) =>
                setPolicy((current) => ({
                  ...current,
                  silSafeguard: { ...current.silSafeguard, enabled },
                }))
              }
            />
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block space-y-2">
                <Label>Minimum SIL days</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={policy.silSafeguard.minDays}
                  onChange={(event) =>
                    setPolicy((current) => ({
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
              </label>
              <label className="block space-y-2">
                <Label>Tenure trigger (months)</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={policy.silSafeguard.tenureMonths}
                  onChange={(event) =>
                    setPolicy((current) => ({
                      ...current,
                      silSafeguard: {
                        ...current.silSafeguard,
                        tenureMonths: parseIntegerInput(event.target.value, {
                          min: 1,
                          max: 24,
                        }),
                      },
                    }))
                  }
                />
              </label>
              <div className="flex items-end">
                <Toggle
                  label="Cash out unused SIL at period end"
                  checked={policy.silSafeguard.cashOutUnused}
                  onChange={(cashOutUnused) =>
                    setPolicy((current) => ({
                      ...current,
                      silSafeguard: {
                        ...current.silSafeguard,
                        cashOutUnused,
                      },
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <LeaveTypeRulesEditor
          title="Vacation leave (VL) rules"
          rules={policy.vacation}
          onChange={(vacation) =>
            setPolicy((current) => ({ ...current, vacation }))
          }
        />

        <LeaveTypeRulesEditor
          title="Sick leave (SL) rules"
          rules={policy.sick}
          onChange={(sick) => setPolicy((current) => ({ ...current, sick }))}
        />

        <LoadingButton
          type="submit"
          loading={saving}
          loadingText="Saving…"
          disabled={!hasChanges}
        >
          <Save className="size-4" />
          Save leave policy
        </LoadingButton>
      </form>
    </div>
  );
}

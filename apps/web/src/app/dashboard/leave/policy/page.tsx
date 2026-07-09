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
  getLeavePolicy,
  LEAVE_CONVERSION_TARGETS,
  LEAVE_RESET_TYPES,
  updateLeavePolicy,
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

export default function LeavePolicyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [policy, setPolicy] = useState<LeavePolicy>(DEFAULT_LEAVE_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          setPolicy(nextPolicy);
        }
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false));
  }, [router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const updated = await updateLeavePolicy({
        resetType: policy.resetType,
        fiscalYearStartMonth: policy.fiscalYearStartMonth,
        silSafeguard: policy.silSafeguard,
        vacation: policy.vacation,
        sick: policy.sick,
      });
      setPolicy(updated);
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

        <LoadingButton type="submit" loading={saving} loadingText="Saving…">
          <Save className="size-4" />
          Save leave policy
        </LoadingButton>
      </form>
    </div>
  );
}

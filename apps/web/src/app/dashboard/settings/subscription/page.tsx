'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
import {
  cancelPendingSubscriptionChange,
  cancelPendingSubscriptionScaleChange,
  enableAllFeaturesForDemo,
  formatPhp,
  getOrganizationSubscription,
  scheduleSubscriptionFeatureChange,
  scheduleSubscriptionScaleChange,
  type BillableFeatureId,
  type OrganizationScaleTier,
  type OrganizationSubscription,
} from '@/lib/billing';
import { isOrgAdminRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

export default function SubscriptionSettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [subscription, setSubscription] =
    useState<OrganizationSubscription | null>(null);
  const [loadingFeature, setLoadingFeature] = useState<string | null>(null);
  const [loadingScale, setLoadingScale] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancellingScale, setCancellingScale] = useState(false);
  const [demoEnabling, setDemoEnabling] = useState(false);

  useEffect(() => {
    if (!session) {
      return;
    }

    void getTeamOverview()
      .then((nextTeam) => {
        const role = nextTeam.currentMember?.role ?? 'member';
        if (!isOrgAdminRole(role)) {
          router.replace('/dashboard');
          return;
        }

        setTeam(nextTeam);
        return getOrganizationSubscription();
      })
      .then((nextSubscription) => {
        if (nextSubscription) {
          setSubscription(nextSubscription);
        }
      })
      .catch(() => router.replace('/dashboard'));
  }, [router, session]);

  async function handleSchedule(
    featureId: BillableFeatureId,
    action: 'add' | 'remove',
  ) {
    setLoadingFeature(`${action}:${featureId}`);

    try {
      const next = await scheduleSubscriptionFeatureChange({
        featureId,
        action,
      });
      setSubscription(next);
      toast.success(
        action === 'add'
          ? 'Feature add scheduled for 30 days from now.'
          : 'Feature removal scheduled for 30 days from now.',
      );
    } catch (scheduleError) {
      toast.error(
        scheduleError instanceof Error
          ? scheduleError.message
          : 'Unable to update subscription.',
      );
    } finally {
      setLoadingFeature(null);
    }
  }

  async function handleScheduleScale(scaleTier: OrganizationScaleTier) {
    setLoadingScale(scaleTier);

    try {
      const next = await scheduleSubscriptionScaleChange(scaleTier);
      setSubscription(next);
      toast.success('Scale change scheduled for 30 days from now.');
    } catch (scheduleError) {
      toast.error(
        scheduleError instanceof Error
          ? scheduleError.message
          : 'Unable to update organization scale.',
      );
    } finally {
      setLoadingScale(null);
    }
  }

  async function handleCancel(changeId: string) {
    setCancellingId(changeId);

    try {
      const next = await cancelPendingSubscriptionChange(changeId);
      setSubscription(next);
      toast.success('Scheduled change canceled.');
    } catch (cancelError) {
      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : 'Unable to cancel scheduled change.',
      );
    } finally {
      setCancellingId(null);
    }
  }

  async function handleCancelScale() {
    setCancellingScale(true);

    try {
      const next = await cancelPendingSubscriptionScaleChange();
      setSubscription(next);
      toast.success('Scheduled scale change canceled.');
    } catch (cancelError) {
      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : 'Unable to cancel scheduled scale change.',
      );
    } finally {
      setCancellingScale(false);
    }
  }

  async function handleEnableAllForDemo() {
    setDemoEnabling(true);

    try {
      const next = await enableAllFeaturesForDemo();
      setSubscription(next);
      toast.success('All features enabled for demo.');
    } catch (demoError) {
      toast.error(
        demoError instanceof Error
          ? demoError.message
          : 'Unable to enable demo features.',
      );
    } finally {
      setDemoEnabling(false);
    }
  }

  if (!team || !subscription) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const optionalFeatures = subscription.features.filter(
    (feature) => feature.optional,
  );
  const pendingScale = subscription.pendingScaleChange;

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage scale and add-ons for {team.organization.name}. Changes take
          effect 30 days after you schedule them.
        </p>
      </div>

      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Demo-only shortcut
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Instantly enables leave, live tracking, and payroll for this
              organization and clears scheduled subscription changes.
            </p>
          </div>
          <LoadingButton
            type="button"
            loading={demoEnabling}
            loadingText="Enabling…"
            onClick={handleEnableAllForDemo}
          >
            Enable all features
          </LoadingButton>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Current monthly total</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {formatPhp(subscription.currentMonthlyTotalPhp)}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            After scheduled changes
          </p>
          <p className="mt-2 text-3xl font-semibold text-primary">
            {formatPhp(subscription.projectedMonthlyTotalPhp)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Next change effective:{' '}
            {subscription.nextChangeEffectiveDateLabel}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5 sm:col-span-2 lg:col-span-1">
          <p className="text-sm text-muted-foreground">Employees</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {subscription.employeeCount}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Current scale: {subscription.scaleTierLabel} (
            {subscription.scaleTierRange})
          </p>
        </article>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Organization scale
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your scale independently. Pricing follows the selected scale,
            not your employee count.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {subscription.scaleTiers.map((tier) => {
            const isCurrent = subscription.scaleTier === tier.id;
            const isPending = pendingScale?.scaleTier === tier.id;

            return (
              <article
                key={tier.id}
                className={`rounded-2xl border bg-card p-5 ${
                  isCurrent
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border'
                }`}
              >
                <p className="text-sm text-muted-foreground">
                  Organization scale
                </p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {tier.label}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tier.employeeRange}
                </p>
                <p className="mt-3 text-sm font-medium text-foreground">
                  Base {formatPhp(tier.pricing.base)}/mo
                </p>

                {isCurrent ? (
                  <p className="mt-3 text-sm text-primary">Current scale</p>
                ) : isPending ? (
                  <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                    Scheduled for {pendingScale.effectiveDateLabel}
                  </p>
                ) : pendingScale ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Cancel the pending change to switch here
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Switch takes effect in 30 days
                  </p>
                )}

                <div className="mt-4">
                  {isCurrent ? null : isPending ? (
                    <LoadingButton
                      type="button"
                      variant="outline"
                      loading={cancellingScale}
                      loadingText="Canceling…"
                      onClick={handleCancelScale}
                    >
                      Cancel change
                    </LoadingButton>
                  ) : (
                    <LoadingButton
                      type="button"
                      variant="outline"
                      disabled={Boolean(pendingScale)}
                      loading={loadingScale === tier.id}
                      loadingText="Scheduling…"
                      onClick={() => handleScheduleScale(tier.id)}
                    >
                      Switch to {tier.label}
                    </LoadingButton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Base plan</h2>
        {subscription.basePlan ? (
          <article className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">
                  {subscription.basePlan.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {subscription.basePlan.description}
                </p>
              </div>
              <p className="text-sm font-medium text-primary">
                {formatPhp(subscription.basePlan.pricePhp)}/mo
              </p>
            </div>
          </article>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Add-on features</h2>
        {optionalFeatures.map((feature) => {
          const featureId = feature.id as BillableFeatureId;
          const isActive = subscription.activeFeatures.includes(featureId);
          const pending = subscription.pendingChanges.find(
            (change) => change.featureId === featureId,
          );

          return (
            <article
              key={feature.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{feature.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {formatPhp(feature.pricePhp)}/month
                  </p>
                  {pending ? (
                    <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                      Scheduled to {pending.action === 'add' ? 'add' : 'remove'}{' '}
                      on {pending.effectiveDateLabel}.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isActive ? 'Currently active' : 'Not active'}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {pending ? (
                    <LoadingButton
                      type="button"
                      variant="outline"
                      loading={cancellingId === pending.id}
                      loadingText="Canceling…"
                      onClick={() => handleCancel(pending.id)}
                    >
                      Cancel change
                    </LoadingButton>
                  ) : isActive ? (
                    <LoadingButton
                      type="button"
                      variant="outline"
                      loading={loadingFeature === `remove:${featureId}`}
                      loadingText="Scheduling…"
                      onClick={() => handleSchedule(featureId, 'remove')}
                    >
                      Remove feature
                    </LoadingButton>
                  ) : (
                    <LoadingButton
                      type="button"
                      loading={loadingFeature === `add:${featureId}`}
                      loadingText="Scheduling…"
                      onClick={() => handleSchedule(featureId, 'add')}
                    >
                      Add feature
                    </LoadingButton>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

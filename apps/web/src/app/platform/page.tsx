'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { LoadingButton } from '@/components/ui/loading-button';
import { signOut, useSession } from '@/lib/auth-client';
import { isSuperAdminRole } from '@/lib/org-roles';
import {
  createPlatformAdminInvitation,
  getPlatformAdminInvitations,
  getPlatformOrganizations,
  getPlatformOverview,
  type PlatformAdminInvitation,
  type PlatformOrganization,
  type PlatformOverview,
} from '@/lib/platform';

const planTiers = [
  { value: 'small', label: 'Small (≤20 employees)' },
  { value: 'medium', label: 'Medium (21–100 employees)' },
  { value: 'enterprise', label: 'Enterprise (100+ employees)' },
] as const;

export default function PlatformPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [invitations, setInvitations] = useState<PlatformAdminInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [planTier, setPlanTier] =
    useState<(typeof planTiers)[number]['value']>('small');
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace('/sign-in');
      return;
    }

    if (!isSuperAdminRole(session.user.platformRole)) {
      router.replace('/dashboard');
      return;
    }

    void Promise.all([
      getPlatformOverview(),
      getPlatformOrganizations(),
      getPlatformAdminInvitations(),
    ])
      .then(([nextOverview, nextOrganizations, nextInvitations]) => {
        setOverview(nextOverview);
        setOrganizations(nextOrganizations);
        setInvitations(nextInvitations);
      })
      .catch(() => router.replace('/sign-in'));
  }, [isPending, router, session]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setInviteUrl(null);
    setLoading(true);

    try {
      const invitedEmail = email;
      const result = await createPlatformAdminInvitation({
        email,
        planTier,
        paymentReference: paymentReference.trim() || undefined,
      });
      const nextInvitations = await getPlatformAdminInvitations();
      const nextOverview = await getPlatformOverview();
      setInvitations(nextInvitations);
      setOverview(nextOverview);
      setEmail('');
      setPaymentReference('');
      setInviteUrl(result.signupUrl);
      setSuccess(`Admin invitation created for ${invitedEmail}.`);
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : 'Unable to create invitation.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  if (isPending || !overview || !session) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-amber-400">
              Tracko Platform
            </p>
            <h1 className="text-lg font-semibold">Super admin console</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:inline">
              {session.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        {error ? (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {success ? (
          <div className="space-y-3 rounded-lg bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">
            <p>{success}</p>
            {inviteUrl ? (
              <div className="space-y-2">
                <p className="text-slate-400">
                  Share this org admin signup link:
                </p>
                <code className="block overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 text-xs text-emerald-200">
                  {inviteUrl}
                </code>
              </div>
            ) : null}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Organizations', value: overview.organizationCount },
            { label: 'Members', value: overview.memberCount },
            { label: 'Branches', value: overview.branchCount },
            { label: 'Pending admin invites', value: overview.pendingAdminInvites },
          ].map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-white">
            Invite organization admin
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Create a subscription-backed admin invitation. The org admin uses the
            signup link to create their account and set up their company.
          </p>

          <form
            className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={handleInvite}
          >
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
                placeholder="owner@company.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Plan tier</span>
              <select
                required
                value={planTier}
                onChange={(event) =>
                  setPlanTier(
                    event.target.value as (typeof planTiers)[number]['value'],
                  )
                }
                disabled={loading}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
              >
                {planTiers.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Payment reference</span>
              <input
                type="text"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
                placeholder="Optional"
              />
            </label>

            <div className="flex items-end">
              <LoadingButton
                type="submit"
                loading={loading}
                loadingText="Creating…"
                className="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-amber-400 md:w-auto"
              >
                Create invitation
              </LoadingButton>
            </div>
          </form>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Organizations
            </h2>
            <div className="space-y-3">
              {organizations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                  No organizations yet.
                </p>
              ) : (
                organizations.map((organization) => (
                  <article
                    key={organization.id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{organization.name}</p>
                        <p className="text-sm text-slate-400">{organization.slug}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          organization.onboardingCompleted
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {organization.onboardingCompleted ? 'Active' : 'Onboarding'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {organization.memberCount} members · {organization.branchCount}{' '}
                      branches
                      {organization.city ? ` · ${organization.city}` : ''}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Admin invitations
            </h2>
            <div className="space-y-3">
              {invitations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                  No admin invitations yet.
                </p>
              ) : (
                invitations.map((invitation) => (
                  <article
                    key={invitation.token}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{invitation.email}</p>
                        <p className="mt-1 text-sm capitalize text-slate-400">
                          {invitation.planTier} · {invitation.status}
                        </p>
                      </div>
                    </div>
                    {invitation.signupUrl ? (
                      <code className="mt-3 block overflow-x-auto rounded-lg bg-slate-950 px-2 py-2 text-xs text-slate-500">
                        {invitation.signupUrl}
                      </code>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <p className="text-center text-sm text-slate-500">
          Need another platform operator? Use{' '}
          <Link href="/platform/setup" className="text-amber-400 hover:underline">
            /platform/setup
          </Link>{' '}
          with the bootstrap secret.
        </p>
      </main>
    </div>
  );
}

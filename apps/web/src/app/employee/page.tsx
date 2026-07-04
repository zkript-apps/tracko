'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { signOut, useSession } from '@/lib/auth-client';
import { getOnboardingStatus } from '@/lib/onboarding';
import { formatOrgRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

export default function EmployeePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace('/sign-in');
      return;
    }

    void getOnboardingStatus().then((status) => {
      if (status.needsOnboarding) {
        router.replace('/onboarding');
        return;
      }

      void getTeamOverview()
        .then((overview) => {
          const role = overview.currentMember?.role ?? 'member';

          if (role !== 'employee') {
            router.replace('/dashboard');
            return;
          }

          setTeam(overview);
        })
        .catch(() => router.replace('/sign-in'));
    });
  }, [isPending, router, session]);

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  if (isPending || !team || !session) {
    return <DashboardSkeleton />;
  }

  const currentMember = team.members.find(
    (member) => member.userId === session.user.id,
  );
  const branchLabel = currentMember?.branch?.name;

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">
              WorkTrack
            </p>
            <h1 className="text-lg font-semibold">Employee portal</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
            {formatOrgRole('employee')}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Welcome, {session.user.name}
          </h2>
          <p className="mt-2 text-slate-300">
            You&apos;re part of {team.organization.name}
            {branchLabel ? ` · ${branchLabel}` : ''}.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-white">Use the mobile app</h2>
          <p className="mt-2 text-sm text-slate-400">
            Time in/out, leave requests, and shift reminders are available on the
            WorkTrack mobile app. Your account is ready — download the app when it
            launches to start clocking in.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>Clock in and out with location context</li>
            <li>Submit and track leave requests</li>
            <li>View your daily time records</li>
          </ul>
        </section>

        <p className="text-center text-sm text-slate-500">
          Need help? Contact your HR manager or{' '}
          <Link href="/sign-in" className="text-emerald-400 hover:underline">
            sign in
          </Link>{' '}
          on another device.
        </p>
      </main>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { signOut, useSession } from '@/lib/auth-client';
import { getOnboardingStatus, type OnboardingStatus } from '@/lib/onboarding';
import {
  formatOrgRole,
  isEmployeeRole,
  isHrRole,
  isOrgAdminRole,
} from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

const modules = [
  {
    title: 'Daily Time Records',
    description: 'Auto-generated DTR summaries ready for HR review.',
    href: null,
  },
  {
    title: 'Live Location',
    description: 'Monitor field teams and geofence alerts in real time.',
    href: null,
  },
  {
    title: 'Payroll',
    description: 'Compute payroll from attendance with overtime and deductions.',
    href: null,
  },
  {
    title: 'Employee Records',
    description: 'Profiles, documents, and linked attendance history.',
    href: null,
  },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);

  useEffect(() => {
    if (isPending || !session) {
      return;
    }

    void getOnboardingStatus().then((status) => {
      if (status.needsOnboarding) {
        router.replace('/onboarding');
        return;
      }

      setOnboarding(status);
      setTeamLoading(true);
      void getTeamOverview()
        .then((overview) => {
          const role =
            overview.currentMember?.role ??
            overview.members.find((member) => member.userId === session.user.id)
              ?.role ??
            'member';

          if (isEmployeeRole(role)) {
            router.replace('/employee');
            return;
          }

          setTeam(overview);
        })
        .catch(() => setTeam(null))
        .finally(() => setTeamLoading(false));
    });
  }, [isPending, router, session]);

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  if (isPending || (session && (!onboarding || teamLoading))) {
    return <DashboardSkeleton />;
  }

  if (!session) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-slate-950 text-center">
        <p className="text-slate-300">You need to sign in to access the admin panel.</p>
        <Link
          href="/sign-in"
          className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  const currentRole =
    team?.currentMember?.role ??
    team?.members.find((member) => member.userId === session.user.id)?.role ??
    'member';
  const isAdmin = team?.currentMember?.canManageTeam ?? isOrgAdminRole(currentRole);
  const canManageWorkforce =
    isAdmin || isHrRole(currentRole) || team?.currentMember?.canInviteEmployees;
  const canInviteEmployees = team?.currentMember?.canInviteEmployees ?? false;
  const currentMember = team?.members.find(
    (member) => member.userId === session.user.id,
  );
  const branchLabel = currentMember?.branch?.name;

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">
              WorkTrack Admin
            </p>
            <h1 className="text-lg font-semibold">
              Welcome, {session.user.name}
              {onboarding?.organization ? (
                <span className="block text-sm font-normal text-slate-400">
                  {onboarding.organization.name}
                  {branchLabel ? ` · ${branchLabel}` : ''}
                </span>
              ) : null}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {canManageWorkforce ? (
              <>
                <Link
                  href="/dashboard/attendance"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  Attendance
                </Link>
                <Link
                  href="/dashboard/leave"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  Leave
                </Link>
              </>
            ) : null}
            {canInviteEmployees ? (
              <Link
                href="/dashboard/employees"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Employees
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                href="/dashboard/team"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Team & HR
              </Link>
            ) : null}
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
            {formatOrgRole(currentRole)}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {isAdmin ? 'Organization ready' : 'Branch workspace ready'}
          </h2>
          <p className="mt-2 max-w-3xl text-slate-300">
            {isAdmin ? (
              <>
                {onboarding?.organization?.name ?? 'Your organization'} is set up with{' '}
                {onboarding?.branches.length ?? 0} branch
                {(onboarding?.branches.length ?? 0) === 1 ? '' : 'es'}. Invite HR
                managers from the Team page, then monitor attendance and leave
                from the dashboard.
              </>
            ) : (
              <>
                You can oversee {branchLabel ?? 'your assigned branch'} — review
                attendance, approve leave, and manage employee records. Invite
                employees from the Employees page.
              </>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {canManageWorkforce ? (
              <>
                <Link
                  href="/dashboard/attendance"
                  className="inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
                >
                  View attendance
                </Link>
                <Link
                  href="/dashboard/leave"
                  className="inline-block rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-200"
                >
                  Review leave
                </Link>
              </>
            ) : null}
            {isAdmin ? (
              <Link
                href="/dashboard/team"
                className="inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Invite HR managers
              </Link>
            ) : canInviteEmployees ? (
              <Link
                href="/dashboard/employees"
                className="inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
              >
                Invite employees
              </Link>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
            Coming soon
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <article
                key={module.title}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <h3 className="font-medium text-white">{module.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{module.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

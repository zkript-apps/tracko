'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { signOut, useSession } from '@/lib/auth-client';
import {
  formatAttendanceTime,
  getBranchAttendanceOverview,
  type BranchAttendanceOverview,
} from '@/lib/attendance';
import { getOnboardingStatus } from '@/lib/onboarding';
import { isHrRole, isOrgAdminRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

export default function AttendancePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [overview, setOverview] = useState<BranchAttendanceOverview | null>(null);
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState<string | null>(null);

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
        .then((nextTeam) => {
          const role = nextTeam.currentMember?.role ?? 'member';
          const canView =
            isOrgAdminRole(role) ||
            isHrRole(role);

          if (!canView) {
            router.replace('/dashboard');
            return;
          }

          setTeam(nextTeam);
          const defaultBranch =
            nextTeam.currentMember?.assignedBranchId ??
            nextTeam.branches[0]?._id ??
            '';
          setBranchId(defaultBranch);

          return getBranchAttendanceOverview(
            isOrgAdminRole(role) ? defaultBranch || undefined : undefined,
          );
        })
        .then((nextOverview) => {
          if (nextOverview) {
            setOverview(nextOverview);
          }
        })
        .catch(() => router.replace('/dashboard'));
    });
  }, [isPending, router, session]);

  useEffect(() => {
    if (!team || !isOrgAdminRole(team.currentMember?.role)) {
      return;
    }

    void getBranchAttendanceOverview(branchId || undefined)
      .then(setOverview)
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load attendance.',
        );
      });
  }, [branchId, team]);

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  if (isPending || !team || !overview) {
    return <DashboardSkeleton />;
  }

  const isAdmin = isOrgAdminRole(team.currentMember?.role);

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">
              {team.organization.name}
            </p>
            <h1 className="text-lg font-semibold">Attendance today</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/leave"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Leave requests
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Dashboard
            </Link>
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

        {isAdmin ? (
          <label className="block max-w-sm space-y-2">
            <span className="text-sm text-slate-300">Branch</span>
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
            >
              <option value="">All branches</option>
              {team.branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Employees</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {overview.employees.length}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Clocked in</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-400">
              {overview.employees.filter((employee) => employee.isClockedIn).length}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Clocked out</p>
            <p className="mt-2 text-3xl font-semibold text-slate-300">
              {overview.employees.filter((employee) => !employee.isClockedIn).length}
            </p>
          </article>
        </section>

        <section className="space-y-3">
          {overview.employees.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
              No employees found for this branch.
            </p>
          ) : (
            overview.employees.map((employee) => (
              <article
                key={employee.userId}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <div>
                  <p className="font-medium text-white">{employee.name}</p>
                  <p className="text-sm text-slate-400">{employee.email}</p>
                  {employee.lastEvent ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Last {employee.lastEvent.type.replace('_', ' ')} ·{' '}
                      {formatAttendanceTime(employee.lastEvent.recordedAt)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">No activity today</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    employee.isClockedIn
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {employee.isClockedIn ? 'On duty' : 'Off duty'}
                </span>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

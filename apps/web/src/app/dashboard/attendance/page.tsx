'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
import {
  formatAttendanceTime,
  getBranchAttendanceOverview,
  type BranchAttendanceOverview,
} from '@/lib/attendance';
import { isHrRole, isOrgAdminRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

export default function AttendancePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [overview, setOverview] = useState<BranchAttendanceOverview | null>(null);
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    void getTeamOverview()
      .then((nextTeam) => {
        const role = nextTeam.currentMember?.role ?? 'member';
        const canView = isOrgAdminRole(role) || isHrRole(role);

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
  }, [router, session]);

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

  if (!team || !overview) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const isAdmin = isOrgAdminRole(team.currentMember?.role);

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Attendance today
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who is on duty across your branch.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <label className="block max-w-sm space-y-2">
          <span className="text-sm text-muted-foreground">Branch</span>
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
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
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Employees</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {overview.employees.length}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Clocked in</p>
          <p className="mt-2 text-3xl font-semibold text-primary">
            {overview.employees.filter((employee) => employee.isClockedIn).length}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Clocked out</p>
          <p className="mt-2 text-3xl font-semibold text-muted-foreground">
            {
              overview.employees.filter((employee) => !employee.isClockedIn)
                .length
            }
          </p>
        </article>
      </section>

      <section className="space-y-3">
        {overview.employees.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No employees found for this branch.
          </p>
        ) : (
          overview.employees.map((employee) => (
            <article
              key={employee.userId}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium text-foreground">{employee.name}</p>
                {employee.email ? (
                  <p className="text-sm text-muted-foreground">{employee.email}</p>
                ) : null}
                {employee.lastEvent ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Last {employee.lastEvent.type.replace('_', ' ')} ·{' '}
                    {formatAttendanceTime(employee.lastEvent.recordedAt)}
                    {employee.lastEvent.biometricVerified ? ' · Biometric verified' : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No activity today
                  </p>
                )}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  employee.isClockedIn
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {employee.isClockedIn ? 'On duty' : 'Off duty'}
              </span>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

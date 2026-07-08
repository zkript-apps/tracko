'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { getOnboardingStatus, type OnboardingStatus } from '@/lib/onboarding';
import {
  formatOrgRole,
  isHrRole,
  isOrgAdminRole,
} from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

const modules = [
  {
    title: 'Live Location',
    description: 'Monitor field teams and geofence alerts in real time.',
  },
] as const;

export default function DashboardPage() {
  const { data: session } = useSession();
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [team, setTeam] = useState<TeamOverview | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    void getOnboardingStatus().then((status) => {
      setOnboarding(status);
      void getTeamOverview()
        .then(setTeam)
        .catch(() => setTeam(null));
    });
  }, [session]);

  if (!session || !team || !onboarding) {
    return null;
  }

  const currentRole = team.currentMember?.role ?? 'member';
  const isAdmin = team.currentMember?.canManageTeam ?? isOrgAdminRole(currentRole);
  const canManageWorkforce =
    isAdmin || isHrRole(currentRole) || team.currentMember?.canInviteEmployees;
  const canInviteEmployees = team.currentMember?.canInviteEmployees ?? false;
  const currentMember = team.members.find(
    (member) => member.userId === session.user.id,
  );
  const branchLabel = currentMember?.branch?.name;

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome, {session.user.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {onboarding.organization?.name}
          {branchLabel ? ` · ${branchLabel}` : ''}
        </p>
      </div>

      <section className="mb-10 rounded-2xl border border-primary/20 bg-primary/10 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
          {formatOrgRole(currentRole)}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          {isAdmin ? 'Organization ready' : 'Branch workspace ready'}
        </h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {isAdmin ? (
            <>
              {onboarding.organization?.name ?? 'Your organization'} is set up with{' '}
              {onboarding.branches.length} branch
              {onboarding.branches.length === 1 ? '' : 'es'}. Invite HR managers
              from Team & HR, then monitor attendance and leave from the sidebar.
            </>
          ) : (
            <>
              You can oversee {branchLabel ?? 'your assigned branch'} — review
              attendance, approve leave, and manage employee records.
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {canManageWorkforce ? (
            <>
              <Link
                href="/dashboard/attendance"
                className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                View attendance
              </Link>
              <Link
                href="/dashboard/dtr"
                className="inline-flex rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10"
              >
                Review DTR
              </Link>
              <Link
                href="/dashboard/leave"
                className="inline-flex rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10"
              >
                Review leave
              </Link>
              <Link
                href="/dashboard/payroll"
                className="inline-flex rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10"
              >
                Run payroll
              </Link>
              <Link
                href="/dashboard/records"
                className="inline-flex rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10"
              >
                Employee records
              </Link>
            </>
          ) : null}
          {isAdmin ? (
            <Link
              href="/dashboard/team"
              className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-muted-foreground hover:text-foreground"
            >
              Invite HR managers
            </Link>
          ) : canInviteEmployees ? (
            <Link
              href="/dashboard/employees"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Invite employees
            </Link>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Coming soon
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <article
              key={module.title}
              className="rounded-xl border border-border bg-card p-5"
            >
              <h3 className="font-medium text-foreground">{module.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {module.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

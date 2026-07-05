'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { LoadingButton } from '@/components/ui/loading-button';
import { signOut, useSession } from '@/lib/auth-client';
import { getOnboardingStatus } from '@/lib/onboarding';
import { buildAcceptInviteUrl } from '@/lib/invite-url';
import { formatOrgRole, isOrgAdminRole } from '@/lib/org-roles';
import {
  formatEmploymentPeriod,
  formatEmploymentType,
  listEmployeeRecords,
  type EmployeeRecord,
} from '@/lib/employees';
import {
  cancelOrgInvitation,
  getTeamOverview,
  inviteEmployeeMember,
  type TeamOverview,
} from '@/lib/team';

export default function EmployeesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [email, setEmail] = useState('');
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [employeeRecords, setEmployeeRecords] = useState<EmployeeRecord[]>([]);

  const isAdmin = isOrgAdminRole(team?.currentMember?.role);
  const assignedBranchId = team?.currentMember?.assignedBranchId ?? null;

  const employees = employeeRecords;

  const pendingInvites = useMemo(
    () =>
      team?.invitations.filter((invitation) => invitation.role === 'employee') ??
      [],
    [team],
  );

  const inviteBranch = useMemo(() => {
    if (!team) {
      return null;
    }

    const targetBranchId = isAdmin ? branchId : assignedBranchId;
    return team.branches.find((branch) => branch._id === targetBranchId) ?? null;
  }, [assignedBranchId, branchId, isAdmin, team]);

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
          if (!overview.currentMember?.canInviteEmployees) {
            router.replace('/dashboard');
            return;
          }

          setTeam(overview);

          if (overview.currentMember.assignedBranchId) {
            setBranchId(overview.currentMember.assignedBranchId);
          } else if (overview.branches[0]) {
            setBranchId(overview.branches[0]._id);
          }

          return listEmployeeRecords();
        })
        .then((records) => {
          if (records) {
            setEmployeeRecords(records.employees);
          }
        })
        .catch(() => router.replace('/dashboard'));
    });
  }, [isPending, router, session]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setInviteUrl(null);
    setLoading(true);

    try {
      const invitedEmail = email;
      const result = await inviteEmployeeMember({
        email,
        branchId: isAdmin ? branchId : undefined,
      });
      const overview = await getTeamOverview();
      setTeam(overview);
      const records = await listEmployeeRecords();
      setEmployeeRecords(records.employees);
      setEmail('');
      setInviteUrl(result.inviteUrl);
      setSuccess(`Invitation sent to ${invitedEmail}.`);
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : 'Unable to send invitation.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    setError(null);
    setSuccess(null);
    setCancellingId(invitationId);

    try {
      await cancelOrgInvitation(invitationId);
      const overview = await getTeamOverview();
      setTeam(overview);
      const records = await listEmployeeRecords();
      setEmployeeRecords(records.employees);
      setSuccess('Invitation cancelled.');
      setInviteUrl(null);
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'Unable to cancel invitation.',
      );
    } finally {
      setCancellingId(null);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  if (isPending || !team) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">
              {team.organization.name}
            </p>
            <h1 className="text-lg font-semibold">Employees</h1>
          </div>
          <div className="flex items-center gap-3">
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

        {success ? (
          <div className="space-y-3 rounded-lg bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">
            <p>{success}</p>
            {inviteUrl ? (
              <div className="space-y-2">
                <p className="text-slate-400">
                  Share this link with the employee (valid until they accept):
                </p>
                <code className="block overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 text-xs text-emerald-200">
                  {inviteUrl}
                </code>
              </div>
            ) : null}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-white">Invite employee</h2>
          <p className="mt-2 text-sm text-slate-400">
            {isAdmin
              ? 'Send an invitation for an employee to join a branch. They will create an account via the invite link.'
              : `Invite employees to ${inviteBranch?.name ?? 'your assigned branch'}. They will use the mobile app after signing up.`}
          </p>

          <form
            className={`mt-6 grid gap-4 ${isAdmin ? 'md:grid-cols-[1fr_1fr_auto]' : 'md:grid-cols-[1fr_auto]'}`}
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
                placeholder="employee@company.com"
              />
            </label>

            {isAdmin ? (
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Branch</span>
                <select
                  required
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
                >
                  {team.branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                      {branch.city ? ` — ${branch.city}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="flex items-end">
              <LoadingButton
                type="submit"
                loading={loading}
                loadingText="Sending…"
                className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400 md:w-auto"
              >
                Send invitation
              </LoadingButton>
            </div>
          </form>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Active employees
            </h2>
            <div className="space-y-3">
              {employees.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                  No employees yet. Send an invitation to get started.
                </p>
              ) : (
                employees.map((employee) => (
                  <Link
                    key={employee.userId}
                    href={`/dashboard/employees/${employee.userId}`}
                    className="block rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700 hover:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{employee.name}</p>
                        <p className="text-sm text-slate-400">{employee.email}</p>
                        <p className="mt-2 text-sm text-slate-500">
                          {formatEmploymentType(employee.profile.employmentType)}
                          {employee.profile.jobTitle
                            ? ` · ${employee.profile.jobTitle}`
                            : ''}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatEmploymentPeriod(employee.profile)}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-emerald-300">
                        View record
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Pending invitations
            </h2>
            <div className="space-y-3">
              {pendingInvites.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                  No pending employee invitations.
                </p>
              ) : (
                pendingInvites.map((invitation) => (
                  <article
                    key={invitation.id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{invitation.email}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {formatOrgRole(invitation.role)}
                          {invitation.branch ? ` · ${invitation.branch.name}` : ''}
                        </p>
                      </div>
                      <LoadingButton
                        type="button"
                        loading={cancellingId === invitation.id}
                        loadingText="Cancelling…"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        disabled={
                          cancellingId !== null && cancellingId !== invitation.id
                        }
                        className="shrink-0 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 transition hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
                      >
                        Cancel
                      </LoadingButton>
                    </div>
                    <code className="mt-3 block overflow-x-auto rounded-lg bg-slate-950 px-2 py-2 text-xs text-slate-500">
                      {buildAcceptInviteUrl(invitation.id)}
                    </code>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

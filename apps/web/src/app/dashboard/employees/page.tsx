'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
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
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [email, setEmail] = useState('');
  const [branchId, setBranchId] = useState('');
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
    if (!session) {
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
  }, [router, session]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      toast.success(`Invitation sent to ${invitedEmail}.`);
    } catch (inviteError) {
      toast.error(
        inviteError instanceof Error
          ? inviteError.message
          : 'Unable to send invitation.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    setCancellingId(invitationId);

    try {
      await cancelOrgInvitation(invitationId);
      const overview = await getTeamOverview();
      setTeam(overview);
      const records = await listEmployeeRecords();
      setEmployeeRecords(records.employees);
      setInviteUrl(null);
      toast.success('Invitation cancelled.');
    } catch (cancelError) {
      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : 'Unable to cancel invitation.',
      );
    } finally {
      setCancellingId(null);
    }
  }

  if (!team) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite staff and manage employment records.
        </p>
      </div>

      {inviteUrl ? (
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-3 text-sm text-primary">
          <p>Share this invite link (valid until they accept):</p>
          <code className="block overflow-x-auto rounded-lg bg-background px-3 py-2 text-xs">
            {inviteUrl}
          </code>
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
    </div>
  );
}

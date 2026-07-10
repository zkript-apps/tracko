'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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

function getHeadOfficeBranchId(team: TeamOverview): string {
  return (
    team.branches.find((branch) => branch.isHeadOffice)?._id ??
    team.branches[0]?._id ??
    ''
  );
}

function formatBranchName(branch: TeamOverview['branches'][number]): string {
  return `${branch.name}${branch.isHeadOffice ? ' (Head office)' : ''}${
    branch.city ? ` — ${branch.city}` : ''
  }`;
}

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
  const [memberBranchFilter, setMemberBranchFilter] = useState('');
  const [employeesSheetOpen, setEmployeesSheetOpen] = useState(false);

  const isAdmin = isOrgAdminRole(team?.currentMember?.role);
  const assignedBranchId = team?.currentMember?.assignedBranchId ?? null;

  const employees = employeeRecords;

  const pendingInvites = useMemo(
    () =>
      team?.invitations.filter((invitation) => invitation.role === 'employee') ??
      [],
    [team],
  );

  const canInvite = team?.scaleCapacity?.canInvite !== false;
  const scaleCapacity = team?.scaleCapacity;

  const branchEmployees = useMemo(() => {
    if (!memberBranchFilter) {
      return [];
    }

    return employees.filter(
      (employee) => employee.branchId === memberBranchFilter,
    );
  }, [employees, memberBranchFilter]);

  const filteredPendingInvites = useMemo(() => {
    if (!memberBranchFilter) {
      return pendingInvites;
    }

    return pendingInvites.filter(
      (invitation) => invitation.branch?.id === memberBranchFilter,
    );
  }, [memberBranchFilter, pendingInvites]);

  const selectedBranch = useMemo(
    () =>
      team?.branches.find((branch) => branch._id === memberBranchFilter) ?? null,
    [memberBranchFilter, team],
  );

  function handleBranchFilterChange(nextBranchId: string) {
    setMemberBranchFilter(nextBranchId);
    setEmployeesSheetOpen(false);
  }

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

        const defaultBranchId = isOrgAdminRole(overview.currentMember?.role)
          ? getHeadOfficeBranchId(overview)
          : overview.currentMember?.assignedBranchId ??
            getHeadOfficeBranchId(overview);

        if (defaultBranchId) {
          setBranchId(defaultBranchId);
          setMemberBranchFilter(defaultBranchId);
        } else if (overview.branches[0]) {
          setBranchId(overview.branches[0]._id);
          setMemberBranchFilter(overview.branches[0]._id);
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

          {scaleCapacity && scaleCapacity.maxEmployees != null ? (
            <p className="mt-3 text-sm text-slate-400">
              {scaleCapacity.employeeCount + scaleCapacity.pendingInvites} of{' '}
              {scaleCapacity.maxEmployees} {scaleCapacity.scaleTierLabel} scale
              seats used
              {scaleCapacity.pendingInvites > 0
                ? ` (${scaleCapacity.pendingInvites} pending invite${
                    scaleCapacity.pendingInvites === 1 ? '' : 's'
                  })`
                : ''}
              .
              {!canInvite ? (
                <>
                  {' '}
                  <Link
                    href="/dashboard/settings/subscription"
                    className="text-emerald-400 underline-offset-2 hover:underline"
                  >
                    Upgrade scale
                  </Link>{' '}
                  to invite more.
                </>
              ) : null}
            </p>
          ) : null}

          {!canInvite ? (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              This organization is at its {scaleCapacity?.scaleTierLabel ?? ''}{' '}
              scale limit. New employees cannot be invited until you upgrade
              scale.
            </p>
          ) : null}

          <form
            className={`mt-6 grid gap-4 md:items-end ${isAdmin ? 'md:grid-cols-[1fr_1fr_auto]' : 'md:grid-cols-[1fr_auto]'}`}
            onSubmit={handleInvite}
          >
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading || !canInvite}
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
                  disabled={loading || !canInvite}
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

            <LoadingButton
              type="submit"
              loading={loading}
              loadingText="Sending…"
              disabled={!canInvite}
              className="h-[42px] w-full rounded-lg bg-emerald-500 px-4 font-medium text-slate-950 transition hover:bg-emerald-400 md:w-auto"
            >
              Send invitation
            </LoadingButton>
          </form>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
                Active employees
              </h2>
              {isAdmin ? (
                <label className="block min-w-[16rem] flex-1 space-y-2 sm:max-w-md">
                  <span className="text-xs text-slate-500">Branch</span>
                  <select
                    value={memberBranchFilter}
                    onChange={(event) =>
                      handleBranchFilterChange(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-emerald-500 focus:ring-2"
                  >
                    {team.branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {formatBranchName(branch)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="space-y-3">
              <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm text-slate-400">Employees</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {branchEmployees.length}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {branchEmployees.length === 1
                    ? 'employee in this branch'
                    : 'employees in this branch'}
                </p>
              </article>

              {branchEmployees.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setEmployeesSheetOpen(true)}
                >
                  View all employees
                </Button>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                  No employees in this branch yet. Send an invitation to get
                  started.
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Pending invitations
            </h2>
            <div className="space-y-3">
              {filteredPendingInvites.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                  No pending employee invitations
                  {isAdmin ? ' for this branch' : ''}.
                </p>
              ) : (
                filteredPendingInvites.map((invitation) => (
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
                        variant="destructive"
                        size="xs"
                        loading={cancellingId === invitation.id}
                        loadingText="Cancelling…"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        disabled={
                          cancellingId !== null && cancellingId !== invitation.id
                        }
                        className="shrink-0"
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

      <Sheet open={employeesSheetOpen} onOpenChange={setEmployeesSheetOpen}>
        <SheetContent
          className="gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-none"
          style={{ width: 'min(960px, 92vw)', maxWidth: '92vw' }}
        >
          <SheetHeader className="border-b border-border px-6 pb-4 pt-4">
            <SheetTitle>
              {selectedBranch ? selectedBranch.name : 'Branch employees'}
            </SheetTitle>
            <SheetDescription>
              {branchEmployees.length} employee
              {branchEmployees.length === 1 ? '' : 's'} in this branch
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 px-6 pt-6 pb-6">
            {branchEmployees.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No employees assigned to this branch.
              </p>
            ) : (
              branchEmployees.map((employee) => (
                <Link
                  key={employee.userId}
                  href={`/dashboard/employees/${employee.userId}`}
                  className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"
                  onClick={() => setEmployeesSheetOpen(false)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {employee.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {employee.email}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {formatEmploymentType(employee.profile.employmentType)}
                        {employee.profile.jobTitle
                          ? ` · ${employee.profile.jobTitle}`
                          : ''}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatEmploymentPeriod(employee.profile)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary">
                      View record
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

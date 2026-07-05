'use client';

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
import {
  formatOrgRole,
  isEmployeeRole,
  isHrRole,
  isOrgAdminRole,
} from '@/lib/org-roles';
import { getTeamOverview, inviteHrMember, cancelOrgInvitation, type TeamOverview } from '@/lib/team';
import { buildAcceptInviteUrl } from '@/lib/invite-url';

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

export default function TeamPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [email, setEmail] = useState('');
  const [branchId, setBranchId] = useState('');
  const [memberBranchFilter, setMemberBranchFilter] = useState('');
  const [membersSheetOpen, setMembersSheetOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    void getTeamOverview()
      .then((overview) => {
        if (!overview.currentMember?.canManageTeam) {
          router.replace('/dashboard');
          return;
        }

        setTeam(overview);
        const defaultBranchId = getHeadOfficeBranchId(overview);
        if (defaultBranchId) {
          setBranchId(defaultBranchId);
          setMemberBranchFilter(defaultBranchId);
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
      const result = await inviteHrMember({ email, branchId });
      const overview = await getTeamOverview();
      setTeam(overview);
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

  const orgAdmins = useMemo(() => {
    if (!team) {
      return [];
    }

    return team.members.filter((member) => isOrgAdminRole(member.role));
  }, [team]);

  const branchMembers = useMemo(() => {
    if (!team || !memberBranchFilter) {
      return [];
    }

    return team.members.filter(
      (member) =>
        !isOrgAdminRole(member.role) &&
        member.branch?.id === memberBranchFilter,
    );
  }, [memberBranchFilter, team]);

  const branchHrMembers = useMemo(
    () => branchMembers.filter((member) => isHrRole(member.role)),
    [branchMembers],
  );

  const branchEmployeeMembers = useMemo(
    () => branchMembers.filter((member) => isEmployeeRole(member.role)),
    [branchMembers],
  );

  const filteredInvitations = useMemo(() => {
    if (!team || !memberBranchFilter) {
      return [];
    }

    return team.invitations.filter(
      (invitation) => invitation.branch?.id === memberBranchFilter,
    );
  }, [memberBranchFilter, team]);

  const selectedBranch = useMemo(
    () => team?.branches.find((branch) => branch._id === memberBranchFilter) ?? null,
    [memberBranchFilter, team],
  );

  function handleBranchFilterChange(nextBranchId: string) {
    setMemberBranchFilter(nextBranchId);
    setMembersSheetOpen(false);
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
        <h1 className="text-2xl font-semibold text-foreground">Team & HR</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite HR managers and review your organization roster.
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
          <h2 className="text-lg font-semibold text-white">Invite HR manager</h2>
          <p className="mt-2 text-sm text-slate-400">
            HR users oversee a specific branch — attendance, leave approvals, and
            employee records for that site.
          </p>

          <form className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleInvite}>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
                placeholder="hr@company.com"
              />
            </label>

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
                    {branch.isHeadOffice ? ' (Head office)' : ''}
                    {branch.city ? ` — ${branch.city}` : ''}
                  </option>
                ))}
              </select>
            </label>

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
          <div className="space-y-6">
            {orgAdmins.length > 0 ? (
              <div>
                <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
                  Organization admins
                </h2>
                <div className="space-y-3">
                  {orgAdmins.map((member) => (
                    <article
                      key={member.id}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">
                            {member.user.name}
                          </p>
                          <p className="text-sm text-slate-400">
                            {member.user.email}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-emerald-300">
                          {formatOrgRole(member.role)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
                  Team members
                </h2>
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
              </div>

              <div className="space-y-3">
                {branchHrMembers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                    No HR assigned to this branch.
                  </p>
                ) : (
                  branchHrMembers.map((member) => (
                    <article
                      key={member.id}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">
                            {member.user.name}
                          </p>
                          <p className="text-sm text-slate-400">
                            {member.user.email}
                          </p>
                        </div>
                        <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-300">
                          {formatOrgRole(member.role)}
                        </span>
                      </div>
                    </article>
                  ))
                )}

                <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Employees</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {branchEmployeeMembers.length}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {branchEmployeeMembers.length === 1
                      ? 'employee in this branch'
                      : 'employees in this branch'}
                  </p>
                </article>

                {branchMembers.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setMembersSheetOpen(true)}
                  >
                    View all members
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Pending invitations
            </h2>
            <div className="space-y-3">
              {filteredInvitations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                  No pending invitations for this branch.
                </p>
              ) : (
                filteredInvitations.map((invitation) => (
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
                        disabled={cancellingId !== null && cancellingId !== invitation.id}
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

      <Sheet open={membersSheetOpen} onOpenChange={setMembersSheetOpen}>
        <SheetContent
          className="gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-none"
          style={{ width: 'min(960px, 92vw)', maxWidth: '92vw' }}
        >
          <SheetHeader className="border-b border-border px-6 pb-4 pt-4">
            <SheetTitle>
              {selectedBranch ? selectedBranch.name : 'Branch members'}
            </SheetTitle>
            <SheetDescription>
              {branchMembers.length} member
              {branchMembers.length === 1 ? '' : 's'} ·{' '}
              {branchHrMembers.length} HR · {branchEmployeeMembers.length}{' '}
              employee{branchEmployeeMembers.length === 1 ? '' : 's'}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 px-6 pt-6 pb-6">
            {branchMembers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No members assigned to this branch.
              </p>
            ) : (
              branchMembers.map((member) => (
                <article
                  key={member.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {member.user.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.user.email}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                        isHrRole(member.role)
                          ? 'bg-sky-500/15 text-sky-400'
                          : 'bg-primary/15 text-primary'
                      }`}
                    >
                      {formatOrgRole(member.role)}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

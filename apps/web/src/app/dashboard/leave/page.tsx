'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { LoadingButton } from '@/components/ui/loading-button';
import { signOut, useSession } from '@/lib/auth-client';
import { getOnboardingStatus } from '@/lib/onboarding';
import { isHrRole, isOrgAdminRole } from '@/lib/org-roles';
import {
  approveLeaveRequest,
  formatLeaveStatus,
  formatLeaveType,
  getLeaveStatusClassName,
  getManagedLeaveRequests,
  rejectLeaveRequest,
  type LeaveRequest,
} from '@/lib/leave';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

export default function LeavePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function loadRequests(nextFilter: 'pending' | 'all') {
    const data = await getManagedLeaveRequests(
      nextFilter === 'pending' ? 'pending' : undefined,
    );
    setRequests(data);
  }

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

          if (!isOrgAdminRole(role) && !isHrRole(role)) {
            router.replace('/dashboard');
            return;
          }

          setTeam(nextTeam);
          return loadRequests('pending');
        })
        .catch(() => router.replace('/dashboard'));
    });
  }, [isPending, router, session]);

  useEffect(() => {
    if (!team) {
      return;
    }

    void loadRequests(filter).catch((loadError) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load leave requests.',
      );
    });
  }, [filter, team]);

  async function handleReview(id: string, action: 'approve' | 'reject') {
    setError(null);
    setSuccess(null);
    setActingId(id);

    try {
      if (action === 'approve') {
        await approveLeaveRequest(id);
        setSuccess('Leave request approved.');
      } else {
        await rejectLeaveRequest(id);
        setSuccess('Leave request rejected.');
      }

      await loadRequests(filter);
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : 'Unable to review leave request.',
      );
    } finally {
      setActingId(null);
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
    <div className="min-h-screen bg-background text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">
              {team.organization.name}
            </p>
            <h1 className="text-lg font-semibold">Leave requests</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/attendance"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Attendance
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

        {success ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {success}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              filter === 'pending'
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-slate-700 text-slate-300'
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              filter === 'all'
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-slate-700 text-slate-300'
            }`}
          >
            All
          </button>
        </div>

        <section className="space-y-3">
          {requests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
              No leave requests found.
            </p>
          ) : (
            requests.map((request) => (
              <article
                key={request.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">
                      {request.employeeName ?? 'Employee'}
                    </p>
                    <p className="text-sm text-slate-400">
                      {request.employeeEmail}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {formatLeaveType(request.leaveType)} · {request.startDate} →{' '}
                      {request.endDate}
                      {request.requestedDays
                        ? ` · ${request.requestedDays} day(s)`
                        : ''}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{request.reason}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${getLeaveStatusClassName(request.status)}`}
                  >
                    {formatLeaveStatus(request.status)}
                  </span>
                </div>

                {request.status === 'pending' ? (
                  <div className="mt-4 flex gap-2">
                    <LoadingButton
                      type="button"
                      loading={actingId === request.id}
                      loadingText="Approving…"
                      onClick={() => handleReview(request.id, 'approve')}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950"
                    >
                      Approve
                    </LoadingButton>
                    <LoadingButton
                      type="button"
                      loading={actingId === request.id}
                      loadingText="Rejecting…"
                      onClick={() => handleReview(request.id, 'reject')}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300"
                    >
                      Reject
                    </LoadingButton>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

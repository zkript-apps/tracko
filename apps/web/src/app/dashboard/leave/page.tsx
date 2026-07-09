'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
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
import { getOrganizationSubscription } from '@/lib/billing';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

export default function LeavePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [actingId, setActingId] = useState<string | null>(null);

  async function loadRequests(nextFilter: 'pending' | 'all') {
    const data = await getManagedLeaveRequests(
      nextFilter === 'pending' ? 'pending' : undefined,
    );
    setRequests(data);
  }

  useEffect(() => {
    if (!session) {
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
        return getOrganizationSubscription().then((subscription) => {
          if (!subscription.activeFeatures.includes('leave')) {
            router.replace('/dashboard/settings/subscription');
            return;
          }

          return loadRequests('pending');
        });
      })
      .catch(() => router.replace('/dashboard'));
  }, [router, session]);

  useEffect(() => {
    if (!team) {
      return;
    }

    void loadRequests(filter).catch((loadError) => {
      toast.error(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load leave requests.',
      );
    });
  }, [filter, team]);

  async function handleReview(id: string, action: 'approve' | 'reject') {
    setActingId(id);

    try {
      if (action === 'approve') {
        await approveLeaveRequest(id);
        toast.success('Leave request approved.');
      } else {
        await rejectLeaveRequest(id);
        toast.success('Leave request rejected.');
      }

      await loadRequests(filter);
    } catch (reviewError) {
      toast.error(
        reviewError instanceof Error
          ? reviewError.message
          : 'Unable to review leave request.',
      );
    } finally {
      setActingId(null);
    }
  }

  if (!team) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Leave requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and approve employee leave.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={`rounded-lg px-4 py-2 text-sm transition ${
            filter === 'pending'
              ? 'bg-primary text-primary-foreground'
              : 'border border-border text-muted-foreground'
          }`}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-lg px-4 py-2 text-sm transition ${
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'border border-border text-muted-foreground'
          }`}
        >
          All
        </button>
      </div>

      <section className="space-y-3">
        {requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No leave requests found.
          </p>
        ) : (
          requests.map((request) => (
            <article
              key={request.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {request.employeeName ?? 'Employee'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {request.employeeEmail}
                  </p>
                  <p className="mt-2 text-sm text-foreground/80">
                    {formatLeaveType(request.leaveType)} · {request.startDate} →{' '}
                    {request.endDate}
                    {request.requestedDays
                      ? ` · ${request.requestedDays} day(s)`
                      : ''}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {request.reason}
                  </p>
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
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    Approve
                  </LoadingButton>
                  <LoadingButton
                    type="button"
                    loading={actingId === request.id}
                    loadingText="Rejecting…"
                    onClick={() => handleReview(request.id, 'reject')}
                    className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive"
                  >
                    Reject
                  </LoadingButton>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}

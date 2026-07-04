'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { LoadingButton } from '@/components/ui/loading-button';
import { signOut, useSession } from '@/lib/auth-client';
import {
  clockIn,
  clockOut,
  formatAttendanceTime,
  getMyAttendanceStatus,
  type AttendanceStatus,
} from '@/lib/attendance';
import { getOnboardingStatus } from '@/lib/onboarding';
import { formatOrgRole } from '@/lib/org-roles';
import {
  cancelLeaveRequest,
  createLeaveRequest,
  formatLeaveStatus,
  formatLeaveType,
  getMyLeaveRequests,
  LEAVE_TYPES,
  type LeaveRequest,
} from '@/lib/leave';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

async function getOptionalLocation(): Promise<{
  latitude?: number;
  longitude?: number;
}> {
  if (!navigator.geolocation) {
    return {};
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

export default function EmployeePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveType, setLeaveType] = useState<string>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadWorkforceData = useCallback(async () => {
    const [status, requests] = await Promise.all([
      getMyAttendanceStatus(),
      getMyLeaveRequests(),
    ]);
    setAttendance(status);
    setLeaveRequests(requests);
  }, []);

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
          const role = overview.currentMember?.role ?? 'member';

          if (role !== 'employee') {
            router.replace('/dashboard');
            return;
          }

          setTeam(overview);
          return loadWorkforceData();
        })
        .catch(() => router.replace('/sign-in'));
    });
  }, [isPending, loadWorkforceData, router, session]);

  async function handleClock(action: 'in' | 'out') {
    setError(null);
    setSuccess(null);
    setClockLoading(true);

    try {
      const location = await getOptionalLocation();

      if (action === 'in') {
        await clockIn(location);
        setSuccess('Clocked in successfully.');
      } else {
        await clockOut(location);
        setSuccess('Clocked out successfully.');
      }

      await loadWorkforceData();
    } catch (clockError) {
      setError(
        clockError instanceof Error
          ? clockError.message
          : 'Unable to update attendance.',
      );
    } finally {
      setClockLoading(false);
    }
  }

  async function handleLeaveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLeaveLoading(true);

    try {
      await createLeaveRequest({ leaveType, startDate, endDate, reason });
      setReason('');
      setSuccess('Leave request submitted.');
      await loadWorkforceData();
    } catch (leaveError) {
      setError(
        leaveError instanceof Error
          ? leaveError.message
          : 'Unable to submit leave request.',
      );
    } finally {
      setLeaveLoading(false);
    }
  }

  async function handleCancelLeave(id: string) {
    setError(null);
    setSuccess(null);
    setCancellingId(id);

    try {
      await cancelLeaveRequest(id);
      setSuccess('Leave request canceled.');
      await loadWorkforceData();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'Unable to cancel leave request.',
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

  if (isPending || !team || !session || !attendance) {
    return <DashboardSkeleton />;
  }

  const currentMember = team.members.find(
    (member) => member.userId === session.user.id,
  );
  const branchLabel = currentMember?.branch?.name;

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">
              WorkTrack
            </p>
            <h1 className="text-lg font-semibold">Employee portal</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
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

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
            {formatOrgRole('employee')}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Welcome, {session.user.name}
          </h2>
          <p className="mt-2 text-slate-300">
            {team.organization.name}
            {branchLabel ? ` · ${branchLabel}` : ''}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Time in / out</h2>
              <p className="mt-2 text-sm text-slate-400">
                {attendance.isClockedIn
                  ? 'You are currently clocked in.'
                  : 'You are currently clocked out.'}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                attendance.isClockedIn
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {attendance.isClockedIn ? 'On duty' : 'Off duty'}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <LoadingButton
              type="button"
              loading={clockLoading && !attendance.isClockedIn}
              loadingText="Clocking in…"
              disabled={clockLoading || attendance.isClockedIn}
              onClick={() => handleClock('in')}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              Clock in
            </LoadingButton>
            <LoadingButton
              type="button"
              loading={clockLoading && attendance.isClockedIn}
              loadingText="Clocking out…"
              disabled={clockLoading || !attendance.isClockedIn}
              onClick={() => handleClock('out')}
              className="rounded-lg border border-slate-700 px-5 py-2.5 font-medium text-slate-200 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
            >
              Clock out
            </LoadingButton>
          </div>

          {attendance.todayEvents.length > 0 ? (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-slate-300">Today</p>
              {attendance.todayEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm"
                >
                  <span className="capitalize text-slate-300">
                    {event.type.replace('_', ' ')}
                  </span>
                  <span className="text-slate-500">
                    {formatAttendanceTime(event.recordedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-white">Request leave</h2>
          <form className="mt-6 space-y-4" onSubmit={handleLeaveSubmit}>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Leave type</span>
              <select
                required
                value={leaveType}
                onChange={(event) => setLeaveType(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
              >
                {LEAVE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Start date</span>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">End date</span>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Reason</span>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                placeholder="Brief reason for your leave request"
              />
            </label>

            <LoadingButton
              type="submit"
              loading={leaveLoading}
              loadingText="Submitting…"
              className="rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              Submit leave request
            </LoadingButton>
          </form>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
            My leave requests
          </h2>
          <div className="space-y-3">
            {leaveRequests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                No leave requests yet.
              </p>
            ) : (
              leaveRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">
                        {formatLeaveType(request.leaveType)}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {request.startDate} → {request.endDate}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">{request.reason}</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-emerald-300">
                      {formatLeaveStatus(request.status)}
                    </span>
                  </div>
                  {request.status === 'pending' ? (
                    <LoadingButton
                      type="button"
                      loading={cancellingId === request.id}
                      loadingText="Canceling…"
                      onClick={() => handleCancelLeave(request.id)}
                      className="mt-3 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
                    >
                      Cancel request
                    </LoadingButton>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

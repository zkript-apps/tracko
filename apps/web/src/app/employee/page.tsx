'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import {
  defaultDtrRange,
  formatDtrDate,
  formatDtrStatus,
  formatDtrTime,
  formatWorkedMinutes,
  getDtrStatusClassName,
  getMyDtrRecords,
  sumWorkedMinutes,
  type DailyTimeRecord,
} from '@/lib/dtr';
import { getOnboardingStatus } from '@/lib/onboarding';
import { formatOrgRole } from '@/lib/org-roles';
import {
  cancelLeaveRequest,
  createLeaveRequest,
  formatLeaveStatus,
  formatLeaveType,
  getLeaveStatusClassName,
  getMyLeaveBalances,
  getMyLeaveRequests,
  getSelectableLeaveTypes,
  BALANCE_LEAVE_TYPES,
  type LeaveBalance,
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
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [dtrRecords, setDtrRecords] = useState<DailyTimeRecord[]>([]);
  const [dtrRange, setDtrRange] = useState(defaultDtrRange);
  const [leaveType, setLeaveType] = useState<string>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [clockLoading, setClockLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const selectableLeaveTypes = useMemo(
    () => getSelectableLeaveTypes(leaveBalances),
    [leaveBalances],
  );

  useEffect(() => {
    if (selectableLeaveTypes.length === 0) {
      return;
    }

    if (!selectableLeaveTypes.some((type) => type.value === leaveType)) {
      setLeaveType(selectableLeaveTypes[0].value);
    }
  }, [leaveType, selectableLeaveTypes]);

  const loadWorkforceData = useCallback(async () => {
    const [status, requests, balances, dtr] = await Promise.all([
      getMyAttendanceStatus(),
      getMyLeaveRequests(),
      getMyLeaveBalances(),
      getMyDtrRecords(dtrRange),
    ]);
    setAttendance(status);
    setLeaveRequests(requests);
    setLeaveBalances(balances.leaveBalances);
    setDtrRecords(dtr.records);
  }, [dtrRange]);

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

  useEffect(() => {
    if (!team) {
      return;
    }

    void getMyDtrRecords(dtrRange)
      .then((dtr) => setDtrRecords(dtr.records))
      .catch(() => toast.error('Unable to load daily time records.'));
  }, [dtrRange, team]);

  async function handleClock(action: 'in' | 'out') {
    setClockLoading(true);

    try {
      const location = await getOptionalLocation();

      if (action === 'in') {
        await clockIn(location);
        toast.success('Clocked in successfully.');
      } else {
        await clockOut(location);
        toast.success('Clocked out successfully.');
      }

      await loadWorkforceData();
    } catch (clockError) {
      toast.error(
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
    setLeaveLoading(true);

    try {
      await createLeaveRequest({ leaveType, startDate, endDate, reason });
      setReason('');
      toast.success('Leave request submitted.');
      await loadWorkforceData();
    } catch (leaveError) {
      toast.error(
        leaveError instanceof Error
          ? leaveError.message
          : 'Unable to submit leave request.',
      );
    } finally {
      setLeaveLoading(false);
    }
  }

  async function handleCancelLeave(id: string) {
    setCancellingId(id);

    try {
      await cancelLeaveRequest(id);
      toast.success('Leave request canceled.');
      await loadWorkforceData();
    } catch (cancelError) {
      toast.error(
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
    <div className="min-h-screen bg-background text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">
              Tracko
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                My daily time records
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Summaries from your clock in/out events this period.
              </p>
            </div>
            <p className="text-sm text-slate-400">
              Total:{' '}
              <span className="font-medium text-white">
                {formatWorkedMinutes(sumWorkedMinutes(dtrRecords))}
              </span>
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">From</span>
              <input
                type="date"
                value={dtrRange.startDate}
                onChange={(event) =>
                  setDtrRange((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">To</span>
              <input
                type="date"
                value={dtrRange.endDate}
                onChange={(event) =>
                  setDtrRange((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
              />
            </label>
          </div>

          <div className="mt-6 space-y-2">
            {dtrRecords.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                No records for this period.
              </p>
            ) : (
              [...dtrRecords].reverse().map((record) => (
                <div
                  key={record.date}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-950 px-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-200">
                      {formatDtrDate(record.date)}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {formatDtrTime(record.timeIn)} →{' '}
                      {formatDtrTime(record.timeOut)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {record.workedMinutes > 0
                        ? formatWorkedMinutes(record.workedMinutes)
                        : '—'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${getDtrStatusClassName(record.status)}`}
                    >
                      {formatDtrStatus(record.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-white">Leave balances</h2>
          <p className="mt-2 text-sm text-slate-400">
            Available days for this year. Unpaid leave does not use a balance.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {BALANCE_LEAVE_TYPES.map((leaveType) => {
              const balance = leaveBalances.find(
                (item) => item.leaveType === leaveType,
              );

              return (
                <article
                  key={leaveType}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <p className="text-sm text-slate-400">
                    {formatLeaveType(leaveType)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {balance?.availableDays ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {balance?.usedDays ?? 0} used · {balance?.pendingDays ?? 0}{' '}
                    pending · {balance?.entitledDays ?? 0} total
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-white">Request leave</h2>
          {selectableLeaveTypes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              You have no leave balance available. Contact HR if you need to
              request time off.
            </p>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleLeaveSubmit}>
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Leave type</span>
                <select
                  required
                  value={leaveType}
                  onChange={(event) => setLeaveType(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                >
                  {selectableLeaveTypes.map((type) => (
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
          )}
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
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${getLeaveStatusClassName(request.status)}`}
                    >
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

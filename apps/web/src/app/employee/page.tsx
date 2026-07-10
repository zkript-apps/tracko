'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, Moon, ShieldCheck, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { DateInput } from '@/components/ui/date-input';
import { LoadingButton } from '@/components/ui/loading-button';
import { signOut, useSession } from '@/lib/auth-client';
import {
  clockIn,
  clockOut,
  formatAttendanceTime,
  formatElapsedDuration,
  getActiveClockInTime,
  getMyAttendanceStatus,
  getRequiredLocation,
  postMyLiveLocation,
  type AttendanceStatus,
} from '@/lib/attendance';
import {
  authenticateWithBiometric,
  getBiometricStatus,
  getBiometricSupport,
  registerBiometricCredential,
  type BiometricStatus,
} from '@/lib/biometrics';
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
import { formatOrgRole, isHrRole } from '@/lib/org-roles';
import { getAnnouncements, type Announcement } from '@/lib/announcements';
import { useThemeMode } from '@/components/theme/theme-provider';
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
  type LeaveEligibility,
  type LeaveRequest,
} from '@/lib/leave';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

const LOCATION_POST_INTERVAL_MS = 60_000;

const employeeDateInputClassName =
  'h-auto border-border bg-background px-3 py-2 text-foreground focus-visible:ring-ring';

export default function EmployeePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { themeMode, setThemeMode } = useThemeMode();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveEligibility, setLeaveEligibility] = useState<LeaveEligibility | null>(
    null,
  );
  const [leavePeriodLabel, setLeavePeriodLabel] = useState<string | null>(null);
  const [dtrRecords, setDtrRecords] = useState<DailyTimeRecord[]>([]);
  const [dtrRange, setDtrRange] = useState(defaultDtrRange);
  const [leaveType, setLeaveType] = useState<string>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [clockLoading, setClockLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(
    null,
  );
  const [biometricSupport, setBiometricSupport] = useState<{
    supported: boolean;
    platformAvailable: boolean;
  } | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [locationSharing, setLocationSharing] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const locationWatchIdRef = useRef<number | null>(null);
  const locationPostIntervalRef = useRef<number | null>(null);
  const lastLocationPostRef = useRef(0);

  const postCurrentLocation = useCallback(async (force = false) => {
    if (!navigator.geolocation) {
      return;
    }

    const now = Date.now();
    if (
      !force &&
      now - lastLocationPostRef.current < LOCATION_POST_INTERVAL_MS
    ) {
      return;
    }

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          lastLocationPostRef.current = Date.now();
          void postMyLiveLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
            .then(() => {
              setLocationSharing(true);
            })
            .catch(() => {
              // Keep trying on the next interval tick.
            })
            .finally(resolve);
        },
        () => {
          setLocationSharing(false);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    });
  }, []);

  const paidLeaveEligible = leaveEligibility?.eligible !== false;

  const selectableLeaveTypes = useMemo(
    () =>
      getSelectableLeaveTypes(leaveBalances, {
        paidLeaveEligible,
      }),
    [leaveBalances, paidLeaveEligible],
  );

  const stopLocationSharing = useCallback(() => {
    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
    if (locationPostIntervalRef.current !== null) {
      window.clearInterval(locationPostIntervalRef.current);
      locationPostIntervalRef.current = null;
    }
    setLocationSharing(false);
  }, []);

  const startLocationSharing = useCallback(() => {
    if (!navigator.geolocation) {
      return;
    }

    void postCurrentLocation(true);

    if (locationPostIntervalRef.current === null) {
      locationPostIntervalRef.current = window.setInterval(() => {
        void postCurrentLocation();
      }, LOCATION_POST_INTERVAL_MS);
    }

    if (locationWatchIdRef.current !== null) {
      setLocationSharing(true);
      return;
    }

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastLocationPostRef.current < LOCATION_POST_INTERVAL_MS) {
          return;
        }

        lastLocationPostRef.current = now;
        void postMyLiveLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
          .then(() => {
            setLocationSharing(true);
          })
          .catch(() => {
            // Interval fallback will retry.
          });
      },
      () => {
        setLocationSharing(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 20_000,
      },
    );
    setLocationSharing(true);
  }, [postCurrentLocation]);

  useEffect(() => {
    if (selectableLeaveTypes.length === 0) {
      return;
    }

    if (!selectableLeaveTypes.some((type) => type.value === leaveType)) {
      setLeaveType(selectableLeaveTypes[0].value);
    }
  }, [leaveType, selectableLeaveTypes]);

  const loadWorkforceData = useCallback(async () => {
    const status = await getMyAttendanceStatus();
    setAttendance(status);

    const [requests, balances, dtr, biometrics, support, latestAnnouncements] =
      await Promise.all([
      status.leaveEnabled
        ? getMyLeaveRequests()
        : Promise.resolve([] as LeaveRequest[]),
      status.leaveEnabled
        ? getMyLeaveBalances()
        : Promise.resolve({
            leaveBalances: [] as LeaveBalance[],
            periodStart: undefined,
            periodEnd: undefined,
            leaveEligibility: null,
          }),
      getMyDtrRecords(dtrRange),
      getBiometricStatus(),
      getBiometricSupport(),
      getAnnouncements(3),
    ]);
    setLeaveRequests(requests);
    setLeaveBalances(balances.leaveBalances);
    setLeaveEligibility(balances.leaveEligibility ?? null);
    setLeavePeriodLabel(
      balances.periodStart && balances.periodEnd
        ? `${balances.periodStart} to ${balances.periodEnd}`
        : null,
    );
    setDtrRecords(dtr.records);
    setBiometricStatus(biometrics);
    setBiometricSupport(support);
    setAnnouncements(latestAnnouncements);
  }, [dtrRange]);

  const activeClockInAt = attendance ? getActiveClockInTime(attendance) : null;
  const elapsedMs = activeClockInAt
    ? now - new Date(activeClockInAt).getTime()
    : null;

  useEffect(() => {
    if (!activeClockInAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeClockInAt]);

  useEffect(() => {
    if (!attendance) {
      return;
    }

    if (attendance.isClockedIn && attendance.liveTrackingEnabled) {
      startLocationSharing();
      return;
    }

    stopLocationSharing();
  }, [attendance, startLocationSharing, stopLocationSharing]);

  useEffect(() => {
    return () => {
      stopLocationSharing();
    };
  }, [stopLocationSharing]);

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

          if (role !== 'employee' && !isHrRole(role)) {
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

  async function handleRegisterBiometric() {
    setBiometricLoading(true);

    try {
      await registerBiometricCredential();
      const status = await getBiometricStatus();
      setBiometricStatus(status);
      toast.success('Biometric clock-in is ready on this device.');
    } catch (registerError) {
      toast.error(
        registerError instanceof Error
          ? registerError.message
          : 'Unable to set up biometrics.',
      );
    } finally {
      setBiometricLoading(false);
    }
  }

  async function handleClock(action: 'in' | 'out') {
    setClockLoading(true);

    try {
      if (
        biometricStatus?.biometricsRequired &&
        biometricSupport?.platformAvailable &&
        !biometricStatus.enrolled
      ) {
        toast.error('Set up biometric clock-in before continuing.');
        return;
      }

      const location = await getRequiredLocation();
      const payload: {
        latitude: number;
        longitude: number;
        accuracy?: number;
        biometricResponse?: Awaited<ReturnType<typeof authenticateWithBiometric>>;
      } = { ...location };

      if (biometricStatus?.enrolled) {
        payload.biometricResponse = await authenticateWithBiometric();
      }

      if (action === 'in') {
        await clockIn(payload);
        toast.success('Clocked in successfully.');
      } else {
        await clockOut(payload);
        stopLocationSharing();
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
    stopLocationSharing();
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
  const mustEnrollBiometrics =
    Boolean(biometricStatus?.biometricsRequired) &&
    Boolean(biometricSupport?.platformAvailable) &&
    !biometricStatus?.enrolled;

  const currentRole = team?.currentMember?.role ?? 'employee';
  const isHr = isHrRole(currentRole);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">
              Tracko
            </p>
            <h1 className="text-lg font-semibold">
              {isHr ? 'Self-service portal' : 'Employee portal'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void setThemeMode(themeMode === 'dark' ? 'light' : 'dark')
              }
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:border-muted-foreground hover:text-foreground"
              aria-label={
                themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
            >
              {themeMode === 'dark' ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </button>
            {isHr ? (
              <Link
                href="/dashboard"
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-muted-foreground hover:text-foreground"
              >
                HR dashboard
              </Link>
            ) : null}
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <section className="rounded-2xl border border-border bg-primary/10 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
            {formatOrgRole(currentRole)}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Welcome, {session.user.name}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {team.organization.name}
            {branchLabel ? ` · ${branchLabel}` : ''}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Announcements</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Latest updates from your HR and admin team.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {announcements.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                No announcements yet.
              </p>
            ) : (
              announcements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <p className="font-medium text-foreground">{announcement.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {announcement.authorName ?? 'Admin'} ·{' '}
                    {new Date(announcement.createdAt).toLocaleString('en-PH')}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {announcement.body}
                  </p>
                </article>
              ))
            )}
          </div>

          <Link
            href="/employee/announcements"
            target="_blank"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Show all announcements
          </Link>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Fingerprint className="size-5 text-primary" />
                Biometric clock-in
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {biometricSupport?.platformAvailable
                  ? biometricStatus?.enrolled
                    ? 'Use Face ID, fingerprint, or Windows Hello when you clock in or out.'
                    : 'Register this device so attendance is verified with biometrics.'
                  : 'This device does not support platform biometrics. You can still clock in without them.'}
              </p>
            </div>
            {biometricStatus?.enrolled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
                <ShieldCheck className="size-3.5" />
                Enrolled
              </span>
            ) : null}
          </div>

          {biometricSupport?.platformAvailable && !biometricStatus?.enrolled ? (
            <LoadingButton
              type="button"
              loading={biometricLoading}
              loadingText="Setting up…"
              onClick={handleRegisterBiometric}
              className="mt-6 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Fingerprint className="size-4" />
              Set up biometrics
            </LoadingButton>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Time in / out</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {mustEnrollBiometrics
                  ? 'Complete biometric setup above before clocking in or out.'
                  : attendance.isClockedIn
                    ? biometricStatus?.enrolled
                      ? 'You are on duty. Clock out with biometrics when your shift ends.'
                      : 'You are currently clocked in.'
                    : biometricStatus?.enrolled
                      ? 'Clock in with biometrics to start your shift.'
                      : 'You are currently clocked out.'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Location is required to clock in or out.
                {attendance.isClockedIn && attendance.liveTrackingEnabled
                  ? locationSharing
                    ? ' Location sharing is on while you are on duty.'
                    : ' Keep this page open to share your live location with HR.'
                  : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  attendance.isClockedIn
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {attendance.isClockedIn ? 'On duty' : 'Off duty'}
              </span>
              {elapsedMs !== null && activeClockInAt ? (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Time elapsed</p>
                  <p className="font-mono text-2xl font-semibold tabular-nums text-primary">
                    {formatElapsedDuration(elapsedMs)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Since {formatAttendanceTime(activeClockInAt)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <LoadingButton
              type="button"
              loading={clockLoading && !attendance.isClockedIn}
              loadingText="Clocking in…"
              disabled={clockLoading || attendance.isClockedIn || mustEnrollBiometrics}
              onClick={() => handleClock('in')}
              className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <Fingerprint className="size-4" />
              Clock in
            </LoadingButton>
            <LoadingButton
              type="button"
              loading={clockLoading && attendance.isClockedIn}
              loadingText="Clocking out…"
              disabled={clockLoading || !attendance.isClockedIn || mustEnrollBiometrics}
              onClick={() => handleClock('out')}
              className="rounded-lg border border-border px-5 py-2.5 font-medium text-foreground transition hover:border-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Fingerprint className="size-4" />
              Clock out
            </LoadingButton>
          </div>

          {attendance.todayEvents.length > 0 ? (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Today</p>
              {attendance.todayEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="capitalize text-muted-foreground">
                      {event.type.replace('_', ' ')}
                    </span>
                    {event.biometricVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        <ShieldCheck className="size-3" />
                        Biometric
                      </span>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground">
                    {formatAttendanceTime(event.recordedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                My daily time records
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Summaries from your clock in/out events this period.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Total:{' '}
              <span className="font-medium text-foreground">
                {formatWorkedMinutes(sumWorkedMinutes(dtrRecords))}
              </span>
            </p>
          </div>

          <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="block min-w-0 space-y-2">
              <span className="text-sm text-muted-foreground">From</span>
              <DateInput
                value={dtrRange.startDate}
                onChange={(event) =>
                  setDtrRange((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                className={employeeDateInputClassName}
              />
            </label>
            <label className="block min-w-0 space-y-2">
              <span className="text-sm text-muted-foreground">To</span>
              <DateInput
                value={dtrRange.endDate}
                onChange={(event) =>
                  setDtrRange((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                className={employeeDateInputClassName}
              />
            </label>
          </div>

          <div className="mt-6 space-y-2">
            {dtrRecords.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                No records for this period.
              </p>
            ) : (
              [...dtrRecords].reverse().map((record) => (
                <div
                  key={record.date}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background px-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {formatDtrDate(record.date)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatDtrTime(record.timeIn)} →{' '}
                      {formatDtrTime(record.timeOut)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
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

        {attendance?.leaveEnabled ? (
          <>
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Leave balances</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Available days for the current leave period
            {leavePeriodLabel ? ` (${leavePeriodLabel})` : ''}. Unpaid leave
            does not use a balance.
          </p>

          {leaveEligibility?.eligible === false ? (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-center">
              <p className="font-medium text-foreground">
                You are not yet eligible for paid leave
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                You have completed {leaveEligibility.tenureMonthsServed} of{' '}
                {leaveEligibility.tenureMonthsRequired} required month(s) of
                service
                {leaveEligibility.hireDate
                  ? ` since ${new Date(`${leaveEligibility.hireDate}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : ''}
                . You can still request unpaid leave below.
              </p>
            </div>
          ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {BALANCE_LEAVE_TYPES.map((leaveType) => {
              const balance = leaveBalances.find(
                (item) => item.leaveType === leaveType,
              );

              return (
                <article
                  key={leaveType}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <p className="text-sm text-muted-foreground">
                    {formatLeaveType(leaveType)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {balance?.availableDays ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {balance?.usedDays ?? 0} used · {balance?.pendingDays ?? 0}{' '}
                    pending · {balance?.entitledDays ?? 0} total
                    {(balance?.carriedOverDays ?? 0) > 0
                      ? ` · ${balance?.carriedOverDays} carried over`
                      : ''}
                    {leaveType === 'vacation' && (balance?.silFloorDays ?? 0) > 0
                      ? ` · SIL floor ${balance?.silFloorDays}`
                      : ''}
                  </p>
                </article>
              );
            })}
          </div>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Request leave</h2>
          {leaveEligibility?.eligible === false ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Paid leave types are unavailable until you complete{' '}
              {leaveEligibility.tenureMonthsRequired} month(s) of service. You can
              still submit an unpaid leave request.
            </p>
          ) : null}
          {selectableLeaveTypes.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You have no leave balance available. Contact HR if you need to
              request time off.
            </p>
          ) : (
            <form className="mt-6 min-w-0 space-y-4" onSubmit={handleLeaveSubmit}>
              <label className="block min-w-0 space-y-2">
                <span className="text-sm text-muted-foreground">Leave type</span>
                <select
                  required
                  value={leaveType}
                  onChange={(event) => setLeaveType(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                >
                  {selectableLeaveTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="block min-w-0 space-y-2">
                <span className="text-sm text-muted-foreground">Start date</span>
                <DateInput
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={employeeDateInputClassName}
                />
              </label>
              <label className="block min-w-0 space-y-2">
                <span className="text-sm text-muted-foreground">End date</span>
                <DateInput
                  required
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={employeeDateInputClassName}
                />
              </label>
            </div>

            <label className="block min-w-0 space-y-2">
              <span className="text-sm text-muted-foreground">Reason</span>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                placeholder="Brief reason for your leave request"
              />
            </label>

            <LoadingButton
              type="submit"
              loading={leaveLoading}
              loadingText="Submitting…"
              className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
            >
              Submit leave request
            </LoadingButton>
          </form>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            My leave requests
          </h2>
          <div className="space-y-3">
            {leaveRequests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No leave requests yet.
              </p>
            ) : (
              leaveRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {formatLeaveType(request.leaveType)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {request.startDate} → {request.endDate}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{request.reason}</p>
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
                      className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-muted-foreground hover:text-foreground"
                    >
                      Cancel request
                    </LoadingButton>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

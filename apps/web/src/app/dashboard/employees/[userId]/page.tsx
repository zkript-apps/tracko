'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import { DateInput, TimeInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/lib/auth-client';
import {
  EMPLOYMENT_TYPES,
  formatDateLabel,
  formatEmploymentPeriod,
  formatEmploymentType,
  formatWorkSchedule,
  getEmployeeRecord,
  updateEmployeeLeaveBalances,
  updateEmployeeProfile,
  updateEmployeeWorkSchedule,
  WEEKDAY_OPTIONS,
  type EmployeeDetail,
  type EmploymentType,
} from '@/lib/employees';
import { formatLeaveType, BALANCE_LEAVE_TYPES, formatLeaveStatus, getLeaveStatusClassName } from '@/lib/leave';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

const BALANCE_TYPES = BALANCE_LEAVE_TYPES;

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [employmentType, setEmploymentType] = useState<EmploymentType>('probation');
  const [jobTitle, setJobTitle] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [probationEndDate, setProbationEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [balanceInputs, setBalanceInputs] = useState<Record<string, number>>({
    vacation: 0,
    sick: 0,
    emergency: 0,
  });
  const [weeklyRestDays, setWeeklyRestDays] = useState<number[]>([0, 6]);
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('17:00');
  const [extraDayOffDates, setExtraDayOffDates] = useState<string[]>([]);
  const [newDayOffDate, setNewDayOffDate] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  async function loadEmployee(nextYear = periodYear) {
    const record = await getEmployeeRecord(userId, nextYear);
    setEmployee(record);
    setEmploymentType(record.profile.employmentType);
    setJobTitle(record.profile.jobTitle ?? '');
    setHireDate(record.profile.hireDate);
    setContractStartDate(record.profile.contractStartDate);
    setContractEndDate(record.profile.contractEndDate ?? '');
    setProbationEndDate(record.profile.probationEndDate ?? '');
    setNotes(record.profile.notes ?? '');
    setWeeklyRestDays(record.profile.workSchedule.weeklyRestDays);
    setWorkStartTime(record.profile.workSchedule.workStartTime);
    setWorkEndTime(record.profile.workSchedule.workEndTime);
    setExtraDayOffDates(record.profile.workSchedule.extraDayOffDates);

    const nextBalances: Record<string, number> = {
      vacation: 0,
      sick: 0,
      emergency: 0,
    };

    for (const balance of record.leaveBalances) {
      nextBalances[balance.leaveType] = balance.entitledDays;
    }

    setBalanceInputs(nextBalances);
  }

  useEffect(() => {
    if (!session || !userId) {
      return;
    }

    void getTeamOverview()
      .then((overview) => {
        if (!overview.currentMember?.canInviteEmployees) {
          router.replace('/dashboard');
          return;
        }

        setTeam(overview);
        return loadEmployee();
      })
      .catch(() => router.replace('/dashboard'));
  }, [router, session, userId]);

  useEffect(() => {
    if (!team) {
      return;
    }

    void loadEmployee(periodYear).catch((loadError) => {
      toast.error(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load employee record.',
      );
    });
  }, [periodYear, team]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileLoading(true);

    try {
      await updateEmployeeProfile(userId, {
        employmentType,
        jobTitle,
        hireDate,
        contractStartDate,
        contractEndDate: contractEndDate || null,
        probationEndDate: probationEndDate || null,
        notes: notes || null,
      });
      await loadEmployee();
      toast.success('Employment profile updated.');
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update profile.',
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleBalancesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBalanceLoading(true);

    try {
      await updateEmployeeLeaveBalances(userId, {
        periodYear,
        balances: BALANCE_TYPES.map((leaveType) => ({
          leaveType,
          entitledDays: balanceInputs[leaveType] ?? 0,
        })),
      });
      await loadEmployee();
      toast.success('Leave balances updated.');
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update leave balances.',
      );
    } finally {
      setBalanceLoading(false);
    }
  }

  function toggleRestDay(day: number) {
    setWeeklyRestDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((left, right) => left - right),
    );
  }

  function handleAddDayOff() {
    if (!newDayOffDate || extraDayOffDates.includes(newDayOffDate)) {
      return;
    }

    setExtraDayOffDates((current) =>
      [...current, newDayOffDate].sort((left, right) => left.localeCompare(right)),
    );
    setNewDayOffDate('');
  }

  async function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScheduleLoading(true);

    try {
      await updateEmployeeWorkSchedule(userId, {
        weeklyRestDays,
        workStartTime,
        workEndTime,
        extraDayOffDates,
      });
      await loadEmployee();
      toast.success('Work schedule updated.');
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update work schedule.',
      );
    } finally {
      setScheduleLoading(false);
    }
  }

  if (!team || !employee) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const branch = team.branches.find((item) => item._id === employee.branchId);

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <Link
          href="/dashboard/employees"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Employees
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {employee.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{employee.email}</p>
      </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Employment overview</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Status
              </p>
              <p className="mt-2 font-medium text-foreground">
                {formatEmploymentType(employee.profile.employmentType)}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Branch
              </p>
              <p className="mt-2 font-medium text-foreground">
                {branch?.name ?? 'Unassigned'}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Contract period
              </p>
              <p className="mt-2 font-medium text-foreground">
                {formatEmploymentPeriod(employee.profile)}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Hired
              </p>
              <p className="mt-2 font-medium text-foreground">
                {formatDateLabel(employee.profile.hireDate)}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Work schedule
              </p>
              <p className="mt-2 font-medium text-foreground">
                {formatWorkSchedule(employee.profile.workSchedule)}
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Work schedule</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Set weekly rest days and shift hours. Scheduled day offs are not
            counted as absences in DTR.
          </p>

          <form className="mt-6 space-y-6" onSubmit={handleScheduleSubmit}>
            <div className="space-y-3">
              <p className="text-sm text-slate-300">Weekly rest days</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const selected = weeklyRestDays.includes(day.value);

                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleRestDay(day.value)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        selected
                          ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                          : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Shift start</span>
                <TimeInput
                  required
                  value={workStartTime}
                  onChange={(event) => setWorkStartTime(event.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Shift end</span>
                <TimeInput
                  required
                  value={workEndTime}
                  onChange={(event) => setWorkEndTime(event.target.value)}
                />
              </label>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-300">Extra day offs</p>
              <p className="text-xs text-slate-500">
                One-off holidays or special rest days outside the weekly schedule.
              </p>
              <div className="flex flex-wrap gap-3">
                <DateInput
                  value={newDayOffDate}
                  onChange={(event) => setNewDayOffDate(event.target.value)}
                  className="max-w-xs"
                />
                <button
                  type="button"
                  onClick={handleAddDayOff}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  Add day off
                </button>
              </div>
              {extraDayOffDates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {extraDayOffDates.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-300"
                    >
                      {formatDateLabel(date)}
                      <button
                        type="button"
                        onClick={() =>
                          setExtraDayOffDates((current) =>
                            current.filter((value) => value !== date),
                          )
                        }
                        className="text-slate-500 transition hover:text-white"
                        aria-label={`Remove ${date}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No extra day offs set.</p>
              )}
            </div>

            <LoadingButton
              type="submit"
              loading={scheduleLoading}
              loadingText="Saving…"
              className="rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              Save work schedule
            </LoadingButton>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Employment profile</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Set employment type, contract dates, and probation period.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleProfileSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employment-type">Employment type</Label>
                <Select
                  value={employmentType}
                  onValueChange={(value) =>
                    setEmploymentType(value as EmploymentType)
                  }
                >
                  <SelectTrigger id="employment-type" className="w-full">
                    <SelectValue placeholder="Select employment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-title">Job title</Label>
                <Input
                  id="job-title"
                  type="text"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="e.g. Sales Associate"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hire-date">Hire date</Label>
                <DateInput
                  id="hire-date"
                  required
                  value={hireDate}
                  onChange={(event) => setHireDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="probation-end">Probation end</Label>
                <DateInput
                  id="probation-end"
                  value={probationEndDate}
                  onChange={(event) => setProbationEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contract-start">Contract start</Label>
                <DateInput
                  id="contract-start"
                  required
                  value={contractStartDate}
                  onChange={(event) => setContractStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-end">Contract end</Label>
                <DateInput
                  id="contract-end"
                  value={contractEndDate}
                  onChange={(event) => setContractEndDate(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for open-ended contracts.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Internal notes about this employee"
              />
            </div>

            <LoadingButton type="submit" loading={profileLoading} loadingText="Saving…">
              Save profile
            </LoadingButton>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Leave balances</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Set how many days this employee can take per leave type.
              </p>
            </div>
            <label className="block space-y-2">
              <Label htmlFor="period-year">Year</Label>
              <Input
                id="period-year"
                type="number"
                min={2000}
                max={2100}
                value={periodYear}
                onChange={(event) => setPeriodYear(Number(event.target.value))}
                className="w-28"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {BALANCE_TYPES.map((leaveType) => {
              const balance = employee.leaveBalances.find(
                (item) => item.leaveType === leaveType,
              );

              return (
                <article
                  key={leaveType}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <p className="text-sm text-slate-400">
                    {formatLeaveType(leaveType)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {balance?.availableDays ?? 0}
                    <span className="text-sm font-normal text-slate-500">
                      {' '}
                      / {balance?.entitledDays ?? 0} available
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Used {balance?.usedDays ?? 0} · Pending{' '}
                    {balance?.pendingDays ?? 0}
                  </p>
                </article>
              );
            })}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleBalancesSubmit}>
            <div className="grid gap-4 md:grid-cols-3">
              {BALANCE_TYPES.map((leaveType) => (
                <label key={leaveType} className="block space-y-2">
                  <span className="text-sm text-slate-300">
                    {formatLeaveType(leaveType)} days
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    required
                    value={balanceInputs[leaveType] ?? 0}
                    onChange={(event) =>
                      setBalanceInputs((current) => ({
                        ...current,
                        [leaveType]: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
                  />
                </label>
              ))}
            </div>

            <LoadingButton
              type="submit"
              loading={balanceLoading}
              loadingText="Saving…"
              className="rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              Save leave balances
            </LoadingButton>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Leave history</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            All leave requests submitted by this employee.
          </p>

          <div className="mt-6 space-y-3">
            {employee.leaveHistory.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No leave requests yet.
              </p>
            ) : (
              employee.leaveHistory.map((request) => (
                <article
                  key={request.id}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">
                        {formatLeaveType(request.leaveType)}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatDateLabel(request.startDate)} →{' '}
                        {formatDateLabel(request.endDate)}
                        {request.requestedDays
                          ? ` · ${request.requestedDays} day(s)`
                          : ''}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">{request.reason}</p>
                      {request.reviewNote ? (
                        <p className="mt-2 text-sm text-slate-500">
                          Review note: {request.reviewNote}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${getLeaveStatusClassName(request.status)}`}
                    >
                      {formatLeaveStatus(request.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    Submitted {formatDateLabel(request.createdAt.slice(0, 10))}
                    {request.reviewedAt
                      ? ` · Reviewed ${formatDateLabel(request.reviewedAt.slice(0, 10))}`
                      : ''}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
    </div>
  );
}

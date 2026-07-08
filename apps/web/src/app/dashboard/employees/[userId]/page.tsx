'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
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
  PAY_RATE_TYPES,
  DOCUMENT_CATEGORIES,
  createEmployeeDocument,
  deleteEmployeeDocument,
  downloadEmployeeDocumentFile,
  formatDateLabel,
  formatDocumentCategory,
  formatFileSize,
  formatEmploymentPeriod,
  formatEmploymentType,
  formatWorkSchedule,
  getEmployeeRecord,
  listEmployeeDocuments,
  updateEmployeeLeaveBalances,
  updateEmployeeCompensation,
  updateEmployeeProfile,
  updateEmployeeWorkSchedule,
  WEEKDAY_OPTIONS,
  type DocumentCategory,
  type EmployeeDetail,
  type EmployeeDocument,
  type EmploymentType,
  type PayRateType,
} from '@/lib/employees';
import {
  defaultDtrRange,
  formatDtrDate,
  formatDtrStatus,
  formatDtrTime,
  formatWorkedMinutes,
  getDtrOverview,
  getDtrStatusClassName,
  summarizeEmployeeDtr,
  type DailyTimeRecord,
} from '@/lib/dtr';
import { formatLeaveType, BALANCE_LEAVE_TYPES, formatLeaveStatus, getLeaveStatusClassName } from '@/lib/leave';
import { isHrRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

const BALANCE_TYPES = BALANCE_LEAVE_TYPES;

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
      <Icon className="size-5 shrink-0 text-primary" />
      {children}
    </h2>
  );
}

function canAccessEmployeeRecords(team: TeamOverview): boolean {
  const member = team.currentMember;
  if (!member) {
    return false;
  }

  return (
    member.canManageTeam ||
    member.canInviteEmployees ||
    isHrRole(member.role)
  );
}

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
  const [payRateType, setPayRateType] = useState<PayRateType>('monthly');
  const [payRateAmount, setPayRateAmount] = useState('');
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
  const [compensationLoading, setCompensationLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentCategory, setDocumentCategory] =
    useState<DocumentCategory>('contract');
  const [documentNotes, setDocumentNotes] = useState('');
  const [documentReferenceUrl, setDocumentReferenceUrl] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<
    string | null
  >(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  );
  const [dtrRecords, setDtrRecords] = useState<DailyTimeRecord[]>([]);
  const [dtrRange, setDtrRange] = useState(defaultDtrRange);

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
    setPayRateType(record.profile.payRate?.type ?? 'monthly');
    setPayRateAmount(
      record.profile.payRate?.amount !== null &&
        record.profile.payRate?.amount !== undefined
        ? String(record.profile.payRate.amount)
        : record.profile.monthlySalary !== null &&
            record.profile.monthlySalary !== undefined
          ? String(record.profile.monthlySalary)
          : '',
    );
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

  async function loadDocuments() {
    const response = await listEmployeeDocuments(userId);
    setDocuments(response.documents);
  }

  async function loadDtr() {
    const range = defaultDtrRange();
    setDtrRange(range);
    const overview = await getDtrOverview({
      ...range,
      userId,
    });
    const employeeOverview = overview.employees[0];
    setDtrRecords(employeeOverview?.records ?? []);
  }

  useEffect(() => {
    if (!session || !userId) {
      return;
    }

    void getTeamOverview()
      .then((overview) => {
        if (!canAccessEmployeeRecords(overview)) {
          router.replace('/dashboard');
          return;
        }

        setTeam(overview);
        return Promise.all([loadEmployee(), loadDocuments(), loadDtr()]);
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

  async function handleCompensationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCompensationLoading(true);

    try {
      const parsedAmount = payRateAmount.trim() ? Number(payRateAmount) : null;

      if (
        parsedAmount !== null &&
        (!Number.isFinite(parsedAmount) || parsedAmount < 0)
      ) {
        throw new Error('Pay rate must be zero or greater.');
      }

      await updateEmployeeCompensation(userId, {
        payRateType: parsedAmount === null ? null : payRateType,
        payRateAmount: parsedAmount,
      });
      await loadEmployee();
      toast.success('Compensation updated.');
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update compensation.',
      );
    } finally {
      setCompensationLoading(false);
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

  async function handleDocumentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!documentFile && !documentReferenceUrl.trim()) {
      toast.error('Upload a file or add a reference URL.');
      return;
    }

    setDocumentLoading(true);

    try {
      await createEmployeeDocument(userId, {
        title: documentTitle,
        category: documentCategory,
        notes: documentNotes || undefined,
        referenceUrl: documentReferenceUrl || undefined,
        file: documentFile,
      });
      setDocumentTitle('');
      setDocumentNotes('');
      setDocumentReferenceUrl('');
      setDocumentFile(null);
      if (documentFileInputRef.current) {
        documentFileInputRef.current.value = '';
      }
      await loadDocuments();
      toast.success('Document added.');
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to add document.',
      );
    } finally {
      setDocumentLoading(false);
    }
  }

  async function handleDownloadDocument(document: EmployeeDocument) {
    if (!document.hasFile || !document.fileName) {
      return;
    }

    setDownloadingDocumentId(document.id);

    try {
      await downloadEmployeeDocumentFile(
        userId,
        document.id,
        document.fileName,
      );
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to download file.',
      );
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setDeletingDocumentId(documentId);

    try {
      await deleteEmployeeDocument(userId, documentId);
      await loadDocuments();
      toast.success('Document removed.');
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to remove document.',
      );
    } finally {
      setDeletingDocumentId(null);
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
  const backHref = team.currentMember?.canInviteEmployees
    ? '/dashboard/employees'
    : '/dashboard/records';
  const backLabel = team.currentMember?.canInviteEmployees
    ? 'Employees'
    : 'Employee records';
  const dtrSummary = summarizeEmployeeDtr(dtrRecords);

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {employee.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{employee.email}</p>
      </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle icon={Briefcase}>Employment overview</SectionTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <BadgeCheck className="size-3.5" />
                Status
              </p>
              <p className="mt-2 font-medium text-foreground">
                {formatEmploymentType(employee.profile.employmentType)}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <Building2 className="size-3.5" />
                Branch
              </p>
              <p className="mt-2 font-medium text-foreground">
                {branch?.name ?? 'Unassigned'}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <FileText className="size-3.5" />
                Contract period
              </p>
              <p className="mt-2 font-medium text-foreground">
                {formatEmploymentPeriod(employee.profile)}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <Calendar className="size-3.5" />
                Hired
              </p>
              <p className="mt-2 font-medium text-foreground">
                {formatDateLabel(employee.profile.hireDate)}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                <Clock className="size-3.5" />
                Work schedule
              </p>
              <p className="mt-2 font-medium text-foreground">
                {formatWorkSchedule(employee.profile.workSchedule)}
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle icon={Clock}>Work schedule</SectionTitle>
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  <Plus className="size-4" />
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
                        <X className="size-3.5" />
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
              <Save className="size-4" />
              Save work schedule
            </LoadingButton>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle icon={UserRound}>Employment profile</SectionTitle>
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
              <Save className="size-4" />
              Save profile
            </LoadingButton>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle icon={Banknote}>Pay rate</SectionTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Set how this employee is paid — per hour or a fixed monthly amount.
            Used for payroll and holiday premium calculations.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleCompensationSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pay-rate-type">Rate type</Label>
                <Select
                  value={payRateType}
                  onValueChange={(value) =>
                    setPayRateType(value as PayRateType)
                  }
                >
                  <SelectTrigger id="pay-rate-type" className="w-full">
                    <SelectValue placeholder="Select rate type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_RATE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-rate-amount">
                  {payRateType === 'hourly'
                    ? 'Hourly rate (PHP)'
                    : 'Monthly rate (PHP)'}
                </Label>
                <Input
                  id="pay-rate-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={payRateAmount}
                  onChange={(event) => setPayRateAmount(event.target.value)}
                  placeholder={
                    payRateType === 'hourly' ? 'e.g. 85' : 'e.g. 25000'
                  }
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Leave the amount blank if pay rate is not set yet. Payroll will
              flag this employee.
            </p>

            <LoadingButton
              type="submit"
              loading={compensationLoading}
              loadingText="Saving…"
            >
              <Save className="size-4" />
              Save pay rate
            </LoadingButton>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionTitle icon={CalendarDays}>Leave balances</SectionTitle>
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
              <Save className="size-4" />
              Save leave balances
            </LoadingButton>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionTitle icon={ClipboardList}>Attendance history</SectionTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Daily time records for {dtrRange.startDate} to {dtrRange.endDate}.
              </p>
            </div>
            <Link
              href="/dashboard/dtr"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition hover:text-primary/80"
            >
              Open full DTR
              <ExternalLink className="size-3.5" />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Present</p>
              <p className="mt-2 font-semibold text-foreground">
                {dtrSummary.presentDays}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Complete</p>
              <p className="mt-2 font-semibold text-primary">
                {dtrSummary.completeDays}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Absent</p>
              <p className="mt-2 font-semibold text-muted-foreground">
                {dtrSummary.absentDays}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Incomplete</p>
              <p className="mt-2 font-semibold text-orange-400">
                {dtrSummary.incompleteDays}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Total hours</p>
              <p className="mt-2 font-semibold text-foreground">
                {formatWorkedMinutes(dtrSummary.totalMinutes)}
              </p>
            </article>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-border">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time in</th>
                  <th className="px-4 py-3 font-medium">Time out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dtrRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No attendance records for this period.
                    </td>
                  </tr>
                ) : (
                  [...dtrRecords].reverse().slice(0, 14).map((record) => (
                    <tr
                      key={record.date}
                      className="border-b border-border/70 last:border-b-0"
                    >
                      <td className="px-4 py-3 text-foreground">
                        {formatDtrDate(record.date)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {formatDtrTime(record.timeIn)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {formatDtrTime(record.timeOut)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {formatWorkedMinutes(record.workedMinutes)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${getDtrStatusClassName(record.status)}`}
                        >
                          {formatDtrStatus(record.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle icon={FileText}>Documents</SectionTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload files from your computer or add a reference link for
            documents stored elsewhere. Supported: PDF, PNG, JPG, WEBP, DOC,
            DOCX (max 10 MB).
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleDocumentSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm text-muted-foreground">Title</span>
                <Input
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  placeholder="Employment contract"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-muted-foreground">Category</span>
                <Select
                  value={documentCategory}
                  onValueChange={(value) =>
                    setDocumentCategory(value as DocumentCategory)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-muted-foreground">File (optional)</span>
              <input
                ref={documentFileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="flex h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:font-medium file:text-foreground"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setDocumentFile(nextFile);
                }}
              />
              {documentFile ? (
                <p className="text-xs text-muted-foreground">
                  Selected: {documentFile.name} ({formatFileSize(documentFile.size)})
                </p>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-muted-foreground">
                Reference URL (optional)
              </span>
              <Input
                value={documentReferenceUrl}
                onChange={(event) => setDocumentReferenceUrl(event.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-muted-foreground">Notes (optional)</span>
              <Textarea
                value={documentNotes}
                onChange={(event) => setDocumentNotes(event.target.value)}
                placeholder="Version, expiry date, or storage location"
                rows={3}
              />
            </label>

            <LoadingButton
              type="submit"
              loading={documentLoading}
              loadingText="Saving…"
            >
              <Plus className="size-4" />
              Add document
            </LoadingButton>
          </form>

          <div className="mt-8 space-y-3">
            {documents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No documents recorded yet.
              </p>
            ) : (
              documents.map((document) => (
                <article
                  key={document.id}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {document.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDocumentCategory(document.category)}
                        {' · Added '}
                        {formatDateLabel(document.createdAt.slice(0, 10))}
                        {document.fileSize
                          ? ` · ${formatFileSize(document.fileSize)}`
                          : ''}
                      </p>
                      {document.fileName ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          File: {document.fileName}
                        </p>
                      ) : null}
                      {document.notes ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {document.notes}
                        </p>
                      ) : null}
                      {document.referenceUrl ? (
                        <a
                          href={document.referenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary transition hover:text-primary/80"
                        >
                          Open reference
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : null}
                      {document.hasFile ? (
                        <LoadingButton
                          type="button"
                          variant="outline"
                          size="xs"
                          className="mt-2"
                          loading={downloadingDocumentId === document.id}
                          loadingText="Downloading…"
                          onClick={() => handleDownloadDocument(document)}
                          disabled={
                            downloadingDocumentId !== null &&
                            downloadingDocumentId !== document.id
                          }
                        >
                          <Download className="size-3.5" />
                          Download file
                        </LoadingButton>
                      ) : null}
                    </div>
                    <LoadingButton
                      type="button"
                      variant="destructive"
                      size="xs"
                      loading={deletingDocumentId === document.id}
                      loadingText="Removing…"
                      onClick={() => handleDeleteDocument(document.id)}
                      disabled={
                        deletingDocumentId !== null &&
                        deletingDocumentId !== document.id
                      }
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </LoadingButton>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <SectionTitle icon={CalendarDays}>Leave history</SectionTitle>
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
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
                        {formatDateLabel(request.startDate)}
                        <ArrowRight className="size-3.5 shrink-0" />
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

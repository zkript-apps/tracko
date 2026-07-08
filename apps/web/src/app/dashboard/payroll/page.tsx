'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
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
import { useSession } from '@/lib/auth-client';
import { isHrRole, isOrgAdminRole } from '@/lib/org-roles';
import {
  createPayrollRun,
  defaultPayrollRange,
  downloadPayrollCsv,
  formatMinutesAsHours,
  formatPayrollPeriod,
  formatPhp,
  getPayrollPreview,
  listPayrollRuns,
  type PayrollLineItem,
  type PayrollPreviewResponse,
  type PayrollRun,
} from '@/lib/payroll';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

const PAGE_SIZE = 15;

export default function PayrollPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [preview, setPreview] = useState<PayrollPreviewResponse | null>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [branchId, setBranchId] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [range, setRange] = useState(defaultPayrollRange);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!session) {
      return;
    }

    void getTeamOverview()
      .then((nextTeam) => {
        const role = nextTeam.currentMember?.role ?? 'member';
        const canView = isOrgAdminRole(role) || isHrRole(role);

        if (!canView) {
          router.replace('/dashboard');
          return;
        }

        setTeam(nextTeam);
        const defaultBranch =
          nextTeam.currentMember?.assignedBranchId ??
          nextTeam.branches.find((branch) => branch.isHeadOffice)?._id ??
          nextTeam.branches[0]?._id ??
          '';
        setBranchId(defaultBranch);

        return Promise.all([
          getPayrollPreview({
            ...defaultPayrollRange(),
            branchId: isOrgAdminRole(role) ? defaultBranch || undefined : undefined,
          }),
          listPayrollRuns(),
        ]);
      })
      .then((result) => {
        if (result) {
          setPreview(result[0]);
          setRuns(result[1].runs);
        }
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false));
  }, [router, session]);

  useEffect(() => {
    if (!team) {
      return;
    }

    setLoading(true);
    setError(null);
    setPage(1);

    void Promise.all([
      getPayrollPreview({
        startDate: range.startDate,
        endDate: range.endDate,
        branchId: isOrgAdminRole(team.currentMember?.role)
          ? branchId || undefined
          : undefined,
      }),
      listPayrollRuns(),
    ])
      .then(([nextPreview, nextRuns]) => {
        setPreview(nextPreview);
        setRuns(nextRuns.runs);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load payroll preview.',
        );
      })
      .finally(() => setLoading(false));
  }, [branchId, range.endDate, range.startDate, team]);

  useEffect(() => {
    setPage(1);
  }, [employeeFilter]);

  const filteredEntries = useMemo(() => {
    if (!preview) {
      return [];
    }

    const query = employeeFilter.trim().toLowerCase();
    if (!query) {
      return preview.entries;
    }

    return preview.entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.email.toLowerCase().includes(query),
    );
  }, [employeeFilter, preview]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));

  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEntries.slice(start, start + PAGE_SIZE);
  }, [filteredEntries, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handleSaveDraft() {
    if (!preview || !team) {
      return;
    }

    setSaving(true);
    try {
      const run = await createPayrollRun({
        startDate: preview.startDate,
        endDate: preview.endDate,
        branchId: isOrgAdminRole(team.currentMember?.role)
          ? branchId || undefined
          : undefined,
      });
      setRuns((current) => [run, ...current]);
      toast.success('Payroll draft saved.');
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save payroll draft.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!team || (loading && !preview)) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const isAdmin = isOrgAdminRole(team.currentMember?.role);
  const totals = preview?.totals;

  return (
    <div className="w-full space-y-8 px-4 py-8 lg:px-8 xl:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compute gross pay using Philippine Labor Code rates for overtime,
            holidays, and night differential (10 PM–6 AM).
          </p>
        </div>
        {preview ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadPayrollCsv(
                  filteredEntries,
                  preview.startDate,
                  preview.endDate,
                )
              }
              disabled={filteredEntries.length === 0}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={saving || filteredEntries.length === 0}
            >
              <Save className="size-4" />
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
          </div>
        ) : null}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="payroll-start">Period start</Label>
            <DateInput
              id="payroll-start"
              value={range.startDate}
              onChange={(event) =>
                setRange((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payroll-end">Period end</Label>
            <DateInput
              id="payroll-end"
              value={range.endDate}
              onChange={(event) =>
                setRange((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </div>
          {isAdmin ? (
            <div className="space-y-2">
              <Label htmlFor="payroll-branch">Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger id="payroll-branch" className="w-full">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {team.branches.map((branch) => (
                    <SelectItem key={branch._id} value={branch._id}>
                      {branch.name}
                      {branch.isHeadOffice ? ' (Head office)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="payroll-search">Search employees</Label>
            <Input
              id="payroll-search"
              placeholder="Name or email"
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
            />
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {totals ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Employees
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totals.employeeCount}
            </p>
            {totals.employeesMissingPayRate > 0 ? (
              <p className="mt-1 text-xs text-orange-400">
                {totals.employeesMissingPayRate} missing pay rate
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total gross pay
            </p>
            <p className="mt-2 text-2xl font-semibold text-primary">
              {formatPhp(totals.totalGrossPay)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Overtime pay
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatPhp(totals.totalOvertimePay)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Holiday pay
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatPhp(totals.totalHolidayPay)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Night differential
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatPhp(totals.totalNightDiffPay)}
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">Payroll preview</h2>
          {preview ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPayrollPeriod(preview.startDate, preview.endDate)}
            </p>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Present</th>
                <th className="px-4 py-3 font-medium">Leave</th>
                <th className="px-4 py-3 font-medium">Absent</th>
                <th className="px-4 py-3 font-medium">Holiday</th>
                <th className="px-4 py-3 font-medium">OT</th>
                <th className="px-4 py-3 font-medium">Regular</th>
                <th className="px-4 py-3 font-medium">OT pay</th>
                <th className="px-4 py-3 font-medium">Holiday pay</th>
                <th className="px-4 py-3 font-medium">Night diff</th>
                <th className="px-4 py-3 font-medium">Gross</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                    Loading payroll…
                  </td>
                </tr>
              ) : paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                    No employees match this period.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <PayrollRow key={entry.userId} entry={entry} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredEntries.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filteredEntries.length)} of{' '}
              {filteredEntries.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {runs.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">Recent payroll runs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved drafts and finalized runs for this organization.
          </p>
          <div className="mt-4 space-y-3">
            {runs.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {formatPayrollPeriod(run.periodStart, run.periodEnd)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPhp(run.totals.totalGrossPay)} ·{' '}
                    {run.totals.employeeCount} employees
                  </p>
                </div>
                <Badge
                  variant={run.status === 'finalized' ? 'default' : 'secondary'}
                >
                  {run.status}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PayrollRow({ entry }: { entry: PayrollLineItem }) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{entry.name}</p>
        <p className="text-xs text-muted-foreground">{entry.email}</p>
        {entry.warnings.length > 0 ? (
          <p className="mt-1 text-xs text-orange-400">{entry.warnings[0]}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {entry.payRate
          ? entry.payRate.type === 'hourly'
            ? `${formatPhp(entry.payRate.amount)}/hr`
            : `${formatPhp(entry.payRate.amount)}/mo`
          : '—'}
      </td>
      <td className="px-4 py-3 text-foreground">{entry.presentDays}</td>
      <td className="px-4 py-3 text-foreground">
        {entry.paidLeaveDays}
        {entry.unpaidLeaveDays > 0 ? (
          <span className="text-muted-foreground">
            {' '}
            (+{entry.unpaidLeaveDays} unpaid)
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-foreground">{entry.absentDays}</td>
      <td className="px-4 py-3 text-foreground">{entry.holidayDays}</td>
      <td className="px-4 py-3 text-foreground">
        {formatMinutesAsHours(entry.overtimeMinutes)}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatPhp(entry.regularPay)}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatPhp(entry.overtimePay)}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatPhp(entry.holidayPay)}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatPhp(entry.nightDiffPay)}
      </td>
      <td className="px-4 py-3 font-medium text-primary">
        {formatPhp(entry.grossPay)}
      </td>
    </tr>
  );
}

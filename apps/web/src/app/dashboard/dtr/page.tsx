'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
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
  defaultDtrRange,
  downloadDtrCsv,
  formatDtrDate,
  formatDtrStatus,
  formatDtrTime,
  formatWorkedMinutes,
  getDtrOverview,
  getDtrStatusClassName,
  summarizeEmployeeDtr,
  type DtrEmployeeOverview,
  type DtrOverviewResponse,
} from '@/lib/dtr';
import { isHrRole, isOrgAdminRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 15;

function EmployeeDtrDetailTable({
  employee,
}: {
  employee: DtrEmployeeOverview;
}) {
  const summary = summarizeEmployeeDtr(employee.records);

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="whitespace-nowrap text-xs text-muted-foreground">Present</p>
          <p className="mt-1 font-semibold text-foreground">
            {summary.presentDays}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="whitespace-nowrap text-xs text-muted-foreground">Complete</p>
          <p className="mt-1 font-semibold text-primary">
            {summary.completeDays}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="whitespace-nowrap text-xs text-muted-foreground">Day off</p>
          <p className="mt-1 font-semibold text-sky-400">
            {summary.dayOffDays}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="whitespace-nowrap text-xs text-muted-foreground">Incomplete</p>
          <p className="mt-1 font-semibold text-orange-400">
            {summary.incompleteDays}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="whitespace-nowrap text-xs text-muted-foreground">Absent</p>
          <p className="mt-1 font-semibold text-muted-foreground">
            {summary.absentDays}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left text-muted-foreground">
              <th className="whitespace-nowrap px-4 py-3 font-medium">Date</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Time in</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Time out</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Hours</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {[...employee.records].reverse().map((record) => (
              <tr
                key={record.date}
                className="border-b border-border/60 last:border-0"
              >
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  {formatDtrDate(record.date)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatDtrTime(record.timeIn)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatDtrTime(record.timeOut)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground">
                  {record.workedMinutes > 0
                    ? formatWorkedMinutes(record.workedMinutes)
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge
                    variant="secondary"
                    className={cn(getDtrStatusClassName(record.status), 'whitespace-nowrap')}
                  >
                    {formatDtrStatus(record.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DtrPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [overview, setOverview] = useState<DtrOverviewResponse | null>(null);
  const [branchId, setBranchId] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [range, setRange] = useState(defaultDtrRange);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] =
    useState<DtrEmployeeOverview | null>(null);

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
          nextTeam.branches[0]?._id ??
          '';
        setBranchId(defaultBranch);

        return getDtrOverview({
          ...defaultDtrRange(),
          branchId: isOrgAdminRole(role) ? defaultBranch || undefined : undefined,
        });
      })
      .then((nextOverview) => {
        if (nextOverview) {
          setOverview(nextOverview);
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
    setSelectedEmployee(null);

    void getDtrOverview({
      startDate: range.startDate,
      endDate: range.endDate,
      branchId: isOrgAdminRole(team.currentMember?.role)
        ? branchId || undefined
        : undefined,
    })
      .then(setOverview)
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load DTR.',
        );
      })
      .finally(() => setLoading(false));
  }, [branchId, range.endDate, range.startDate, team]);

  useEffect(() => {
    setPage(1);
  }, [employeeFilter]);

  const filteredEmployees = useMemo(() => {
    if (!overview) {
      return [];
    }

    const query = employeeFilter.trim().toLowerCase();
    if (!query) {
      return overview.employees;
    }

    return overview.employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query),
    );
  }, [employeeFilter, overview]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));

  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const totals = useMemo(() => {
    if (!overview) {
      return { employees: 0, completeDays: 0, totalMinutes: 0 };
    }

    let completeDays = 0;
    let totalMinutes = 0;

    for (const employee of overview.employees) {
      for (const record of employee.records) {
        if (record.status === 'complete') {
          completeDays += 1;
        }
        totalMinutes += record.workedMinutes;
      }
    }

    return {
      employees: overview.employees.length,
      completeDays,
      totalMinutes,
    };
  }, [overview]);

  if (!team || (loading && !overview)) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const isAdmin = isOrgAdminRole(team.currentMember?.role);
  const rangeLabel = overview
    ? `${overview.startDate} → ${overview.endDate}`
    : '';

  return (
    <div className="w-full space-y-8 px-4 py-8 lg:px-8 xl:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Daily time records
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Summaries built from clock in/out events for payroll review.
          </p>
        </div>
        {overview ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadDtrCsv(
                filteredEmployees,
                overview.startDate,
                overview.endDate,
              )
            }
            disabled={filteredEmployees.length === 0}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="dtr-from">From</Label>
          <DateInput
            id="dtr-from"
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
          <Label htmlFor="dtr-to">To</Label>
          <DateInput
            id="dtr-to"
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
            <Label htmlFor="dtr-branch">Branch</Label>
            <Select
              value={branchId || 'all'}
              onValueChange={(value) =>
                setBranchId(value === 'all' ? '' : value)
              }
            >
              <SelectTrigger id="dtr-branch" className="w-full">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
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
          <Label htmlFor="dtr-search">Search employee</Label>
          <Input
            id="dtr-search"
            type="search"
            placeholder="Name or email"
            value={employeeFilter}
            onChange={(event) => setEmployeeFilter(event.target.value)}
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Employees</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {totals.employees}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Complete days</p>
          <p className="mt-2 text-3xl font-semibold text-primary">
            {totals.completeDays}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total hours logged</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {formatWorkedMinutes(totals.totalMinutes)}
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-medium text-foreground">Employee summary</h2>
            <p className="text-sm text-muted-foreground">
              Click a row to view daily records · {rangeLabel}
            </p>
          </div>
          {filteredEmployees.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filteredEmployees.length)} of{' '}
              {filteredEmployees.length}
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No employees found for this period.
          </p>
        ) : (
          <>
            <div className="w-full">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-left text-muted-foreground">
                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Employee
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Present
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Complete
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Incomplete
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Day off
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Absent
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">
                      Total hours
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEmployees.map((employee) => {
                    const summary = summarizeEmployeeDtr(employee.records);

                    return (
                      <tr
                        key={employee.userId}
                        className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                        onClick={() => setSelectedEmployee(employee)}
                      >
                        <td className="px-5 py-3">
                          <p className="whitespace-nowrap font-medium text-foreground">
                            {employee.name}
                          </p>
                          {employee.email ? (
                            <p className="whitespace-nowrap text-xs text-muted-foreground">
                              {employee.email}
                            </p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-foreground">
                          {summary.presentDays}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-primary">
                          {summary.completeDays}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-orange-400">
                          {summary.incompleteDays}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-sky-400">
                          {summary.dayOffDays}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                          {summary.absentDays}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-medium text-foreground">
                          {formatWorkedMinutes(summary.totalMinutes)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Sheet
        open={selectedEmployee !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEmployee(null);
          }
        }}
      >
        <SheetContent
          className="gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-none"
          style={{ width: 'min(960px, 92vw)', maxWidth: '92vw' }}
        >
          {selectedEmployee ? (
            <>
              <SheetHeader className="border-b border-border px-6 pb-4 pt-4">
                <SheetTitle>{selectedEmployee.name}</SheetTitle>
                <SheetDescription>
                  {selectedEmployee.email ? `${selectedEmployee.email} · ` : ''}
                  {rangeLabel} ·{' '}
                  {formatWorkedMinutes(
                    summarizeEmployeeDtr(selectedEmployee.records).totalMinutes,
                  )}{' '}
                  total
                </SheetDescription>
              </SheetHeader>
              <div className="min-w-0 w-full px-6 pt-6 pb-6">
                <EmployeeDtrDetailTable employee={selectedEmployee} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

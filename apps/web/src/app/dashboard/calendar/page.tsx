'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
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
  PH_STATUTORY_PAY_RULES,
  STATUTORY_HOLIDAY_TYPES,
  buildCalendarDays,
  createHoliday,
  deleteHoliday,
  formatHolidayType,
  formatMonthLabel,
  getMonthBounds,
  getPhilippinesPublicHolidays,
  listHolidays,
  updateHoliday,
  type Holiday,
  type PhilippinesPublicHoliday,
  type StatutoryHolidayType,
} from '@/lib/holidays';
import { isHrRole, isOrgAdminRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getHeadOfficeBranchId(team: TeamOverview): string {
  return (
    team.branches.find((branch) => branch.isHeadOffice)?._id ??
    team.branches[0]?._id ??
    ''
  );
}

function formatBranchName(branch: TeamOverview['branches'][number]): string {
  return `${branch.name}${branch.isHeadOffice ? ' (Head office)' : ''}${
    branch.city ? ` — ${branch.city}` : ''}`;
}

function resolveHolidayForDate(
  holidays: Holiday[],
  date: string,
  branchId: string,
): Holiday | undefined {
  const matches = holidays.filter((holiday) => holiday.date === date);
  return (
    matches.find((holiday) => holiday.branchId === branchId) ??
    matches.find((holiday) => !holiday.branchId)
  );
}

export default function HolidaysPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PhilippinesPublicHoliday[]>([]);
  const [publicHolidaysLoading, setPublicHolidaysLoading] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [holidayType, setHolidayType] =
    useState<StatutoryHolidayType>('regular');
  const [scopeBranchId, setScopeBranchId] = useState<string>('org');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarYear, calendarMonth),
    [calendarMonth, calendarYear],
  );

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const day of calendarDays) {
      if (!day.date) {
        continue;
      }
      const holiday = resolveHolidayForDate(holidays, day.date, branchId);
      if (holiday) {
        map.set(day.date, holiday);
      }
    }
    return map;
  }, [branchId, calendarDays, holidays]);

  const publicHolidayMap = useMemo(() => {
    const map = new Map<string, PhilippinesPublicHoliday>();
    for (const holiday of publicHolidays) {
      map.set(holiday.date, holiday);
    }
    return map;
  }, [publicHolidays]);

  const monthPublicHolidays = useMemo(() => {
    const { startDate, endDate } = getMonthBounds(calendarYear, calendarMonth);
    return publicHolidays.filter(
      (holiday) => holiday.date >= startDate && holiday.date <= endDate,
    );
  }, [calendarMonth, calendarYear, publicHolidays]);

  const configuredDates = useMemo(
    () =>
      new Set(
        holidays
          .filter(
            (holiday) =>
              !holiday.branchId || holiday.branchId === branchId,
          )
          .map((holiday) => holiday.date),
      ),
    [branchId, holidays],
  );

  async function loadHolidays(
    nextTeam: TeamOverview,
    nextBranchId: string,
    year: number,
    month: number,
  ) {
    const bounds = getMonthBounds(year, month);
    const response = await listHolidays({
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      branchId: isOrgAdminRole(nextTeam.currentMember?.role)
        ? nextBranchId || undefined
        : undefined,
    });
    setHolidays(response.holidays);
  }

  async function loadPublicHolidays(year: number) {
    setPublicHolidaysLoading(true);
    try {
      const response = await getPhilippinesPublicHolidays(year);
      setPublicHolidays(response.holidays);
    } catch (error) {
      setPublicHolidays([]);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to load Philippines public holidays.',
      );
    } finally {
      setPublicHolidaysLoading(false);
    }
  }

  useEffect(() => {
    if (!session) {
      return;
    }

    void getTeamOverview()
      .then((overview) => {
        const role = overview.currentMember?.role ?? 'member';
        const canView = isOrgAdminRole(role) || isHrRole(role);

        if (!canView) {
          router.replace('/dashboard');
          return;
        }

        setTeam(overview);
        const defaultBranchId = isOrgAdminRole(role)
          ? getHeadOfficeBranchId(overview)
          : overview.currentMember?.assignedBranchId ??
            getHeadOfficeBranchId(overview);
        setBranchId(defaultBranchId);
        void loadPublicHolidays(calendarYear);
        return loadHolidays(
          overview,
          defaultBranchId,
          calendarYear,
          calendarMonth,
        );
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false));
  }, [calendarMonth, calendarYear, router, session]);

  useEffect(() => {
    if (!team) {
      return;
    }

    void loadPublicHolidays(calendarYear);
  }, [calendarYear, team]);

  useEffect(() => {
    if (!team || !branchId) {
      return;
    }

    setLoading(true);
    void loadHolidays(team, branchId, calendarYear, calendarMonth)
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : 'Unable to load holidays.',
        );
      })
      .finally(() => setLoading(false));
  }, [branchId, calendarMonth, calendarYear, team]);

  function openHolidaySheet(date: string) {
    const holiday = resolveHolidayForDate(holidays, date, branchId) ?? null;
    const publicHoliday = publicHolidayMap.get(date) ?? null;
    setSelectedDate(date);
    setSelectedHoliday(holiday);
    setName(
      holiday?.name ??
        publicHoliday?.localName ??
        publicHoliday?.name ??
        '',
    );
    setHolidayType(
      holiday?.holidayType ??
        publicHoliday?.holidayType ??
        'special_non_working',
    );
    setScopeBranchId(holiday?.branchId ?? 'org');
    setSheetOpen(true);
  }

  function shiftMonth(delta: number) {
    const next = new Date(calendarYear, calendarMonth + delta, 1);
    setCalendarMonth(next.getMonth());
    setCalendarYear(next.getFullYear());
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDate || !team) {
      return;
    }

    setSaving(true);
    try {
      const holidayBranchId =
        isOrgAdminRole(team.currentMember?.role) && scopeBranchId !== 'org'
          ? scopeBranchId
          : null;

      if (selectedHoliday) {
        await updateHoliday(selectedHoliday.id, {
          name,
          holidayType,
          branchId: holidayBranchId,
        });
        toast.success('Holiday updated.');
      } else {
        await createHoliday({
          date: selectedDate,
          name,
          holidayType,
          branchId: holidayBranchId,
        });
        toast.success('Holiday created.');
      }

      await loadHolidays(team, branchId, calendarYear, calendarMonth);
      setSheetOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to save holiday.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedHoliday || !team) {
      return;
    }

    setDeleting(true);
    try {
      await deleteHoliday(selectedHoliday.id);
      await loadHolidays(team, branchId, calendarYear, calendarMonth);
      setSheetOpen(false);
      toast.success('Holiday removed.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to delete holiday.',
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!team) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const isAdmin = isOrgAdminRole(team.currentMember?.role);

  return (
    <div className="w-full space-y-8 px-4 py-8 lg:px-8 xl:px-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Philippines public holidays are loaded automatically. Add pay rules for
          the dates your organization observes.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="min-w-[10rem] text-center text-lg font-semibold text-foreground">
              {formatMonthLabel(calendarYear, calendarMonth)}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {isAdmin ? (
            <div className="min-w-[16rem] flex-1 space-y-2 sm:max-w-md">
              <Label htmlFor="holiday-branch">View holidays for</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger id="holiday-branch" className="w-full">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {team.branches.map((branch) => (
                    <SelectItem key={branch._id} value={branch._id}>
                      {formatBranchName(branch)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((cell, index) => {
            if (!cell.date || !cell.day) {
              return <div key={`empty-${index}`} className="min-h-24" />;
            }

            const holiday = holidayMap.get(cell.date);
            const publicHoliday = publicHolidayMap.get(cell.date);

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => openHolidaySheet(cell.date!)}
                className={cn(
                  'min-h-24 rounded-xl border p-2 text-left transition hover:border-primary/40',
                  holiday
                    ? 'border-primary/30 bg-primary/10'
                    : publicHoliday
                      ? 'border-sky-500/30 bg-sky-500/10'
                      : 'border-border bg-muted/20',
                )}
              >
                <span className="text-sm font-medium text-foreground">
                  {cell.day}
                </span>
                {holiday ? (
                  <div className="mt-2 space-y-1">
                    <p className="line-clamp-2 text-xs font-medium text-primary">
                      {holiday.name}
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      {formatHolidayType(holiday.holidayType)}
                    </Badge>
                  </div>
                ) : publicHoliday ? (
                  <div className="mt-2 space-y-1">
                    <p className="line-clamp-2 text-xs font-medium text-sky-400">
                      {publicHoliday.localName}
                    </p>
                    <Badge
                      variant="secondary"
                      className="border-sky-500/20 bg-sky-500/10 text-[10px] text-sky-300"
                    >
                      PH public holiday
                    </Badge>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {loading || publicHolidaysLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading holidays…</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded border border-sky-500/30 bg-sky-500/10" />
            Philippines public holiday
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded border border-primary/30 bg-primary/10" />
            Pay rule configured (PH Labor Code)
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">
              Philippines public holidays · {calendarYear}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sourced from Nager.Date. Statutory pay rates apply automatically in payroll.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {publicHolidays.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {publicHolidaysLoading
                ? 'Loading public holidays…'
                : 'No public holidays found for this year.'}
            </p>
          ) : (
            publicHolidays.map((holiday) => {
              const isConfigured = configuredDates.has(holiday.date);
              const inCurrentMonth = monthPublicHolidays.some(
                (item) => item.date === holiday.date,
              );

              return (
                <button
                  key={holiday.date}
                  type="button"
                  onClick={() => openHolidaySheet(holiday.date)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition hover:border-primary/40',
                    isConfigured
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border bg-muted/20',
                    !inCurrentMonth && 'opacity-70',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {holiday.localName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {holiday.name} ·{' '}
                      {new Date(`${holiday.date}T00:00:00`).toLocaleDateString(
                        'en-PH',
                        {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        },
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={isConfigured ? 'default' : 'secondary'}
                    className={cn(
                      'shrink-0',
                      !isConfigured &&
                        'border-sky-500/20 bg-sky-500/10 text-sky-300',
                    )}
                  >
                    {isConfigured ? 'Configured' : formatHolidayType(holiday.holidayType)}
                  </Badge>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">
          Philippine statutory pay rules
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Payroll uses these mandated rates from the Labor Code. Hourly rate is
          daily rate ÷ 8.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PH_STATUTORY_PAY_RULES.map((rule) => (
            <div
              key={rule.title}
              className="rounded-xl border border-border bg-muted/20 p-4 text-sm"
            >
              <p className="font-medium text-foreground">{rule.title}</p>
              <p className="mt-1 text-muted-foreground">{rule.description}</p>
            </div>
          ))}
        </div>
      </section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-6 pb-4 pt-4 pr-12">
            <SheetTitle>
              {selectedHoliday ? 'Edit holiday/event' : 'Add holiday/event'}
            </SheetTitle>
            <SheetDescription>
              {selectedDate
                ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                    'en-PH',
                    {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    },
                  )
                : ''}
            </SheetDescription>
          </SheetHeader>

          <form
            className="space-y-4 px-6 pt-6 pb-6"
            onSubmit={handleSave}
          >
            {selectedDate && publicHolidayMap.get(selectedDate) && !selectedHoliday ? (
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-300">
                Philippines public holiday:{' '}
                <span className="font-medium text-foreground">
                  {publicHolidayMap.get(selectedDate)?.localName}
                </span>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="holiday-name">Holiday name</Label>
              <Input
                id="holiday-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Independence Day"
              />
            </div>

            {isAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="holiday-scope">Applies to</Label>
                <Select value={scopeBranchId} onValueChange={setScopeBranchId}>
                  <SelectTrigger id="holiday-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org">All branches</SelectItem>
                    {team.branches.map((branch) => (
                      <SelectItem key={branch._id} value={branch._id}>
                        {formatBranchName(branch)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="holiday-type">Holiday type</Label>
              <Select
                value={holidayType}
                onValueChange={(value) =>
                  setHolidayType(value as StatutoryHolidayType)
                }
              >
                <SelectTrigger id="holiday-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUTORY_HOLIDAY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {
                  STATUTORY_HOLIDAY_TYPES.find(
                    (type) => type.value === holidayType,
                  )?.description
                }
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <LoadingButton type="submit" loading={saving} loadingText="Saving…">
                {selectedHoliday ? 'Update holiday/event' : 'Save holiday/event'}
              </LoadingButton>
              {selectedHoliday ? (
                <LoadingButton
                  type="button"
                  variant="destructive"
                  loading={deleting}
                  loadingText="Deleting…"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="size-4" />
                  Delete
                </LoadingButton>
              ) : null}
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

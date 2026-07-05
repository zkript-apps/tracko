import { apiFetch } from './api';

export type DtrStatus =
  | 'complete'
  | 'in_progress'
  | 'incomplete'
  | 'absent'
  | 'day_off';

export type DtrSegment = {
  timeIn: string;
  timeOut: string | null;
  workedMinutes: number;
};

export type DailyTimeRecord = {
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  workedMinutes: number;
  status: DtrStatus;
  segments: DtrSegment[];
};

export type MyDtrResponse = {
  startDate: string;
  endDate: string;
  records: DailyTimeRecord[];
};

export type DtrEmployeeOverview = {
  userId: string;
  name: string;
  email: string;
  records: DailyTimeRecord[];
};

export type DtrOverviewResponse = {
  startDate: string;
  endDate: string;
  branchId: string | null;
  employees: DtrEmployeeOverview[];
};

export function defaultDtrRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const year = end.getFullYear();
  const month = String(end.getMonth() + 1).padStart(2, '0');
  const day = String(end.getDate()).padStart(2, '0');
  const endDate = `${year}-${month}-${day}`;
  const startDate = `${year}-${month}-01`;
  return { startDate, endDate };
}

export async function getMyDtrRecords(input?: {
  startDate?: string;
  endDate?: string;
}): Promise<MyDtrResponse> {
  const params = new URLSearchParams();
  if (input?.startDate) {
    params.set('startDate', input.startDate);
  }
  if (input?.endDate) {
    params.set('endDate', input.endDate);
  }

  const query = params.toString();
  return apiFetch(`/dtr/me${query ? `?${query}` : ''}`);
}

export async function getDtrOverview(input?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  userId?: string;
}): Promise<DtrOverviewResponse> {
  const params = new URLSearchParams();
  if (input?.startDate) {
    params.set('startDate', input.startDate);
  }
  if (input?.endDate) {
    params.set('endDate', input.endDate);
  }
  if (input?.branchId) {
    params.set('branchId', input.branchId);
  }
  if (input?.userId) {
    params.set('userId', input.userId);
  }

  const query = params.toString();
  return apiFetch(`/dtr/overview${query ? `?${query}` : ''}`);
}

export function formatDtrTime(iso: string | null): string {
  if (!iso) {
    return '—';
  }

  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDtrDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatWorkedMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, '0')}m`;
}

export function formatDtrStatus(status: DtrStatus): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'in_progress':
      return 'In progress';
    case 'incomplete':
      return 'Incomplete';
    case 'absent':
      return 'Absent';
    case 'day_off':
      return 'Day off';
  }
}

export function getDtrStatusClassName(status: DtrStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-primary/15 text-primary';
    case 'in_progress':
      return 'bg-yellow-500/15 text-yellow-400';
    case 'incomplete':
      return 'bg-orange-500/15 text-orange-400';
    case 'absent':
      return 'bg-muted text-muted-foreground';
    case 'day_off':
      return 'bg-sky-500/15 text-sky-400';
  }
}

export function sumWorkedMinutes(records: DailyTimeRecord[]): number {
  return records.reduce((total, record) => total + record.workedMinutes, 0);
}

export type EmployeeDtrSummary = {
  presentDays: number;
  completeDays: number;
  incompleteDays: number;
  absentDays: number;
  dayOffDays: number;
  inProgressDays: number;
  totalMinutes: number;
};

export function summarizeEmployeeDtr(
  records: DailyTimeRecord[],
): EmployeeDtrSummary {
  let presentDays = 0;
  let completeDays = 0;
  let incompleteDays = 0;
  let absentDays = 0;
  let dayOffDays = 0;
  let inProgressDays = 0;

  for (const record of records) {
    switch (record.status) {
      case 'complete':
        completeDays += 1;
        presentDays += 1;
        break;
      case 'in_progress':
        inProgressDays += 1;
        presentDays += 1;
        break;
      case 'incomplete':
        incompleteDays += 1;
        presentDays += 1;
        break;
      case 'absent':
        absentDays += 1;
        break;
      case 'day_off':
        dayOffDays += 1;
        break;
    }
  }

  return {
    presentDays,
    completeDays,
    incompleteDays,
    absentDays,
    dayOffDays,
    inProgressDays,
    totalMinutes: sumWorkedMinutes(records),
  };
}

export function downloadDtrCsv(
  employees: DtrEmployeeOverview[],
  startDate: string,
  endDate: string,
): void {
  const headers = [
    'Employee',
    'Email',
    'Date',
    'Time in',
    'Time out',
    'Hours worked',
    'Status',
  ];

  const rows = employees.flatMap((employee) =>
    employee.records.map((record) => [
      employee.name,
      employee.email,
      record.date,
      record.timeIn ? formatDtrTime(record.timeIn) : '',
      record.timeOut ? formatDtrTime(record.timeOut) : '',
      formatWorkedMinutes(record.workedMinutes),
      formatDtrStatus(record.status),
    ]),
  );

  const escape = (value: string) =>
    `"${value.replace(/"/g, '""')}"`;

  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dtr-${startDate}-to-${endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

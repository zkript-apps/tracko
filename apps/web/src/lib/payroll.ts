import { apiFetch } from './api';
import { defaultDtrRange } from './dtr';

export type PayrollLineItem = {
  userId: string;
  name: string;
  email: string;
  payRate: { type: 'hourly' | 'monthly'; amount: number } | null;
  scheduledWorkDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  dayOffDays: number;
  holidayDays: number;
  regularMinutes: number;
  overtimeMinutes: number;
  dailyRate: number | null;
  hourlyRate: number | null;
  regularPay: number;
  overtimePay: number;
  holidayPay: number;
  nightDiffPay: number;
  absentDeduction: number;
  grossPay: number;
  warnings: string[];
};

export type PayrollTotals = {
  employeeCount: number;
  totalGrossPay: number;
  totalRegularPay: number;
  totalOvertimePay: number;
  totalHolidayPay: number;
  totalNightDiffPay: number;
  totalAbsentDeduction: number;
  employeesMissingPayRate: number;
};

export type PayrollPreviewResponse = {
  startDate: string;
  endDate: string;
  branchId: string | null;
  entries: PayrollLineItem[];
  totals: PayrollTotals;
};

export type PayrollRun = {
  id: string;
  organizationId: string;
  branchId: string | null;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'finalized';
  entries: PayrollLineItem[];
  totals: PayrollTotals;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  finalizedBy: string | null;
};

export function defaultPayrollRange() {
  return defaultDtrRange();
}

export async function getPayrollPreview(input: {
  startDate: string;
  endDate: string;
  branchId?: string;
}): Promise<PayrollPreviewResponse> {
  const params = new URLSearchParams({
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (input.branchId) {
    params.set('branchId', input.branchId);
  }

  return apiFetch(`/payroll/preview?${params.toString()}`);
}

export async function listPayrollRuns(): Promise<{ runs: PayrollRun[] }> {
  return apiFetch('/payroll/runs');
}

export async function getPayrollRun(id: string): Promise<PayrollRun> {
  return apiFetch(`/payroll/runs/${encodeURIComponent(id)}`);
}

export async function createPayrollRun(input: {
  startDate: string;
  endDate: string;
  branchId?: string;
}): Promise<PayrollRun> {
  return apiFetch('/payroll/runs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function finalizePayrollRun(id: string): Promise<PayrollRun> {
  return apiFetch(`/payroll/runs/${encodeURIComponent(id)}/finalize`, {
    method: 'POST',
  });
}

export function formatPhp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '—';
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPayrollPeriod(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const end = new Date(`${endDate}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${start} – ${end}`;
}

export function formatMinutesAsHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${remainder}m`;
  }
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainder}m`;
}

export function downloadPayrollCsv(
  entries: PayrollLineItem[],
  startDate: string,
  endDate: string,
) {
  const headers = [
    'Employee',
    'Email',
    'Pay rate',
    'Scheduled days',
    'Present',
    'Paid leave',
    'Unpaid leave',
    'Absent',
    'Holiday days',
    'Regular hours',
    'Overtime hours',
    'Regular pay',
    'Overtime pay',
    'Holiday pay',
    'Night differential',
    'Absent deduction',
    'Gross pay',
    'Warnings',
  ];

  const rows = entries.map((entry) => [
    entry.name,
    entry.email,
    entry.payRate
      ? entry.payRate.type === 'hourly'
        ? `${entry.payRate.amount}/hr`
        : `${entry.payRate.amount}/mo`
      : '',
    entry.scheduledWorkDays,
    entry.presentDays,
    entry.paidLeaveDays,
    entry.unpaidLeaveDays,
    entry.absentDays,
    entry.holidayDays,
    (entry.regularMinutes / 60).toFixed(2),
    (entry.overtimeMinutes / 60).toFixed(2),
    entry.regularPay.toFixed(2),
    entry.overtimePay.toFixed(2),
    entry.holidayPay.toFixed(2),
    entry.nightDiffPay.toFixed(2),
    entry.absentDeduction.toFixed(2),
    entry.grossPay.toFixed(2),
    entry.warnings.join('; '),
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payroll-${startDate}-to-${endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

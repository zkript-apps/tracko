import { apiFetch, apiUpload, apiUrl } from './api';
import type { LeaveRequest } from './leave';

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full time' },
  { value: 'contractual', label: 'Contractual' },
  { value: 'intern', label: 'Intern / OJT' },
  { value: 'probation', label: 'Probation' },
] as const;

export const PAY_RATE_TYPES = [
  { value: 'hourly', label: 'Per hour' },
  { value: 'monthly', label: 'Fixed per month' },
] as const;

export type PayRateType = (typeof PAY_RATE_TYPES)[number]['value'];

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]['value'];

export type WorkSchedule = {
  weeklyRestDays: number[];
  workStartTime: string;
  workEndTime: string;
  extraDayOffDates: string[];
};

export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const;

export type PayRate = {
  type: PayRateType;
  amount: number;
} | null;

export type EmployeeProfile = {
  userId: string;
  memberId: string;
  branchId: string;
  employmentType: EmploymentType;
  jobTitle: string | null;
  hireDate: string;
  contractStartDate: string;
  contractEndDate: string | null;
  probationEndDate: string | null;
  notes: string | null;
  workSchedule: WorkSchedule;
  payRate: PayRate;
  monthlySalary: number | null;
  updatedAt: string;
};

export type LeaveBalance = {
  leaveType: string;
  periodYear: number;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
};

export type EmployeeRecord = {
  userId: string;
  memberId: string;
  name: string;
  email: string;
  branchId: string;
  profile: EmployeeProfile;
  leaveBalances: LeaveBalance[];
};

export type EmployeeDetail = EmployeeRecord & {
  periodYear: number;
  leaveHistory: LeaveRequest[];
};

export const DOCUMENT_CATEGORIES = [
  { value: 'contract', label: 'Contract' },
  { value: 'government_id', label: 'Government ID' },
  { value: 'clearance', label: 'Clearance' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]['value'];

export type EmployeeDocument = {
  id: string;
  userId: string;
  title: string;
  category: DocumentCategory;
  notes: string | null;
  referenceUrl: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  hasFile: boolean;
  createdBy: string;
  createdAt: string;
};

export async function listEmployeeRecords(
  periodYear?: number,
): Promise<{ periodYear: number; employees: EmployeeRecord[] }> {
  const query =
    periodYear !== undefined
      ? `?periodYear=${encodeURIComponent(String(periodYear))}`
      : '';
  return apiFetch(`/employees${query}`);
}

export async function getEmployeeRecord(
  userId: string,
  periodYear?: number,
): Promise<EmployeeDetail> {
  const query =
    periodYear !== undefined
      ? `?periodYear=${encodeURIComponent(String(periodYear))}`
      : '';
  return apiFetch(`/employees/${encodeURIComponent(userId)}${query}`);
}

export async function updateEmployeeProfile(
  userId: string,
  input: {
    employmentType?: EmploymentType;
    jobTitle?: string;
    hireDate?: string;
    contractStartDate?: string;
    contractEndDate?: string | null;
    probationEndDate?: string | null;
    notes?: string | null;
  },
): Promise<EmployeeProfile> {
  return apiFetch(`/employees/${encodeURIComponent(userId)}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function updateEmployeeLeaveBalances(
  userId: string,
  input: {
    periodYear?: number;
    balances: Array<{ leaveType: string; entitledDays: number }>;
  },
): Promise<{ periodYear: number; leaveBalances: LeaveBalance[] }> {
  return apiFetch(`/employees/${encodeURIComponent(userId)}/leave-balances`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function updateEmployeeWorkSchedule(
  userId: string,
  input: WorkSchedule,
): Promise<WorkSchedule> {
  return apiFetch(`/employees/${encodeURIComponent(userId)}/work-schedule`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function updateEmployeeCompensation(
  userId: string,
  input: {
    payRateType: PayRateType | null;
    payRateAmount: number | null;
  },
): Promise<EmployeeProfile> {
  return apiFetch(`/employees/${encodeURIComponent(userId)}/compensation`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function listEmployeeDocuments(
  userId: string,
): Promise<{ documents: EmployeeDocument[] }> {
  return apiFetch(`/employees/${encodeURIComponent(userId)}/documents`);
}

export async function createEmployeeDocument(
  userId: string,
  input: {
    title: string;
    category: DocumentCategory;
    notes?: string;
    referenceUrl?: string;
    file?: File | null;
  },
): Promise<EmployeeDocument> {
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('category', input.category);

  if (input.notes?.trim()) {
    formData.append('notes', input.notes.trim());
  }

  if (input.referenceUrl?.trim()) {
    formData.append('referenceUrl', input.referenceUrl.trim());
  }

  if (input.file) {
    formData.append('file', input.file);
  }

  return apiUpload(`/employees/${encodeURIComponent(userId)}/documents`, formData);
}

export async function downloadEmployeeDocumentFile(
  userId: string,
  documentId: string,
  fileName: string,
): Promise<void> {
  const response = await fetch(
    `${apiUrl}/employees/${encodeURIComponent(userId)}/documents/${encodeURIComponent(documentId)}/file`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = payload?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(', ')
        : message ?? 'Unable to download file.',
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function deleteEmployeeDocument(
  userId: string,
  documentId: string,
): Promise<{ success: boolean }> {
  return apiFetch(
    `/employees/${encodeURIComponent(userId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  );
}

export function formatDocumentCategory(category: string): string {
  return (
    DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label ??
    category
  );
}

export function formatWorkSchedule(schedule: WorkSchedule): string {
  const restLabels = schedule.weeklyRestDays
    .map(
      (day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label,
    )
    .filter(Boolean)
    .join(', ');

  return `${schedule.workStartTime}–${schedule.workEndTime} · Off: ${restLabels || 'None'}`;
}

export function formatWeekdayList(days: number[]): string {
  return days
    .map((day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label)
    .filter(Boolean)
    .join(', ');
}

export function formatEmploymentType(type: string): string {
  return EMPLOYMENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function formatEmploymentPeriod(profile: EmployeeProfile): string {
  const end = profile.contractEndDate ?? 'Present';
  return `${profile.contractStartDate} → ${end}`;
}

export function formatDateLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

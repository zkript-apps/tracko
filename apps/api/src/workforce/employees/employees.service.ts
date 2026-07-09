import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getMongoDb } from '../../database/mongo';
import {
  findAssignmentByUserId,
  listAssignmentsByOrganization,
} from '../../organizations/branch-assignments.store';
import { WorkforceContextService } from '../workforce-context.service';
import { BillingService } from '../../billing/billing.service';
import {
  createEmployeeProfile,
  EMPLOYMENT_TYPES,
  PAY_RATE_TYPES,
  findProfileByUserId,
  serializeEmployeeProfile,
  updateEmployeeProfile,
  updateEmployeeCompensation,
  updateEmployeeWorkSchedule,
  type EmploymentType,
  type PayRateType,
} from './employee-profiles.store';
import {
  BALANCE_LEAVE_TYPES,
  setEntitledDays,
  type BalanceLeaveType,
} from './leave-balances.store';
import { isValidDateString, todayDateString, countLeaveDays } from './leave-days.util';
import { prepareEmployeeLeaveBalances } from '../leave/leave-balance.context';
import { ensureLeavePolicy } from '../leave/leave-policy.store';
import { resolveLeavePeriod } from '../leave/leave-period.util';
import { resolveLeaveEligibility } from '../leave/leave-eligibility.util';
import {
  validateWorkScheduleInput,
  serializeWorkSchedule,
} from './work-schedule.util';
import {
  listLeaveRequestsForUser,
  type LeaveRequest as LeaveRequestRecord,
} from '../leave/leave.store';
import {
  createEmployeeDocument,
  deleteEmployeeDocument,
  DOCUMENT_CATEGORIES,
  findEmployeeDocument,
  listEmployeeDocuments as listStoredEmployeeDocuments,
  serializeEmployeeDocument,
  setEmployeeDocumentStoredFileName,
  type DocumentCategory,
} from './employee-documents.store';
import {
  createStoredFileName,
  deleteEmployeeDocumentFile,
  getEmployeeDocumentExtension,
  MAX_EMPLOYEE_DOCUMENT_BYTES,
  openEmployeeDocumentFile,
  saveEmployeeDocumentFile,
} from './employee-document-files.util';

function serializeLeaveHistoryItem(request: LeaveRequestRecord) {
  return {
    id: request._id,
    leaveType: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    status: request.status,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewNote: request.reviewNote ?? null,
    createdAt: request.createdAt.toISOString(),
    requestedDays: countLeaveDays(request.startDate, request.endDate),
  };
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly workforce: WorkforceContextService,
    private readonly billing: BillingService,
  ) {}

  private async requireManager(request: Request) {
    const context = await this.workforce.getMemberContext(request);

    if (!context.canManageLeave) {
      throw new ForbiddenException('HR or admin access required.');
    }

    return context;
  }

  private async loadUsers(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, { name?: string; email?: string }>();
    }

    const db = await getMongoDb();
    const users = await db
      .collection<{ _id: string; name?: string; email?: string }>('user')
      .find({ _id: { $in: userIds } })
      .toArray();

    return new Map(users.map((user) => [String(user._id), user]));
  }

  private async ensureEmployeeProfile(input: {
    organizationId: string;
    userId: string;
    memberId: string;
    branchId: string;
    updatedBy?: string;
  }) {
    const existing = await findProfileByUserId(
      input.organizationId,
      input.userId,
    );

    if (existing) {
      return existing;
    }

    const today = todayDateString();
    return createEmployeeProfile({
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      employmentType: 'probation',
      hireDate: today,
      contractStartDate: today,
      updatedBy: input.updatedBy,
    });
  }

  private assertEmployeeAccess(
    context: Awaited<ReturnType<WorkforceContextService['getMemberContext']>>,
    branchId: string,
  ) {
    if (context.isHr && context.branchId !== branchId) {
      throw new ForbiddenException('Employee is outside your branch.');
    }
  }

  private periodReferenceDate(periodYear: number): string {
    return `${periodYear}-12-31`;
  }

  private async buildEmployeeRecord(input: {
    organizationId: string;
    userId: string;
    memberId: string;
    branchId: string;
    periodYear: number;
    updatedBy?: string;
    userMap: Map<string, { name?: string; email?: string }>;
    leaveEnabled: boolean;
  }) {
    const profile = await this.ensureEmployeeProfile({
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId,
      branchId: input.branchId,
      updatedBy: input.updatedBy,
    });

    const balances = input.leaveEnabled
      ? (
          await prepareEmployeeLeaveBalances({
            organizationId: input.organizationId,
            userId: input.userId,
            memberId: input.memberId,
            branchId: input.branchId,
            referenceDate: this.periodReferenceDate(input.periodYear),
          })
        ).balances
      : [];

    const user = input.userMap.get(String(input.userId));

    return {
      userId: input.userId,
      memberId: input.memberId,
      name: user?.name ?? 'Employee',
      email: user?.email ?? '',
      branchId: input.branchId,
      profile: serializeEmployeeProfile(profile),
      leaveBalances: balances,
    };
  }

  async listEmployees(request: Request, periodYear?: number) {
    const context = await this.requireManager(request);
    const branchId = context.isHr ? context.branchId ?? undefined : undefined;
    const year = periodYear ?? new Date().getFullYear();

    const assignments = await listAssignmentsByOrganization(
      context.organizationId,
    );
    const employeeAssignments = assignments.filter(
      (assignment) =>
        assignment.role === 'employee' &&
        (!branchId || assignment.branchId === branchId),
    );

    const userMap = await this.loadUsers(
      employeeAssignments.map((assignment) => assignment.userId),
    );
    const leaveEnabled = await this.billing.isFeatureEnabled(
      context.organizationId,
      'leave',
    );

    const employees = await Promise.all(
      employeeAssignments.map((assignment) =>
        this.buildEmployeeRecord({
          organizationId: context.organizationId,
          userId: assignment.userId,
          memberId: assignment.memberId,
          branchId: assignment.branchId,
          periodYear: year,
          updatedBy: context.userId,
          userMap,
          leaveEnabled,
        }),
      ),
    );

    return { periodYear: year, employees };
  }

  async getEmployee(request: Request, userId: string, periodYear?: number) {
    const context = await this.requireManager(request);
    const year = periodYear ?? new Date().getFullYear();
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    const userMap = await this.loadUsers([userId]);
    const leaveEnabled = await this.billing.isFeatureEnabled(
      context.organizationId,
      'leave',
    );
    const leaveHistory = leaveEnabled
      ? await listLeaveRequestsForUser(context.organizationId, userId)
      : [];
    const profile = await findProfileByUserId(context.organizationId, userId);
    const policy = leaveEnabled
      ? await ensureLeavePolicy(context.organizationId)
      : null;
    const leaveEligibility =
      leaveEnabled && policy
        ? resolveLeaveEligibility({
            policy,
            hireDate: profile?.hireDate,
            asOfDate: todayDateString(),
          })
        : null;

    return {
      ...(await this.buildEmployeeRecord({
        organizationId: context.organizationId,
        userId,
        memberId: assignment.memberId,
        branchId: assignment.branchId,
        periodYear: year,
        updatedBy: context.userId,
        userMap,
        leaveEnabled,
      })),
      periodYear: year,
      leaveHistory: leaveHistory.map(serializeLeaveHistoryItem),
      leaveEligibility,
    };
  }

  async updateProfile(
    request: Request,
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
  ) {
    const context = await this.requireManager(request);
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    if (
      input.employmentType &&
      !EMPLOYMENT_TYPES.includes(input.employmentType)
    ) {
      throw new BadRequestException('Invalid employment type.');
    }

    for (const field of [
      input.hireDate,
      input.contractStartDate,
      input.contractEndDate ?? undefined,
      input.probationEndDate ?? undefined,
    ]) {
      if (field && !isValidDateString(field)) {
        throw new BadRequestException('Dates must use YYYY-MM-DD format.');
      }
    }

    await this.ensureEmployeeProfile({
      organizationId: context.organizationId,
      userId,
      memberId: assignment.memberId,
      branchId: assignment.branchId,
      updatedBy: context.userId,
    });

    const updated = await updateEmployeeProfile({
      organizationId: context.organizationId,
      userId,
      ...input,
      branchId: assignment.branchId,
      updatedBy: context.userId,
    });

    if (!updated) {
      throw new NotFoundException('Employee profile not found.');
    }

    return serializeEmployeeProfile(updated);
  }

  async updateWorkSchedule(
    request: Request,
    userId: string,
    input: {
      weeklyRestDays?: number[];
      workStartTime?: string;
      workEndTime?: string;
      extraDayOffDates?: string[];
    },
  ) {
    const context = await this.requireManager(request);
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    let schedule;
    try {
      schedule = validateWorkScheduleInput(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid work schedule.',
      );
    }

    await this.ensureEmployeeProfile({
      organizationId: context.organizationId,
      userId,
      memberId: assignment.memberId,
      branchId: assignment.branchId,
      updatedBy: context.userId,
    });

    const updated = await updateEmployeeWorkSchedule({
      organizationId: context.organizationId,
      userId,
      weeklyRestDays: schedule.weeklyRestDays,
      workStartTime: schedule.workStartTime,
      workEndTime: schedule.workEndTime,
      extraDayOffDates: schedule.extraDayOffDates,
      updatedBy: context.userId,
    });

    if (!updated) {
      throw new NotFoundException('Employee profile not found.');
    }

    return serializeWorkSchedule(schedule);
  }

  async updateCompensation(
    request: Request,
    userId: string,
    input: { payRateType: PayRateType | null; payRateAmount: number | null },
  ) {
    const context = await this.requireManager(request);
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    if (input.payRateType && !PAY_RATE_TYPES.includes(input.payRateType)) {
      throw new BadRequestException('Invalid pay rate type.');
    }

    if (
      input.payRateAmount !== null &&
      (!Number.isFinite(input.payRateAmount) || input.payRateAmount < 0)
    ) {
      throw new BadRequestException('Pay rate amount must be zero or greater.');
    }

    if (
      (input.payRateType && input.payRateAmount === null) ||
      (!input.payRateType && input.payRateAmount !== null)
    ) {
      throw new BadRequestException(
        'Pay rate type and amount must both be set or both be cleared.',
      );
    }

    await this.ensureEmployeeProfile({
      organizationId: context.organizationId,
      userId,
      memberId: assignment.memberId,
      branchId: assignment.branchId,
      updatedBy: context.userId,
    });

    const updated = await updateEmployeeCompensation({
      organizationId: context.organizationId,
      userId,
      payRateType: input.payRateType,
      payRateAmount: input.payRateAmount,
      updatedBy: context.userId,
    });

    if (!updated) {
      throw new NotFoundException('Employee profile not found.');
    }

    return serializeEmployeeProfile(updated);
  }

  async updateLeaveBalances(
    request: Request,
    userId: string,
    input: {
      periodYear?: number;
      balances: Array<{ leaveType: BalanceLeaveType; entitledDays: number }>;
    },
  ) {
    const context = await this.requireManager(request);
    await this.billing.requireFeature(
      context.organizationId,
      'leave',
      'Leave requests and approvals',
    );
    const year = input.periodYear ?? new Date().getFullYear();
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    if (!input.balances.length) {
      throw new BadRequestException('At least one leave balance is required.');
    }

    const policy = await ensureLeavePolicy(context.organizationId);
    const profile = await findProfileByUserId(context.organizationId, userId);
    const eligibility = resolveLeaveEligibility({
      policy,
      hireDate: profile?.hireDate,
      asOfDate: todayDateString(),
    });

    if (!eligibility.eligible) {
      throw new BadRequestException(
        `Employee is ineligible for leave until ${eligibility.tenureMonthsRequired} month(s) of service are completed.`,
      );
    }

    const period = resolveLeavePeriod(
      this.periodReferenceDate(year),
      policy,
      profile?.hireDate,
    );
    for (const entry of input.balances) {
      if (!BALANCE_LEAVE_TYPES.includes(entry.leaveType)) {
        throw new BadRequestException('Invalid leave type for balance.');
      }

      if (entry.entitledDays < 0 || entry.entitledDays > 365) {
        throw new BadRequestException('Entitled days must be between 0 and 365.');
      }

      await setEntitledDays({
        organizationId: context.organizationId,
        userId,
        memberId: assignment.memberId,
        branchId: assignment.branchId,
        leaveType: entry.leaveType,
        periodKey: period.periodKey,
        periodYear: period.periodYear,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        companyEntitledDays: entry.entitledDays,
        policy,
        hireDate: profile?.hireDate,
      });
    }

    const serialized = (
      await prepareEmployeeLeaveBalances({
        organizationId: context.organizationId,
        userId,
        memberId: assignment.memberId,
        branchId: assignment.branchId,
        referenceDate: this.periodReferenceDate(year),
      })
    ).balances;

    return {
      periodYear: year,
      periodKey: period.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      leaveBalances: serialized,
    };
  }

  async getMyLeaveBalances(request: Request, periodYear?: number) {
    const context = await this.workforce.requireEmployee(request);
    await this.billing.requireFeature(
      context.organizationId,
      'leave',
      'Leave requests and approvals',
    );
    const year = periodYear ?? new Date().getFullYear();

    await this.ensureEmployeeProfile({
      organizationId: context.organizationId,
      userId: context.userId,
      memberId: context.memberId,
      branchId: context.branchId!,
    });

    const result = await prepareEmployeeLeaveBalances({
      organizationId: context.organizationId,
      userId: context.userId,
      memberId: context.memberId,
      branchId: context.branchId!,
      referenceDate: this.periodReferenceDate(year),
    });
    const profile = await findProfileByUserId(
      context.organizationId,
      context.userId,
    );
    const leaveEligibility = resolveLeaveEligibility({
      policy: result.policy,
      hireDate: profile?.hireDate,
      asOfDate: todayDateString(),
    });

    return {
      periodYear: result.period.periodYear,
      periodKey: result.period.periodKey,
      periodStart: result.period.periodStart,
      periodEnd: result.period.periodEnd,
      leaveBalances: result.balances,
      silSafeguard: result.policy.silSafeguard,
      leaveEligibility,
    };
  }

  async listEmployeeDocuments(request: Request, userId: string) {
    const context = await this.requireManager(request);
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    const documents = await listStoredEmployeeDocuments(
      context.organizationId,
      userId,
    );

    return {
      documents: documents.map(serializeEmployeeDocument),
    };
  }

  async createEmployeeDocument(
    request: Request,
    userId: string,
    input: {
      title: string;
      category: DocumentCategory;
      notes?: string;
      referenceUrl?: string;
      file?: Express.Multer.File;
    },
  ) {
    const context = await this.requireManager(request);
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    const title = input.title?.trim();
    if (!title) {
      throw new BadRequestException('Document title is required.');
    }

    if (!DOCUMENT_CATEGORIES.includes(input.category)) {
      throw new BadRequestException('Invalid document category.');
    }

    const referenceUrl = input.referenceUrl?.trim() || undefined;
    const file = input.file;

    if (!file && !referenceUrl) {
      throw new BadRequestException(
        'Upload a file or provide a reference URL.',
      );
    }

    let fileName: string | undefined;
    let fileMimeType: string | undefined;
    let fileSize: number | undefined;
    let storedFileName: string | undefined;

    if (file) {
      if (file.size > MAX_EMPLOYEE_DOCUMENT_BYTES) {
        throw new BadRequestException('File must be 10 MB or smaller.');
      }

      const extension = getEmployeeDocumentExtension(file.originalname);
      if (!extension) {
        throw new BadRequestException(
          'Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOC, DOCX.',
        );
      }

      fileName = file.originalname;
      fileMimeType = file.mimetype || 'application/octet-stream';
      fileSize = file.size;
    }

    const document = await createEmployeeDocument({
      organizationId: context.organizationId,
      userId,
      title,
      category: input.category,
      notes: input.notes,
      referenceUrl,
      fileName,
      fileMimeType,
      fileSize,
      createdBy: context.userId,
    });

    if (file) {
      const extension = getEmployeeDocumentExtension(file.originalname)!;
      storedFileName = createStoredFileName(document._id, extension);

      try {
        await saveEmployeeDocumentFile({
          organizationId: context.organizationId,
          userId,
          storedFileName,
          buffer: file.buffer,
        });
      } catch {
        await deleteEmployeeDocument({
          organizationId: context.organizationId,
          userId,
          documentId: document._id,
        });
        throw new BadRequestException('Unable to save uploaded file.');
      }

      await setEmployeeDocumentStoredFileName({
        organizationId: context.organizationId,
        userId,
        documentId: document._id,
        storedFileName,
      });

      document.storedFileName = storedFileName;
    }

    return serializeEmployeeDocument(document);
  }

  async getEmployeeDocumentFile(
    request: Request,
    userId: string,
    documentId: string,
  ) {
    const context = await this.requireManager(request);
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    const document = await findEmployeeDocument({
      organizationId: context.organizationId,
      userId,
      documentId,
    });

    if (!document?.storedFileName) {
      throw new NotFoundException('Document file not found.');
    }

    return {
      stream: openEmployeeDocumentFile({
        organizationId: context.organizationId,
        userId,
        storedFileName: document.storedFileName,
      }),
      fileName: document.fileName ?? document.title,
      mimeType: document.fileMimeType ?? 'application/octet-stream',
    };
  }

  async deleteEmployeeDocument(
    request: Request,
    userId: string,
    documentId: string,
  ) {
    const context = await this.requireManager(request);
    const assignment = await findAssignmentByUserId(
      context.organizationId,
      userId,
    );

    if (!assignment || assignment.role !== 'employee') {
      throw new NotFoundException('Employee not found.');
    }

    this.assertEmployeeAccess(context, assignment.branchId);

    const document = await findEmployeeDocument({
      organizationId: context.organizationId,
      userId,
      documentId,
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    if (document.storedFileName) {
      await deleteEmployeeDocumentFile({
        organizationId: context.organizationId,
        userId,
        storedFileName: document.storedFileName,
      });
    }

    const deleted = await deleteEmployeeDocument({
      organizationId: context.organizationId,
      userId,
      documentId,
    });

    if (!deleted) {
      throw new NotFoundException('Document not found.');
    }

    return { success: true };
  }
}

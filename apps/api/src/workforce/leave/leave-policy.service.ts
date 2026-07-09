import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  LEAVE_CONVERSION_TARGETS,
  LEAVE_RESET_TYPES,
  type LeavePolicyInput,
} from './leave-policy.types';
import {
  ensureLeavePolicy,
  serializeLeavePolicy,
  upsertLeavePolicy,
} from './leave-policy.store';
import { WorkforceContextService } from '../workforce-context.service';
import { BillingService } from '../../billing/billing.service';

@Injectable()
export class LeavePolicyService {
  constructor(
    private readonly workforce: WorkforceContextService,
    private readonly billing: BillingService,
  ) {}

  private async requireAdmin(request: Request) {
    const context = await this.workforce.getMemberContext(request);

    if (!context.isAdmin) {
      throw new ForbiddenException('Organization admin access required.');
    }

    return context;
  }

  private validatePolicyInput(input: LeavePolicyInput) {
    if (!LEAVE_RESET_TYPES.includes(input.resetType)) {
      throw new BadRequestException('Invalid leave reset type.');
    }

    if (
      !Number.isInteger(input.fiscalYearStartMonth) ||
      input.fiscalYearStartMonth < 1 ||
      input.fiscalYearStartMonth > 12
    ) {
      throw new BadRequestException(
        'Fiscal year start month must be between 1 and 12.',
      );
    }

    if (
      !Number.isInteger(input.silSafeguard.minDays) ||
      input.silSafeguard.minDays < 0 ||
      input.silSafeguard.minDays > 30
    ) {
      throw new BadRequestException('SIL minimum days must be between 0 and 30.');
    }

    if (
      !Number.isInteger(input.silSafeguard.tenureMonths) ||
      input.silSafeguard.tenureMonths < 1 ||
      input.silSafeguard.tenureMonths > 24
    ) {
      throw new BadRequestException(
        'SIL tenure months must be between 1 and 24.',
      );
    }

    for (const rules of [input.vacation, input.sick]) {
      if (
        rules.carryOver.maxDays < 0 ||
        rules.carryOver.maxDays > 365 ||
        rules.conversion.maxDays < 0 ||
        rules.conversion.maxDays > 365
      ) {
        throw new BadRequestException(
          'Carry-over and conversion limits must be between 0 and 365.',
        );
      }

      if (!LEAVE_CONVERSION_TARGETS.includes(rules.conversion.target)) {
        throw new BadRequestException('Invalid leave conversion target.');
      }
    }
  }

  async getPolicy(request: Request) {
    const context = await this.workforce.getMemberContext(request);
    await this.billing.requireFeature(
      context.organizationId,
      'leave',
      'Leave requests and approvals',
    );

    const policy = await ensureLeavePolicy(context.organizationId);
    return serializeLeavePolicy(policy);
  }

  async updatePolicy(request: Request, input: LeavePolicyInput) {
    const context = await this.requireAdmin(request);
    await this.billing.requireFeature(
      context.organizationId,
      'leave',
      'Leave requests and approvals',
    );

    this.validatePolicyInput(input);

    const policy = await upsertLeavePolicy(context.organizationId, input);
    return serializeLeavePolicy(policy);
  }
}

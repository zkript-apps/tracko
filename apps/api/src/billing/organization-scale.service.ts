import { ForbiddenException, Injectable } from '@nestjs/common';
import { isWorkforceStaffRole } from '../auth/org-roles';
import { listAssignmentsByOrganization } from '../organizations/branch-assignments.store';
import { findSubscriptionByOrganizationId } from './organization-subscriptions.store';
import {
  getScaleTierDefinition,
  resolveScaleTierFromEmployeeCount,
  type OrganizationScaleTier,
} from './organization-scale';

@Injectable()
export class OrganizationScaleService {
  async countEmployees(organizationId: string): Promise<number> {
    const assignments = await listAssignmentsByOrganization(organizationId);
    return assignments.filter((assignment) =>
      isWorkforceStaffRole(assignment.role),
    ).length;
  }

  async resolveScaleTier(organizationId: string): Promise<{
    employeeCount: number;
    scaleTier: OrganizationScaleTier;
  }> {
    const [employeeCount, subscription] = await Promise.all([
      this.countEmployees(organizationId),
      findSubscriptionByOrganizationId(organizationId),
    ]);

    return {
      employeeCount,
      scaleTier: subscription?.scaleTier ?? 'small',
    };
  }

  /** One-time backfill for subscriptions created before scale was purchased. */
  async deriveScaleTierFromEmployeeCount(
    organizationId: string,
  ): Promise<OrganizationScaleTier> {
    const employeeCount = await this.countEmployees(organizationId);
    return resolveScaleTierFromEmployeeCount(employeeCount);
  }

  async getScaleCapacity(organizationId: string): Promise<{
    employeeCount: number;
    scaleTier: OrganizationScaleTier;
    scaleTierLabel: string;
    maxEmployees: number | null;
    remaining: number | null;
    atLimit: boolean;
  }> {
    const [employeeCount, subscription] = await Promise.all([
      this.countEmployees(organizationId),
      findSubscriptionByOrganizationId(organizationId),
    ]);

    const scaleTier =
      subscription?.scaleTier ??
      (await this.deriveScaleTierFromEmployeeCount(organizationId));
    const definition = getScaleTierDefinition(scaleTier);
    const maxEmployees = definition.maxEmployees;
    const remaining =
      maxEmployees == null
        ? null
        : Math.max(0, maxEmployees - employeeCount);
    const atLimit = maxEmployees != null && employeeCount >= maxEmployees;

    return {
      employeeCount,
      scaleTier,
      scaleTierLabel: definition.label,
      maxEmployees,
      remaining,
      atLimit,
    };
  }

  async assertCanAddWorkforceStaff(
    organizationId: string,
    reservedSlots = 0,
  ): Promise<void> {
    const capacity = await this.getScaleCapacity(organizationId);

    if (capacity.maxEmployees == null) {
      return;
    }

    if (capacity.employeeCount + reservedSlots >= capacity.maxEmployees) {
      throw new ForbiddenException(
        `Your ${capacity.scaleTierLabel} scale allows up to ${capacity.maxEmployees} employees. Upgrade your organization scale in Subscription settings to add more.`,
      );
    }
  }
}

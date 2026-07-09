import { Injectable } from '@nestjs/common';
import { isWorkforceStaffRole } from '../auth/org-roles';
import { listAssignmentsByOrganization } from '../organizations/branch-assignments.store';
import {
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
    const employeeCount = await this.countEmployees(organizationId);
    return {
      employeeCount,
      scaleTier: resolveScaleTierFromEmployeeCount(employeeCount),
    };
  }
}

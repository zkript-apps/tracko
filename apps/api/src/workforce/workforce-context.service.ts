import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { ORG_ADMIN_ROLES, HR_ROLES } from '../auth/org-roles';
import { findAssignmentByUserId } from '../organizations/branch-assignments.store';

export type WorkforceMemberContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  memberId: string;
  role: string;
  branchId: string | null;
  isEmployee: boolean;
  isHr: boolean;
  isAdmin: boolean;
  canManageLeave: boolean;
  canViewBranchAttendance: boolean;
};

@Injectable()
export class WorkforceContextService {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly authService: AuthService<any>,
  ) {}

  headersFrom(request: Request) {
    return fromNodeHeaders(request.headers);
  }

  async getMemberContext(request: Request): Promise<WorkforceMemberContext> {
    const headers = this.headersFrom(request);
    const session = await this.authService.api.getSession({ headers });

    if (!session?.user?.id) {
      throw new UnauthorizedException('Sign in required.');
    }

    const organizations = await this.authService.api.listOrganizations({
      headers,
    });

    if (!organizations?.length) {
      throw new BadRequestException('No organization found.');
    }

    const organization = organizations[0];

    if (!session.session?.activeOrganizationId) {
      await this.authService.api.setActiveOrganization({
        headers,
        body: { organizationId: organization.id },
      });
    }

    const fullOrganization = await this.authService.api.getFullOrganization({
      headers,
      query: { organizationId: organization.id },
    });

    if (!fullOrganization) {
      throw new BadRequestException('Unable to load organization.');
    }

    const userId = session.user.id;
    let activeMember;

    try {
      activeMember = await this.authService.api.getActiveMember({ headers });
    } catch {
      activeMember =
        fullOrganization.members?.find(
          (member: { userId: string }) => member.userId === userId,
        ) ??
        null;
    }

    if (!activeMember) {
      throw new ForbiddenException('Organization membership required.');
    }

    const role = activeMember.role;
    const isAdmin = ORG_ADMIN_ROLES.includes(
      role as (typeof ORG_ADMIN_ROLES)[number],
    );
    const isHr = HR_ROLES.includes(role as (typeof HR_ROLES)[number]);
    const isEmployee = role === 'employee';
    const assignment = await findAssignmentByUserId(organization.id, userId);

    return {
      userId,
      organizationId: organization.id,
      organizationName: organization.name,
      memberId: activeMember.id,
      role,
      branchId: assignment?.branchId ?? null,
      isEmployee,
      isHr,
      isAdmin,
      canManageLeave: isAdmin || isHr,
      canViewBranchAttendance: isAdmin || isHr,
    };
  }

  async requireEmployee(request: Request) {
    const context = await this.getMemberContext(request);

    if (!context.isEmployee && !context.isHr) {
      throw new ForbiddenException('Employee or HR access required.');
    }

    if (!context.branchId) {
      throw new BadRequestException('Workforce member has no branch assignment.');
    }

    return context;
  }

  async requireLeaveManager(request: Request) {
    const context = await this.getMemberContext(request);

    if (!context.canManageLeave) {
      throw new ForbiddenException('HR or admin access required.');
    }

    return context;
  }
}

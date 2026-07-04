import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { ORG_ADMIN_ROLES, HR_ROLES } from '../auth/org-roles';
import {
  findAssignmentByUserId,
  listAssignmentsByOrganization,
} from '../organizations/branch-assignments.store';
import {
  getBranchById,
  listBranchesByOrganization,
} from '../organizations/branches.store';
import { buildAcceptInviteUrl } from '../org-invitations/invite-url';

@Injectable()
export class TeamService {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly authService: AuthService<any>,
  ) {}

  private headersFrom(request: Request) {
    return fromNodeHeaders(request.headers);
  }

  private async ensureActiveOrganization(headers: HeadersInit) {
    const organizations = await this.authService.api.listOrganizations({
      headers,
    });

    if (!organizations?.length) {
      throw new BadRequestException('No organization found.');
    }

    const organization = organizations[0];
    const session = await this.authService.api.getSession({ headers });

    if (!session?.session?.activeOrganizationId) {
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

    return {
      fullOrganization,
      userId: session?.user?.id ?? '',
    };
  }

  private async resolveCurrentMember(
    headers: HeadersInit,
    organization: { members?: Array<{ userId: string; role: string }> },
    userId: string,
  ) {
    try {
      return await this.authService.api.getActiveMember({ headers });
    } catch {
      return (
        organization.members?.find((member) => member.userId === userId) ?? null
      );
    }
  }

  async listBranches(request: Request) {
    const headers = this.headersFrom(request);
    const { fullOrganization } = await this.ensureActiveOrganization(headers);

    return listBranchesByOrganization(fullOrganization.id);
  }

  async getOverview(request: Request) {
    const headers = this.headersFrom(request);
    const { fullOrganization, userId } =
      await this.ensureActiveOrganization(headers);
    const organization = fullOrganization;

    const activeMember = await this.resolveCurrentMember(
      headers,
      organization,
      userId,
    );
    const memberRole = activeMember?.role ?? 'member';
    const isAdmin = ORG_ADMIN_ROLES.includes(
      memberRole as (typeof ORG_ADMIN_ROLES)[number],
    );
    const isHr = HR_ROLES.includes(memberRole as (typeof HR_ROLES)[number]);
    const assignment = isHr
      ? await findAssignmentByUserId(organization.id, userId)
      : null;
    const branches = await listBranchesByOrganization(organization.id);
    const assignments = await listAssignmentsByOrganization(organization.id);
    const branchMap = new Map(branches.map((branch) => [branch._id, branch]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const members = (organization.members ?? []).map((member: any) => {
      const assignment = assignments.find(
        (entry) => entry.userId === member.userId,
      );
      const branch = assignment
        ? branchMap.get(assignment.branchId)
        : undefined;

      return {
        id: member.id,
        userId: member.userId,
        role: member.role,
        user: member.user,
        branch: branch
          ? { id: branch._id, name: branch.name, city: branch.city }
          : null,
      };
    });

    const invitations = (organization.invitations ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((invitation: any) => invitation.status === 'pending')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((invitation: any) => {
        const branchId =
          typeof invitation.branchId === 'string'
            ? invitation.branchId
            : undefined;
        const branch = branchId ? branchMap.get(branchId) : undefined;

        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          branch: branch
            ? { id: branch._id, name: branch.name, city: branch.city }
            : null,
        };
      });

    return {
      organization: {
        id: organization.id,
        name: organization.name,
      },
      currentMember: activeMember
        ? {
            role: activeMember.role,
            canManageTeam: isAdmin,
            canInviteEmployees: isAdmin || isHr,
            assignedBranchId: assignment?.branchId ?? null,
          }
        : null,
      branches,
      members,
      invitations,
    };
  }

  async inviteHr(
    request: Request,
    input: { email: string; branchId: string },
  ) {
    const headers = this.headersFrom(request);
    const { fullOrganization, userId } =
      await this.ensureActiveOrganization(headers);
    const activeMember = await this.resolveCurrentMember(
      headers,
      fullOrganization,
      userId,
    );

    if (
      !activeMember ||
      !ORG_ADMIN_ROLES.includes(
        activeMember.role as (typeof ORG_ADMIN_ROLES)[number],
      )
    ) {
      throw new ForbiddenException('Only organization admins can invite HR.');
    }

    const organization = fullOrganization;

    const branch = await getBranchById(input.branchId);
    if (!branch || String(branch.organizationId) !== String(organization.id)) {
      throw new BadRequestException('Invalid branch.');
    }

    const invitation = await this.authService.api.createInvitation({
      headers,
      body: {
        email: input.email,
        role: 'hr',
        branchId: input.branchId,
        organizationId: organization.id,
      },
    });

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

    return {
      invitation,
      inviteUrl: buildAcceptInviteUrl(invitation.id, webUrl),
    };
  }

  async inviteEmployee(
    request: Request,
    input: { email: string; branchId?: string },
  ) {
    const headers = this.headersFrom(request);
    const { fullOrganization, userId } =
      await this.ensureActiveOrganization(headers);
    const activeMember = await this.resolveCurrentMember(
      headers,
      fullOrganization,
      userId,
    );

    if (!activeMember) {
      throw new ForbiddenException('Organization membership required.');
    }

    const memberRole = activeMember.role;
    const isAdmin = ORG_ADMIN_ROLES.includes(
      memberRole as (typeof ORG_ADMIN_ROLES)[number],
    );
    const isHr = HR_ROLES.includes(memberRole as (typeof HR_ROLES)[number]);

    if (!isAdmin && !isHr) {
      throw new ForbiddenException(
        'Only organization admins and HR can invite employees.',
      );
    }

    const organization = fullOrganization;
    let branchId = input.branchId?.trim();

    if (isHr) {
      const assignment = await findAssignmentByUserId(organization.id, userId);

      if (!assignment) {
        throw new ForbiddenException('HR user has no branch assignment.');
      }

      if (branchId && branchId !== assignment.branchId) {
        throw new ForbiddenException(
          'HR can only invite employees to their assigned branch.',
        );
      }

      branchId = assignment.branchId;
    }

    if (!branchId) {
      throw new BadRequestException('Branch is required.');
    }

    const branch = await getBranchById(branchId);
    if (!branch || String(branch.organizationId) !== String(organization.id)) {
      throw new BadRequestException('Invalid branch.');
    }

    const invitation = await this.authService.api.createInvitation({
      headers,
      body: {
        email: input.email,
        role: 'employee',
        branchId,
        organizationId: organization.id,
      },
    });

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

    return {
      invitation,
      inviteUrl: buildAcceptInviteUrl(invitation.id, webUrl),
    };
  }
}

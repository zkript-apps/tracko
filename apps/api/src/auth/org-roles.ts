import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultAc,
  defaultRoles,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access';

const statement = {
  ...defaultAc.statements,
  branch: ['read', 'manage', 'assign'],
  attendance: ['read', 'manage'],
  leave: ['read', 'approve'],
  payroll: ['read', 'manage'],
} as const;

export const orgAc = createAccessControl(statement);

export const hrRole = orgAc.newRole({
  branch: ['read', 'manage'],
  attendance: ['read', 'manage'],
  leave: ['read', 'approve'],
  payroll: ['read'],
  invitation: ['create', 'cancel'],
  member: [],
  organization: [],
  team: [],
  ac: ['read'],
});

export const employeeRole = orgAc.newRole({
  branch: ['read'],
  attendance: ['read'],
  leave: ['read'],
  payroll: [],
  member: [],
  invitation: [],
  organization: [],
  team: [],
  ac: ['read'],
});

export const orgRoles = {
  ...defaultRoles,
  hr: hrRole,
  employee: employeeRole,
  owner: ownerAc,
  admin: adminAc,
  member: memberAc,
};

export const ORG_INVITE_ROLES = ['hr', 'employee'] as const;
export type OrgInviteRole = (typeof ORG_INVITE_ROLES)[number];

export const ORG_ADMIN_ROLES = ['owner', 'admin'] as const;
export const HR_ROLES = ['hr'] as const;
export const WORKFORCE_STAFF_ROLES = ['employee', 'hr'] as const;

export function isWorkforceStaffRole(role: string | null | undefined): boolean {
  return WORKFORCE_STAFF_ROLES.includes(
    role as (typeof WORKFORCE_STAFF_ROLES)[number],
  );
}

export function resolveWorkforceRole(
  memberRole: string,
  assignmentRole?: string | null,
): string {
  if (
    HR_ROLES.includes(memberRole as (typeof HR_ROLES)[number]) ||
    assignmentRole === 'hr'
  ) {
    return 'hr';
  }

  if (memberRole === 'employee' || assignmentRole === 'employee') {
    return 'employee';
  }

  return memberRole;
}

export const orgInvitationSchema = {
  invitation: {
    additionalFields: {
      branchId: { type: 'string' as const, required: true },
    },
  },
};

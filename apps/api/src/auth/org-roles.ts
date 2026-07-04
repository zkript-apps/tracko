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

export const orgInvitationSchema = {
  invitation: {
    additionalFields: {
      branchId: { type: 'string' as const, required: true },
    },
  },
};

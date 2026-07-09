import { apiFetch } from './api';

export type Branch = {
  _id: string;
  organizationId: string;
  name: string;
  address?: string;
  city?: string;
  isHeadOffice: boolean;
};

export type TeamOverview = {
  organization: { id: string; name: string };
  currentMember: {
    role: string;
    canManageTeam: boolean;
    canInviteEmployees: boolean;
    assignedBranchId: string | null;
  } | null;
  branches: Branch[];
  members: Array<{
    id: string;
    userId: string;
    role: string;
    user: { id: string; name: string; email: string };
    branch: { id: string; name: string; city?: string } | null;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    branch: { id: string; name: string; city?: string } | null;
  }>;
};

export type OrgInvitationValidation = {
  valid: boolean;
  reason?: string;
  invitation?: {
    id: string;
    email: string;
    role: string;
    organizationName: string;
    branchName: string | null;
    expiresAt: string;
  };
};

export async function getTeamOverview(): Promise<TeamOverview> {
  return apiFetch('/team/overview');
}

export async function getBranches(): Promise<Branch[]> {
  return apiFetch('/branches');
}

export async function inviteHrMember(input: {
  email: string;
  branchId: string;
}): Promise<{ invitation: { id: string; email: string }; inviteUrl: string }> {
  return apiFetch('/team/invite-hr', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function inviteEmployeeMember(input: {
  email: string;
  branchId?: string;
}): Promise<{ invitation: { id: string; email: string }; inviteUrl: string }> {
  return apiFetch('/team/invite-employee', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function validateOrgInvitation(
  id: string,
): Promise<OrgInvitationValidation> {
  return apiFetch(`/org-invitations/validate?id=${encodeURIComponent(id)}`);
}

export async function acceptOrgInvitation(invitationId: string) {
  return apiFetch('/api/auth/organization/accept-invitation', {
    method: 'POST',
    body: JSON.stringify({ invitationId }),
  });
}

export async function cancelOrgInvitation(invitationId: string) {
  return apiFetch('/api/auth/organization/cancel-invitation', {
    method: 'POST',
    body: JSON.stringify({ invitationId }),
  });
}

export async function reassignTeamMember(input: {
  userId: string;
  branchId: string;
}): Promise<{
  userId: string;
  branchId: string;
  branchName: string;
  role: string;
}> {
  return apiFetch('/team/members/reassign', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

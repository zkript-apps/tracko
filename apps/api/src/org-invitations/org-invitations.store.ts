import { getMongoDb } from '../database/mongo';
import { getBranchById } from '../organizations/branches.store';
import { ORG_INVITE_ROLES, type OrgInviteRole } from '../auth/org-roles';

export interface OrgInvitationRecord {
  _id: string;
  id?: string;
  organizationId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  branchId?: string;
}

async function getInvitationCollection() {
  const db = await getMongoDb();
  return db.collection<OrgInvitationRecord>('invitation');
}

async function getOrganizationCollection() {
  const db = await getMongoDb();
  return db.collection<{ _id: string; id?: string; name: string; slug: string }>(
    'organization',
  );
}

function authRecordIdFilter(value: string) {
  return { $or: [{ _id: value }, { id: value }] };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getInvitationPublicId(invitation: OrgInvitationRecord): string {
  return invitation.id ?? String(invitation._id);
}

export async function findOrgInvitationById(
  invitationId: string,
): Promise<OrgInvitationRecord | null> {
  const collection = await getInvitationCollection();
  return collection.findOne(authRecordIdFilter(invitationId));
}

export async function validateOrgInvitationForSignup(
  invitationId: string,
  email?: string,
): Promise<OrgInvitationRecord> {
  const invitation = await findOrgInvitationById(invitationId);

  if (!invitation) {
    throw new Error('Invalid organization invitation.');
  }

  if (invitation.status !== 'pending') {
    throw new Error('This invitation is no longer valid.');
  }

  if (invitation.expiresAt.getTime() <= Date.now()) {
    throw new Error('This invitation has expired.');
  }

  if (!ORG_INVITE_ROLES.includes(invitation.role as OrgInviteRole)) {
    throw new Error('This invitation cannot be used for self-registration.');
  }

  if (email && normalizeEmail(email) !== normalizeEmail(invitation.email)) {
    throw new Error('Email does not match the invitation.');
  }

  if (!invitation.branchId) {
    throw new Error('Invitation is missing a branch assignment.');
  }

  const branch = await getBranchById(invitation.branchId);
  if (
    !branch ||
    String(branch.organizationId) !== String(invitation.organizationId)
  ) {
    throw new Error('Invitation branch is invalid.');
  }

  return invitation;
}

export async function getPublicOrgInvitationDetails(invitationId: string) {
  const invitation = await findOrgInvitationById(invitationId);

  if (!invitation) {
    return { valid: false as const, reason: 'Invitation not found.' };
  }

  if (invitation.status !== 'pending') {
    return { valid: false as const, reason: 'This invitation is no longer valid.' };
  }

  if (invitation.expiresAt.getTime() <= Date.now()) {
    return { valid: false as const, reason: 'This invitation has expired.' };
  }

  const orgCollection = await getOrganizationCollection();
  const organizationId = String(invitation.organizationId);
  const organization =
    (await orgCollection.findOne(authRecordIdFilter(organizationId))) ??
    (await orgCollection.findOne({ _id: organizationId }));
  const branch = invitation.branchId
    ? await getBranchById(invitation.branchId)
    : null;

  return {
    valid: true as const,
    invitation: {
      id: getInvitationPublicId(invitation),
      email: invitation.email,
      role: invitation.role,
      organizationName: organization?.name ?? 'Organization',
      branchName: branch?.name ?? null,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  };
}

export function resolvePlatformRole(orgRole: string): string {
  if (orgRole === 'hr') {
    return 'hr';
  }

  if (orgRole === 'employee') {
    return 'employee';
  }

  return 'org_admin';
}

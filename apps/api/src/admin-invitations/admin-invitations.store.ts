import { randomBytes } from 'crypto';
import { getMongoDb } from '../database/mongo';
import type {
  AdminInvitation,
  AdminInvitationStatus,
  CreateAdminInvitationInput,
  PlanTier,
} from './admin-invitation.types';

const COLLECTION = 'admin_invitations';
const INVITATION_TTL_DAYS = 7;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createToken(): string {
  return randomBytes(32).toString('hex');
}

function invitationExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);
  return expiresAt;
}

function isExpired(invitation: AdminInvitation): boolean {
  return invitation.expiresAt.getTime() <= Date.now();
}

async function getCollection() {
  const db = await getMongoDb();
  return db.collection<AdminInvitation>(COLLECTION);
}

export async function createAdminInvitation(
  input: CreateAdminInvitationInput,
): Promise<AdminInvitation> {
  const collection = await getCollection();
  const email = normalizeEmail(input.email);
  const now = new Date();

  const existing = await collection.findOne({
    email,
    status: 'pending',
    expiresAt: { $gt: now },
  });

  if (existing) {
    return existing;
  }

  const invitation: AdminInvitation = {
    _id: createToken().slice(0, 24),
    token: createToken(),
    email,
    planTier: input.planTier,
    status: 'pending',
    paymentReference: input.paymentReference,
    paidAt: now,
    expiresAt: invitationExpiryDate(),
    createdAt: now,
  };

  await collection.insertOne(invitation);
  return invitation;
}

export async function findInvitationByToken(
  token: string,
): Promise<AdminInvitation | null> {
  const collection = await getCollection();
  return collection.findOne({ token });
}

export async function findPendingInvitationByEmail(
  email: string,
): Promise<AdminInvitation | null> {
  const collection = await getCollection();
  return collection.findOne({
    email: normalizeEmail(email),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
}

export async function validateAdminInvitation(
  token: string,
  email?: string,
): Promise<AdminInvitation> {
  const invitation = await findInvitationByToken(token);

  if (!invitation) {
    throw new Error('Invalid invitation token.');
  }

  if (invitation.status === 'used') {
    throw new Error('This invitation has already been used.');
  }

  if (invitation.status === 'expired' || isExpired(invitation)) {
    await markInvitationStatus(invitation.token, 'expired');
    throw new Error('This invitation has expired.');
  }

  if (email && normalizeEmail(email) !== invitation.email) {
    throw new Error('Email does not match the invitation.');
  }

  return invitation;
}

export async function markInvitationUsed(
  token: string,
  userId: string,
): Promise<void> {
  const collection = await getCollection();
  await collection.updateOne(
    { token },
    {
      $set: {
        status: 'used' satisfies AdminInvitationStatus,
        usedAt: new Date(),
        userId,
      },
    },
  );
}

async function markInvitationStatus(
  token: string,
  status: AdminInvitationStatus,
): Promise<void> {
  const collection = await getCollection();
  await collection.updateOne({ token }, { $set: { status } });
}

export async function listAdminInvitations(): Promise<AdminInvitation[]> {
  const collection = await getCollection();
  return collection.find({}).sort({ createdAt: -1 }).toArray();
}

export function buildAdminSignupUrl(token: string, webUrl: string): string {
  return `${webUrl}/sign-up?token=${encodeURIComponent(token)}`;
}

export function toPublicInvitation(invitation: AdminInvitation) {
  return {
    email: invitation.email,
    planTier: invitation.planTier,
    expiresAt: invitation.expiresAt.toISOString(),
    status: invitation.status,
  };
}

export const PLAN_TIERS: PlanTier[] = ['small', 'medium', 'enterprise'];

import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { CreateAdminInvitationInput } from '../admin-invitations/admin-invitation.types';
import {
  buildAdminSignupUrl,
  createAdminInvitation,
  listAdminInvitations,
} from '../admin-invitations/admin-invitations.store';
import { sendAdminInvitationEmail } from '../email/email.client';
import { getMongoDb } from '../database/mongo';
import { PlatformAuthService } from './platform-auth.service';

@Injectable()
export class PlatformService {
  constructor(private readonly platformAuth: PlatformAuthService) {}

  async getOverview(request: Request) {
    await this.platformAuth.requireSuperAdmin(request);
    const db = await getMongoDb();

    const [organizationCount, memberCount, branchCount, invitations] =
      await Promise.all([
        db.collection('organization').countDocuments(),
        db.collection('member').countDocuments(),
        db.collection('branches').countDocuments(),
        listAdminInvitations(),
      ]);

    const pendingAdminInvites = invitations.filter(
      (invitation) =>
        invitation.status === 'pending' &&
        invitation.expiresAt.getTime() > Date.now(),
    ).length;

    return {
      organizationCount,
      memberCount,
      branchCount,
      pendingAdminInvites,
      totalAdminInvites: invitations.length,
    };
  }

  async listOrganizations(request: Request) {
    await this.platformAuth.requireSuperAdmin(request);
    const db = await getMongoDb();

    const [organizations, members, branches] = await Promise.all([
      db.collection('organization').find({}).sort({ createdAt: -1 }).toArray(),
      db.collection('member').find({}).toArray(),
      db.collection('branches').find({}).toArray(),
    ]);

    return organizations.map((organization) => {
      const orgId = String(organization._id);
      const orgMembers = members.filter(
        (member) => String(member.organizationId) === orgId,
      );
      const orgBranches = branches.filter(
        (branch) => String(branch.organizationId) === orgId,
      );

      return {
        id: orgId,
        name: organization.name,
        slug: organization.slug,
        industry: organization.industry ?? null,
        city: organization.city ?? null,
        onboardingCompleted: Boolean(organization.onboardingCompleted),
        createdAt: organization.createdAt,
        memberCount: orgMembers.length,
        branchCount: orgBranches.length,
      };
    });
  }

  async listAdminInvitations(request: Request) {
    await this.platformAuth.requireSuperAdmin(request);
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const invitations = await listAdminInvitations();

    return invitations.map((invitation) => ({
      token: invitation.token,
      email: invitation.email,
      planTier: invitation.planTier,
      status: invitation.status,
      paymentReference: invitation.paymentReference ?? null,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      usedAt: invitation.usedAt?.toISOString() ?? null,
      signupUrl:
        invitation.status === 'pending'
          ? buildAdminSignupUrl(invitation.token, webUrl)
          : null,
    }));
  }

  async createAdminInvitation(
    request: Request,
    input: CreateAdminInvitationInput,
  ) {
    await this.platformAuth.requireSuperAdmin(request);
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const invitation = await createAdminInvitation(input);
    const signupUrl = buildAdminSignupUrl(invitation.token, webUrl);

    await sendAdminInvitationEmail({
      email: invitation.email,
      planTier: invitation.planTier,
      signupUrl,
    });

    return {
      invitation: {
        token: invitation.token,
        email: invitation.email,
        planTier: invitation.planTier,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      signupUrl: buildAdminSignupUrl(invitation.token, webUrl),
    };
  }
}
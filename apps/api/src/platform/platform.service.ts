import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { CreateAdminInvitationInput } from '../admin-invitations/admin-invitation.types';
import {
  buildAdminSignupUrl,
  createAdminInvitation,
  listAdminInvitations,
} from '../admin-invitations/admin-invitations.store';
import { BillingService } from '../billing/billing.service';
import {
  calculateMonthlyTotalPhp,
  getFeatureCatalogForTier,
} from '../billing/feature-catalog';
import { getScaleTierDefinition } from '../billing/organization-scale';
import {
  findSubscriptionByOrganizationId,
  listSubscriptionsByStatus,
} from '../billing/organization-subscriptions.store';
import { getMongoDb } from '../database/mongo';
import { sendAdminInvitationEmail, sendEmail } from '../email/email.client';
import {
  findSubscriptionInquiryById,
  listSubscriptionInquiries,
  updateSubscriptionInquiry,
} from '../subscription-inquiries/subscription-inquiries.store';
import { PlatformAuthService } from './platform-auth.service';

@Injectable()
export class PlatformService {
  constructor(
    private readonly platformAuth: PlatformAuthService,
    private readonly billing: BillingService,
  ) {}

  async getOverview(request: Request) {
    await this.platformAuth.requireSuperAdmin(request);
    const db = await getMongoDb();

    const [organizationCount, memberCount, branchCount, invitations, inquiries] =
      await Promise.all([
        db.collection('organization').countDocuments(),
        db.collection('member').countDocuments(),
        db.collection('branches').countDocuments(),
        listAdminInvitations(),
        listSubscriptionInquiries(),
      ]);

    const pendingAdminInvites = invitations.filter(
      (invitation) =>
        invitation.status === 'pending' &&
        invitation.expiresAt.getTime() > Date.now(),
    ).length;
    const pendingInquiries = inquiries.filter(
      (inquiry) => inquiry.status === 'pending',
    ).length;
    const pendingSubscriptions = (
      await listSubscriptionsByStatus('pending')
    ).length;

    return {
      organizationCount,
      memberCount,
      branchCount,
      pendingAdminInvites,
      pendingInquiries,
      pendingSubscriptions,
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

    return Promise.all(
      organizations.map(async (organization) => {
        const orgId = String(organization._id);
        const orgMembers = members.filter(
          (member) => String(member.organizationId) === orgId,
        );
        const orgBranches = branches.filter(
          (branch) => String(branch.organizationId) === orgId,
        );
        const subscription = await findSubscriptionByOrganizationId(orgId);

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
          subscriptionStatus: subscription?.status ?? null,
          scaleTier: subscription?.scaleTier ?? null,
        };
      }),
    );
  }

  async listAdminInvitations(request: Request) {
    await this.platformAuth.requireSuperAdmin(request);
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const invitations = await listAdminInvitations();

    return invitations.map((invitation) => ({
      token: invitation.token,
      email: invitation.email,
      planTier: invitation.planTier,
      selectedFeatures: invitation.selectedFeatures ?? [],
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

  private serializeInquiry(
    inquiry: NonNullable<
      Awaited<ReturnType<typeof findSubscriptionInquiryById>>
    >,
  ) {
    const scaleDefinition = getScaleTierDefinition(inquiry.scaleTier);
    return {
      id: inquiry._id,
      companyName: inquiry.companyName,
      contactName: inquiry.contactName,
      email: inquiry.email,
      phone: inquiry.phone,
      message: inquiry.message ?? null,
      employeeCount: inquiry.employeeCount,
      scaleTier: inquiry.scaleTier,
      scaleTierLabel: scaleDefinition.label,
      selectedFeatures: inquiry.selectedFeatures,
      status: inquiry.status,
      estimatedMonthlyTotalPhp: calculateMonthlyTotalPhp(
        inquiry.selectedFeatures,
        inquiry.scaleTier,
      ),
      features: getFeatureCatalogForTier(inquiry.scaleTier).filter((feature) =>
        inquiry.selectedFeatures.includes(
          feature.id as (typeof inquiry.selectedFeatures)[number],
        ),
      ),
      adminInvitationToken: inquiry.adminInvitationToken ?? null,
      reviewedAt: inquiry.reviewedAt?.toISOString() ?? null,
      rejectionReason: inquiry.rejectionReason ?? null,
      createdAt: inquiry.createdAt.toISOString(),
    };
  }

  async listSubscriptionInquiries(request: Request) {
    await this.platformAuth.requireSuperAdmin(request);
    const inquiries = await listSubscriptionInquiries();
    return inquiries.map((inquiry) => this.serializeInquiry(inquiry));
  }

  async approveSubscriptionInquiry(request: Request, inquiryId: string) {
    const session = await this.platformAuth.requireSuperAdmin(request);
    const inquiry = await findSubscriptionInquiryById(inquiryId);

    if (!inquiry) {
      throw new NotFoundException('Subscription inquiry not found.');
    }

    if (inquiry.status !== 'pending') {
      throw new BadRequestException(
        `This inquiry was already ${inquiry.status}.`,
      );
    }

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const invitation = await createAdminInvitation({
      email: inquiry.email,
      planTier: inquiry.scaleTier,
      selectedFeatures: inquiry.selectedFeatures,
      inquiryId: inquiry._id,
      paymentReference: `inquiry:${inquiry._id}`,
    });
    const signupUrl = buildAdminSignupUrl(invitation.token, webUrl);

    await sendAdminInvitationEmail({
      email: invitation.email,
      planTier: invitation.planTier,
      signupUrl,
    });

    const updated = await updateSubscriptionInquiry(inquiry._id, {
      status: 'approved',
      adminInvitationToken: invitation.token,
      reviewedAt: new Date(),
      reviewedByUserId: session.user.id,
      rejectionReason: null,
    });

    return {
      inquiry: updated ? this.serializeInquiry(updated) : null,
      signupUrl,
    };
  }

  async rejectSubscriptionInquiry(
    request: Request,
    inquiryId: string,
    reason?: string,
  ) {
    const session = await this.platformAuth.requireSuperAdmin(request);
    const inquiry = await findSubscriptionInquiryById(inquiryId);

    if (!inquiry) {
      throw new NotFoundException('Subscription inquiry not found.');
    }

    if (inquiry.status !== 'pending') {
      throw new BadRequestException(
        `This inquiry was already ${inquiry.status}.`,
      );
    }

    const rejectionReason = reason?.trim() || null;
    const updated = await updateSubscriptionInquiry(inquiry._id, {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedByUserId: session.user.id,
      rejectionReason,
    });

    await sendEmail({
      to: inquiry.email,
      subject: 'Update on your Tracko subscription request',
      text: `Hi ${inquiry.contactName},\n\nThanks for your interest in Tracko. After review, we are unable to proceed with your subscription request at this time.${
        rejectionReason ? `\n\nReason: ${rejectionReason}` : ''
      }\n\nIf you have questions, reply to this email.`,
      html: `<p>Hi ${inquiry.contactName},</p><p>Thanks for your interest in Tracko. After review, we are unable to proceed with your subscription request at this time.</p>${
        rejectionReason ? `<p>Reason: ${rejectionReason}</p>` : ''
      }<p>If you have questions, reply to this email.</p>`,
    });

    return updated ? this.serializeInquiry(updated) : null;
  }

  async listPendingSubscriptions(request: Request) {
    await this.platformAuth.requireSuperAdmin(request);
    const db = await getMongoDb();
    const pending = await listSubscriptionsByStatus('pending');
    const organizations = await db.collection('organization').find({}).toArray();
    const orgMap = new Map(
      organizations.map((organization) => [
        String(organization._id),
        organization,
      ]),
    );

    return pending.map((subscription) => {
      const organization = orgMap.get(subscription.organizationId);
      const scaleDefinition = getScaleTierDefinition(subscription.scaleTier);

      return {
        organizationId: subscription.organizationId,
        organizationName:
          typeof organization?.name === 'string'
            ? organization.name
            : 'Unknown organization',
        scaleTier: subscription.scaleTier,
        scaleTierLabel: scaleDefinition.label,
        activeFeatures: subscription.activeFeatures,
        status: subscription.status,
        createdAt: subscription.createdAt.toISOString(),
        currentMonthlyTotalPhp: calculateMonthlyTotalPhp(
          subscription.activeFeatures,
          subscription.scaleTier,
        ),
      };
    });
  }

  async activateSubscription(request: Request, organizationId: string) {
    await this.platformAuth.requireSuperAdmin(request);
    const subscription = await this.billing.setSubscriptionStatus(
      organizationId,
      'active',
    );

    return {
      organizationId: subscription.organizationId,
      status: subscription.status,
    };
  }

  async rejectSubscription(request: Request, organizationId: string) {
    await this.platformAuth.requireSuperAdmin(request);
    const subscription = await this.billing.setSubscriptionStatus(
      organizationId,
      'rejected',
    );

    return {
      organizationId: subscription.organizationId,
      status: subscription.status,
    };
  }
}

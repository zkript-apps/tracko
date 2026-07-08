import { Injectable } from '@nestjs/common';
import {
  buildAdminSignupUrl,
  createAdminInvitation,
  findInvitationByToken,
  toPublicInvitation,
  validateAdminInvitation,
} from './admin-invitations.store';
import type { CreateAdminInvitationInput } from './admin-invitation.types';
import { sendAdminInvitationEmail } from '../email/email.client';

@Injectable()
export class AdminInvitationsService {
  async createAndDeliver(input: CreateAdminInvitationInput) {
    const invitation = await createAdminInvitation(input);
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const signupUrl = buildAdminSignupUrl(invitation.token, webUrl);

    await sendAdminInvitationEmail({
      email: invitation.email,
      planTier: invitation.planTier,
      signupUrl,
    });

    return { invitation, signupUrl };
  }

  createFromPayment(input: CreateAdminInvitationInput) {
    return this.createAndDeliver(input);
  }

  async validateToken(token: string) {
    const invitation = await findInvitationByToken(token);

    if (!invitation) {
      return { valid: false as const, reason: 'Invalid invitation token.' };
    }

    try {
      await validateAdminInvitation(token);
      return {
        valid: true as const,
        invitation: toPublicInvitation(invitation),
      };
    } catch (error) {
      return {
        valid: false as const,
        reason:
          error instanceof Error ? error.message : 'Invalid invitation token.',
      };
    }
  }
}

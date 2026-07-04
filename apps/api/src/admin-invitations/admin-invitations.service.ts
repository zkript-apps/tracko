import { Injectable } from '@nestjs/common';
import {
  createAdminInvitation,
  findInvitationByToken,
  toPublicInvitation,
  validateAdminInvitation,
} from './admin-invitations.store';
import type { CreateAdminInvitationInput } from './admin-invitation.types';

@Injectable()
export class AdminInvitationsService {
  createFromPayment(input: CreateAdminInvitationInput) {
    return createAdminInvitation(input);
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

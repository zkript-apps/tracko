export type PlanTier = 'small' | 'medium' | 'enterprise';

export type AdminInvitationStatus = 'pending' | 'used' | 'expired';

export interface AdminInvitation {
  _id: string;
  token: string;
  email: string;
  planTier: PlanTier;
  status: AdminInvitationStatus;
  paymentReference?: string;
  paidAt: Date;
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date;
  userId?: string;
}

export interface CreateAdminInvitationInput {
  email: string;
  planTier: PlanTier;
  paymentReference?: string;
}

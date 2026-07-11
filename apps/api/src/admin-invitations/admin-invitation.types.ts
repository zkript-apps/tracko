export type PlanTier = 'small' | 'medium' | 'enterprise';

export type AdminInvitationStatus = 'pending' | 'used' | 'expired';

export interface AdminInvitation {
  _id: string;
  token: string;
  email: string;
  planTier: PlanTier;
  selectedFeatures: string[];
  status: AdminInvitationStatus;
  paymentReference?: string;
  paidAt: Date;
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date;
  userId?: string;
  inquiryId?: string;
}

export interface CreateAdminInvitationInput {
  email: string;
  planTier: PlanTier;
  paymentReference?: string;
  selectedFeatures?: string[];
  inquiryId?: string;
}

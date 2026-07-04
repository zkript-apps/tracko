export interface Branch {
  _id: string;
  organizationId: string;
  name: string;
  address?: string;
  city?: string;
  isHeadOffice: boolean;
  createdAt: Date;
}

export interface CreateBranchInput {
  name: string;
  address?: string;
  city?: string;
  isHeadOffice?: boolean;
}

export interface CompleteOnboardingInput {
  name: string;
  slug?: string;
  industry?: string;
  timezone?: string;
  address?: string;
  city?: string;
  phone?: string;
  branches: CreateBranchInput[];
}

export interface OnboardingStatus {
  needsOnboarding: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
    onboardingCompleted: boolean;
  } | null;
  branches: Branch[];
}

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
  selectedFeatures?: Array<'live_tracking' | 'payroll' | 'leave'>;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  };
  leavePolicy?: {
    resetType: 'calendar' | 'anniversary' | 'fiscal';
    fiscalYearStartMonth: number;
    silSafeguard: {
      enabled: boolean;
      minDays: number;
      tenureMonths: number;
      cashOutUnused: boolean;
    };
    periodAutoGrant: {
      vacation: number;
      sick: number;
      emergency: number;
    };
    accrual: {
      method:
        | 'straight_line_monthly'
        | 'daily_precise'
        | 'monthly_cutoff'
        | 'no_proration'
        | 'anniversary_full';
      monthlyCutoffDay: number;
    };
    vacation?: {
      carryOver: { enabled: boolean; maxDays: number };
      forfeiture: { enabled: boolean };
      conversion: {
        enabled: boolean;
        target: 'vacation' | 'sick' | 'cash';
        maxDays: number;
      };
    };
    sick?: {
      carryOver: { enabled: boolean; maxDays: number };
      forfeiture: { enabled: boolean };
      conversion: {
        enabled: boolean;
        target: 'vacation' | 'sick' | 'cash';
        maxDays: number;
      };
    };
  };
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

export const LEAVE_RESET_TYPES = ['calendar', 'anniversary', 'fiscal'] as const;

export type LeaveResetType = (typeof LEAVE_RESET_TYPES)[number];

export const LEAVE_CONVERSION_TARGETS = ['vacation', 'sick', 'cash'] as const;

export type LeaveConversionTarget = (typeof LEAVE_CONVERSION_TARGETS)[number];

export type LeaveTypeRules = {
  carryOver: {
    enabled: boolean;
    maxDays: number;
  };
  forfeiture: {
    enabled: boolean;
  };
  conversion: {
    enabled: boolean;
    target: LeaveConversionTarget;
    maxDays: number;
  };
};

export type SilSafeguard = {
  enabled: boolean;
  minDays: number;
  tenureMonths: number;
  cashOutUnused: boolean;
};

export type PeriodAutoGrant = {
  vacation: number;
  sick: number;
  emergency: number;
};

export const LEAVE_ACCRUAL_METHODS = [
  'straight_line_monthly',
  'daily_precise',
  'monthly_cutoff',
  'no_proration',
  'anniversary_full',
] as const;

export type LeaveAccrualMethod = (typeof LEAVE_ACCRUAL_METHODS)[number];

export type LeaveAccrualSettings = {
  method: LeaveAccrualMethod;
  monthlyCutoffDay: number;
};

export interface LeavePolicy {
  _id: string;
  organizationId: string;
  resetType: LeaveResetType;
  fiscalYearStartMonth: number;
  silSafeguard: SilSafeguard;
  periodAutoGrant: PeriodAutoGrant;
  accrual: LeaveAccrualSettings;
  vacation: LeaveTypeRules;
  sick: LeaveTypeRules;
  createdAt: Date;
  updatedAt: Date;
}

export type LeavePolicyInput = {
  resetType: LeaveResetType;
  fiscalYearStartMonth: number;
  silSafeguard: SilSafeguard;
  periodAutoGrant: PeriodAutoGrant;
  accrual: LeaveAccrualSettings;
  vacation: LeaveTypeRules;
  sick: LeaveTypeRules;
};

export const DEFAULT_PERIOD_AUTO_GRANT: PeriodAutoGrant = {
  vacation: 0,
  sick: 0,
  emergency: 0,
};

export const DEFAULT_LEAVE_ACCRUAL: LeaveAccrualSettings = {
  method: 'straight_line_monthly',
  monthlyCutoffDay: 15,
};

export const DEFAULT_LEAVE_POLICY: LeavePolicyInput = {
  resetType: 'calendar',
  fiscalYearStartMonth: 1,
  silSafeguard: {
    enabled: true,
    minDays: 5,
    tenureMonths: 12,
    cashOutUnused: true,
  },
  periodAutoGrant: DEFAULT_PERIOD_AUTO_GRANT,
  accrual: DEFAULT_LEAVE_ACCRUAL,
  vacation: {
    carryOver: { enabled: false, maxDays: 0 },
    forfeiture: { enabled: true },
    conversion: { enabled: false, target: 'cash', maxDays: 0 },
  },
  sick: {
    carryOver: { enabled: false, maxDays: 0 },
    forfeiture: { enabled: true },
    conversion: { enabled: false, target: 'vacation', maxDays: 0 },
  },
};

export type LeavePeriod = {
  periodKey: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
};

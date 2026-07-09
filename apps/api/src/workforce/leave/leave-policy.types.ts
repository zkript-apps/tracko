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

export interface LeavePolicy {
  _id: string;
  organizationId: string;
  resetType: LeaveResetType;
  fiscalYearStartMonth: number;
  silSafeguard: SilSafeguard;
  vacation: LeaveTypeRules;
  sick: LeaveTypeRules;
  createdAt: Date;
  updatedAt: Date;
}

export type LeavePolicyInput = {
  resetType: LeaveResetType;
  fiscalYearStartMonth: number;
  silSafeguard: SilSafeguard;
  vacation: LeaveTypeRules;
  sick: LeaveTypeRules;
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

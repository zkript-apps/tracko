export const ORG_ADMIN_ROLES = ['owner', 'admin'] as const;
export const HR_ROLES = ['hr'] as const;
export const ORG_INVITE_ROLES = ['hr', 'employee'] as const;

export function isOrgAdminRole(role: string | null | undefined): boolean {
  return ORG_ADMIN_ROLES.includes(role as (typeof ORG_ADMIN_ROLES)[number]);
}

export function isHrRole(role: string | null | undefined): boolean {
  return HR_ROLES.includes(role as (typeof HR_ROLES)[number]);
}

export function isEmployeeRole(role: string | null | undefined): boolean {
  return role === 'employee';
}

export function isWorkforceStaffRole(role: string | null | undefined): boolean {
  return isEmployeeRole(role) || isHrRole(role);
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'super_admin';
}

export function getPostInvitePath(
  role: string,
): '/dashboard' | '/employee' | '/platform' {
  if (isEmployeeRole(role)) {
    return '/employee';
  }

  if (isSuperAdminRole(role)) {
    return '/platform';
  }

  return '/dashboard';
}

export function formatOrgRole(role: string): string {
  if (role === 'hr') {
    return 'HR';
  }

  if (role === 'employee') {
    return 'Employee';
  }

  if (role === 'owner') {
    return 'Organization Admin';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

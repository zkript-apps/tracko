'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CalendarCog,
  ChevronDown,
  ClipboardList,
  Clock,
  CreditCard,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Palette,
  PhilippinePeso,
  Sun,
  UserCog,
  Users,
  CalendarRange,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { signOut } from '@/lib/auth-client';
import {
  getOrganizationSubscription,
  type BillableFeatureId,
} from '@/lib/billing';
import {
  applyOrgBrandingTheme,
  clearOrgBrandingTheme,
  ORG_BRANDING_UPDATED_EVENT,
  resolveBrandingLogoUrl,
  type BrandingColors,
} from '@/lib/branding';
import { useThemeMode } from '@/components/theme/theme-provider';
import { formatOrgRole, isHrRole } from '@/lib/org-roles';
import { cn } from '@/lib/utils';
import type { TeamOverview } from '@/lib/team';
import { isOrgAppearanceEnabled } from '@/lib/feature-flags';

type DashboardShellProps = {
  team: TeamOverview;
  userId: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
};

type NavLinkItem = {
  type: 'link';
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavGroupItem = {
  type: 'group';
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavLinkItem[];
};

type NavItem = NavLinkItem | NavGroupItem;

function buildNavItems(
  team: TeamOverview,
  activeFeatures: BillableFeatureId[] = [],
): NavItem[] {
  const items: NavItem[] = [
    {
      type: 'link',
      href: '/dashboard',
      label: 'Overview',
      icon: LayoutDashboard,
      exact: true,
    },
  ];

  const canManageWorkforce =
    team.currentMember?.canManageTeam ||
    team.currentMember?.canInviteEmployees ||
    team.currentMember?.role === 'hr';

  const employeeChildren: NavLinkItem[] = [];

  if (team.currentMember?.canInviteEmployees) {
    employeeChildren.push({
      type: 'link',
      href: '/dashboard/employees',
      label: 'Directory',
      icon: Users,
    });
  }

  if (canManageWorkforce) {
    employeeChildren.push(
      {
        type: 'link',
        href: '/dashboard/attendance',
        label: 'Attendance',
        icon: Clock,
      },
      {
        type: 'link',
        href: '/dashboard/dtr',
        label: 'DTR',
        icon: ClipboardList,
      },
      {
        type: 'link',
        href: '/dashboard/records',
        label: 'Records',
        icon: FolderOpen,
      },
    );
  }

  if (isHrRole(team.currentMember?.role)) {
    employeeChildren.push({
      type: 'link',
      href: '/employee',
      label: 'Clock in/out',
      icon: Fingerprint,
    });
  }

  if (employeeChildren.length > 0) {
    items.push({
      type: 'group',
      id: 'employees',
      label: 'Employees',
      icon: Users,
      children: employeeChildren,
    });
  }

  if (canManageWorkforce && activeFeatures.includes('leave')) {
    const leaveChildren: NavLinkItem[] = [
      {
        type: 'link',
        href: '/dashboard/leave',
        label: 'Requests',
        icon: CalendarDays,
        exact: true,
      },
    ];

    if (team.currentMember?.canManageTeam) {
      leaveChildren.push({
        type: 'link',
        href: '/dashboard/leave/policy',
        label: 'Policy',
        icon: CalendarCog,
      });
    }

    items.push({
      type: 'group',
      id: 'leave',
      label: 'Leave',
      icon: CalendarDays,
      children: leaveChildren,
    });
  }

  if (canManageWorkforce && activeFeatures.includes('payroll')) {
    items.push({
      type: 'link',
      href: '/dashboard/payroll',
      label: 'Payroll',
      icon: PhilippinePeso,
    });
  }

  if (canManageWorkforce) {
    items.push({
      type: 'link',
      href: '/dashboard/calendar',
      label: 'Calendar',
      icon: CalendarRange,
    });
  }

  if (team.currentMember?.canManageTeam) {
    const organizationChildren: NavLinkItem[] = [
      {
        type: 'link',
        href: '/dashboard/team',
        label: 'Team & HR',
        icon: UserCog,
      },
      {
        type: 'link',
        href: '/dashboard/settings/branding',
        label: 'Branding',
        icon: Building2,
      },
    ];

    if (isOrgAppearanceEnabled()) {
      organizationChildren.push({
        type: 'link',
        href: '/dashboard/settings/appearance',
        label: 'Appearance',
        icon: Palette,
      });
    }

    organizationChildren.push({
      type: 'link',
      href: '/dashboard/settings/subscription',
      label: 'Subscription',
      icon: CreditCard,
    });

    items.push({
      type: 'group',
      id: 'organization',
      label: 'Organization',
      icon: UserCog,
      children: organizationChildren,
    });
  }

  return items;
}

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, group: NavGroupItem) {
  return group.children.some((child) =>
    isActivePath(pathname, child.href, child.exact),
  );
}

function findActiveNavLabel(items: NavItem[], pathname: string): string {
  for (const item of items) {
    if (item.type === 'link') {
      if (isActivePath(pathname, item.href, item.exact)) {
        return item.label;
      }
      continue;
    }

    for (const child of item.children) {
      if (isActivePath(pathname, child.href, child.exact)) {
        return child.label;
      }
    }
  }

  return 'Dashboard';
}

function NavLink({
  item,
  pathname,
  onNavigate,
  nested = false,
}: {
  item: NavLinkItem;
  pathname: string;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const active = isActivePath(pathname, item.href, item.exact);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        nested && 'pl-10',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function NavGroup({
  item,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  item: NavGroupItem;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const groupActive = isGroupActive(pathname, item);
  const Icon = item.icon;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          groupActive
            ? 'text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform duration-200 ease-out',
            open ? 'rotate-0' : '-rotate-90',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              'space-y-1 transition-opacity duration-200 ease-out',
              open ? 'opacity-100' : 'opacity-0',
            )}
          >
            {item.children.map((child) => (
              <NavLink
                key={child.href}
                item={child}
                pathname={pathname}
                onNavigate={onNavigate}
                nested
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const activeGroupKey = items
    .filter(
      (item): item is NavGroupItem =>
        item.type === 'group' && isGroupActive(pathname, item),
    )
    .map((item) => item.id)
    .sort()
    .join('|');

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};

    for (const item of items) {
      if (item.type === 'group') {
        initial[item.id] = isGroupActive(pathname, item);
      }
    }

    return initial;
  });

  useEffect(() => {
    if (!activeGroupKey) {
      return;
    }

    const activeIds = activeGroupKey.split('|');

    setOpenGroups((current) => {
      const next = { ...current };
      let changed = false;

      for (const id of activeIds) {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [activeGroupKey]);

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        if (item.type === 'link') {
          return (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          );
        }

        return (
          <NavGroup
            key={item.id}
            item={item}
            pathname={pathname}
            open={Boolean(openGroups[item.id])}
            onToggle={() =>
              setOpenGroups((current) => ({
                ...current,
                [item.id]: !current[item.id],
              }))
            }
            onNavigate={onNavigate}
          />
        );
      })}
    </nav>
  );
}

function ThemeModeToggle() {
  const { themeMode, setThemeMode, isSaving } = useThemeMode();

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-start"
      disabled={isSaving}
      onClick={() =>
        void setThemeMode(themeMode === 'dark' ? 'light' : 'dark')
      }
    >
      {themeMode === 'dark' ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
      {themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
    </Button>
  );
}

function SidebarContent({
  team,
  userId,
  userName,
  userEmail,
  pathname,
  activeFeatures,
  logoSrc,
  onNavigate,
  onSignOut,
}: {
  team: TeamOverview;
  userId: string;
  userName: string;
  userEmail: string;
  pathname: string;
  activeFeatures: BillableFeatureId[];
  logoSrc: string | null;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  const items = buildNavItems(team, activeFeatures);
  const role = team.currentMember?.role ?? 'member';
  const branch = team.members.find(
    (member) => member.userId === userId,
  )?.branch;

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <div className="flex items-center gap-3">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={`${team.organization.name} logo`}
              className="size-9 rounded-lg object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Tracko
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {team.organization.name}
            </p>
          </div>
        </div>
        {branch ? (
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {branch.name}
          </p>
        ) : null}
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks items={items} pathname={pathname} onNavigate={onNavigate} />
      </div>

      <Separator />

      <div className="space-y-3 px-4 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {userName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          <p className="mt-1 text-xs text-primary/80">{formatOrgRole(role)}</p>
        </div>
        <ThemeModeToggle />
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={onSignOut}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function DashboardShell({
  team,
  userId,
  userName,
  userEmail,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFeatures, setActiveFeatures] = useState<BillableFeatureId[]>([]);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [activeBranding, setActiveBranding] = useState<BrandingColors | null>(
    team.organization.branding
      ? {
          primaryColor: team.organization.branding.primaryColor,
          secondaryColor: team.organization.branding.secondaryColor,
          accentColor: team.organization.branding.accentColor,
        }
      : null,
  );
  const [activeLogoUrl, setActiveLogoUrl] = useState<string | null>(
    team.organization.branding?.logoUrl ?? null,
  );

  useEffect(() => {
    if (!isOrgAppearanceEnabled()) {
      return;
    }

    if (activeBranding) {
      applyOrgBrandingTheme(activeBranding);
    }
  }, [activeBranding]);

  useEffect(() => {
    function handleBrandingUpdated(event: Event) {
      const detail = (event as CustomEvent<BrandingColors & {
        hasLogo?: boolean;
        logoUrl?: string | null;
      }>).detail;

      if (!detail) {
        return;
      }

      setActiveBranding({
        primaryColor: detail.primaryColor,
        secondaryColor: detail.secondaryColor,
        accentColor: detail.accentColor,
      });

      if ('logoUrl' in detail) {
        setActiveLogoUrl(detail.logoUrl ?? null);
      }
    }

    window.addEventListener(ORG_BRANDING_UPDATED_EVENT, handleBrandingUpdated);
    return () => {
      window.removeEventListener(
        ORG_BRANDING_UPDATED_EVENT,
        handleBrandingUpdated,
      );
    };
  }, []);

  useEffect(() => {
    const logoUrl = activeLogoUrl;
    let objectUrl: string | null = null;
    let cancelled = false;

    if (!logoUrl) {
      setLogoSrc(null);
      return;
    }

    const resolved = resolveBrandingLogoUrl(logoUrl);

    if (!resolved) {
      setLogoSrc(null);
      return;
    }

    void fetch(resolved, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load logo.');
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setLogoSrc(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLogoSrc(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [activeLogoUrl]);

  useEffect(() => {
    if (!team.currentMember?.canManageTeam && team.currentMember?.role !== 'hr') {
      return;
    }

    void getOrganizationSubscription()
      .then((subscription) => {
        setActiveFeatures(subscription.activeFeatures);
      })
      .catch(() => {
        setActiveFeatures([]);
      });
  }, [team]);

  async function handleSignOut() {
    clearOrgBrandingTheme();
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  const pageTitle = findActiveNavLabel(
    buildNavItems(team, activeFeatures),
    pathname,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">
        <SidebarContent
          team={team}
          userId={userId}
          userName={userName}
          userEmail={userEmail}
          pathname={pathname}
          activeFeatures={activeFeatures}
          logoSrc={logoSrc}
          onSignOut={handleSignOut}
        />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="icon">
                <Menu className="size-4" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent
                team={team}
                userId={userId}
                userName={userName}
                userEmail={userEmail}
                pathname={pathname}
                activeFeatures={activeFeatures}
                logoSrc={logoSrc}
                onNavigate={() => setMobileOpen(false)}
                onSignOut={handleSignOut}
              />
            </SheetContent>
          </Sheet>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{pageTitle}</p>
            <p className="truncate text-xs text-muted-foreground">
              {team.organization.name}
            </p>
          </div>
        </header>

        <div className="min-h-screen w-full min-w-0">{children}</div>
      </div>
    </div>
  );
}

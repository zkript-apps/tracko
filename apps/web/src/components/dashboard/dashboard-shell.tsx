'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CalendarCog,
  ClipboardList,
  Clock,
  CreditCard,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  PhilippinePeso,
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
import { formatOrgRole, isHrRole } from '@/lib/org-roles';
import { cn } from '@/lib/utils';
import type { TeamOverview } from '@/lib/team';

type DashboardShellProps = {
  team: TeamOverview;
  userId: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

function buildNavItems(
  team: TeamOverview,
  activeFeatures: BillableFeatureId[] = [],
): NavItem[] {
  const items: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Overview',
      icon: LayoutDashboard,
      exact: true,
    },
  ];

  if (isHrRole(team.currentMember?.role)) {
    items.push({
      href: '/employee',
      label: 'Clock in/out',
      icon: Fingerprint,
    });
  }

  const canManageWorkforce =
    team.currentMember?.canManageTeam ||
    team.currentMember?.canInviteEmployees ||
    team.currentMember?.role === 'hr';

  if (canManageWorkforce) {
    items.push(
      {
        href: '/dashboard/attendance',
        label: 'Attendance',
        icon: Clock,
      },
      {
        href: '/dashboard/dtr',
        label: 'DTR',
        icon: ClipboardList,
      },
    );

    if (activeFeatures.includes('leave')) {
      items.push({
        href: '/dashboard/leave',
        label: 'Leave',
        icon: CalendarDays,
        exact: true,
      });

      if (team.currentMember?.canManageTeam) {
        items.push({
          href: '/dashboard/leave/policy',
          label: 'Leave policy',
          icon: CalendarCog,
        });
      }
    }

    if (activeFeatures.includes('payroll')) {
      items.push({
        href: '/dashboard/payroll',
        label: 'Payroll',
        icon: PhilippinePeso,
      });
    }

    items.push(
      {
        href: '/dashboard/calendar',
        label: 'Calendar',
        icon: CalendarRange,
      },
      {
        href: '/dashboard/records',
        label: 'Records',
        icon: FolderOpen,
      },
    );
  }

  if (team.currentMember?.canInviteEmployees) {
    items.push({
      href: '/dashboard/employees',
      label: 'Employees',
      icon: Users,
    });
  }

  if (team.currentMember?.canManageTeam) {
    items.push(
      {
        href: '/dashboard/team',
        label: 'Team & HR',
        icon: UserCog,
      },
      {
        href: '/dashboard/settings/subscription',
        label: 'Subscription',
        icon: CreditCard,
      },
    );
  }

  return items;
}

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
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
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href, item.exact);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  team,
  userId,
  userName,
  userEmail,
  pathname,
  activeFeatures,
  onNavigate,
  onSignOut,
}: {
  team: TeamOverview;
  userId: string;
  userName: string;
  userEmail: string;
  pathname: string;
  activeFeatures: BillableFeatureId[];
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
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Tracko
        </p>
        <p className="mt-2 truncate text-sm font-semibold text-foreground">
          {team.organization.name}
        </p>
        {branch ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
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
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  const pageTitle =
    buildNavItems(team, activeFeatures).find((item) =>
      isActivePath(pathname, item.href, item.exact),
    )?.label ?? 'Dashboard';

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

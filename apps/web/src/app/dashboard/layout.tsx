'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { useSession } from '@/lib/auth-client';
import { getOnboardingStatus } from '@/lib/onboarding';
import { isEmployeeRole } from '@/lib/org-roles';
import { getSubscriptionAccessStatus } from '@/lib/platform';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace('/sign-in');
      return;
    }

    void getOnboardingStatus()
      .then((status) => {
        if (status.needsOnboarding) {
          router.replace('/onboarding');
          return;
        }

        return getSubscriptionAccessStatus().then((access) => {
          if (!access.isAccessAllowed) {
            router.replace('/subscription-pending');
            return null;
          }

          return getTeamOverview();
        });
      })
      .then((overview) => {
        if (!overview) {
          return;
        }

        const role = overview.currentMember?.role ?? 'member';

        if (isEmployeeRole(role)) {
          router.replace('/employee');
          return;
        }

        setTeam(overview);
      })
      .catch(() => router.replace('/sign-in'))
      .finally(() => setLoading(false));
  }, [isPending, router, session]);

  if (isPending || loading || !session) {
    return <DashboardSkeleton />;
  }

  if (!team) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
        <p className="text-muted-foreground">
          You need to sign in to access the admin panel.
        </p>
        <Link
          href="/sign-in"
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <DashboardShell
      team={team}
      userId={session.user.id}
      userName={session.user.name}
      userEmail={session.user.email}
    >
      {children}
    </DashboardShell>
  );
}

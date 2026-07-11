'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3 } from 'lucide-react';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { signOut, useSession } from '@/lib/auth-client';
import { getOnboardingStatus } from '@/lib/onboarding';
import { isEmployeeRole, isSuperAdminRole } from '@/lib/org-roles';
import {
  getSubscriptionAccessStatus,
  type SubscriptionAccessStatus,
} from '@/lib/platform';

export default function SubscriptionPendingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [access, setAccess] = useState<SubscriptionAccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace('/sign-in');
      return;
    }

    const platformRole = (
      session.user as { platformRole?: string } | undefined
    )?.platformRole;

    if (isSuperAdminRole(platformRole)) {
      router.replace('/platform');
      return;
    }

    if (isEmployeeRole(platformRole)) {
      router.replace('/employee');
      return;
    }

    void getOnboardingStatus()
      .then(async (status) => {
        if (status.needsOnboarding) {
          router.replace('/onboarding');
          return;
        }

        const nextAccess = await getSubscriptionAccessStatus();
        if (nextAccess.isAccessAllowed) {
          router.replace('/dashboard');
          return;
        }

        setAccess(nextAccess);
      })
      .catch(() => {
        // Stay on this page if access status fails; show a generic pending state.
        setAccess({
          organizationId: '',
          status: 'pending',
          isAccessAllowed: false,
          scaleTier: 'small',
        });
      })
      .finally(() => setLoading(false));
  }, [isPending, router, session]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  if (isPending || loading || !session || !access) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Skeleton className="h-64 w-full max-w-lg" />
      </div>
    );
  }

  const isRejected = access.status === 'rejected';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <Clock3 className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-foreground">
          {isRejected ? 'Subscription not approved' : 'Subscription pending'}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isRejected
            ? 'Your organization subscription was not approved. Please contact Tracko support if you believe this is a mistake.'
            : 'Your organization is set up, but your subscription is still waiting for manual approval. You will get full dashboard access once a Tracko admin activates it.'}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Signed in as <span className="text-foreground">{session.user.email}</span>
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <LoadingButton
            type="button"
            variant="outline"
            loading={signingOut}
            loadingText="Signing out…"
            onClick={handleSignOut}
          >
            Sign out
          </LoadingButton>
          <LoadingButton
            type="button"
            onClick={() => {
              setLoading(true);
              void getSubscriptionAccessStatus()
                .then((nextAccess) => {
                  if (nextAccess.isAccessAllowed) {
                    router.replace('/dashboard');
                    return;
                  }
                  setAccess(nextAccess);
                })
                .catch(() => {
                  setAccess((current) =>
                    current ?? {
                      organizationId: '',
                      status: 'pending',
                      isAccessAllowed: false,
                      scaleTier: 'small',
                    },
                  );
                })
                .finally(() => setLoading(false));
            }}
          >
            Check again
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

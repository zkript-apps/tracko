'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { getPostAuthPath } from '@/lib/onboarding';

export function LandingAuthActions() {
  const { data: session, isPending } = useSession();
  const [appPath, setAppPath] = useState('/dashboard');

  useEffect(() => {
    if (!session) {
      return;
    }

    void getPostAuthPath()
      .then(setAppPath)
      .catch(() => setAppPath('/dashboard'));
  }, [session]);

  if (isPending) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-9 w-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <p className="hidden text-sm text-muted-foreground sm:block">
          {session.user.name}
        </p>
        <Link
          href={appPath}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Go to app
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/sign-in"
        className="rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:border-muted-foreground"
      >
        Sign in
      </Link>
      <a
        href="#pricing"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        View plans
      </a>
    </div>
  );
}

export function LandingHeroActions() {
  const { data: session, isPending } = useSession();
  const [appPath, setAppPath] = useState('/dashboard');

  useEffect(() => {
    if (!session) {
      return;
    }

    void getPostAuthPath()
      .then(setAppPath)
      .catch(() => setAppPath('/dashboard'));
  }, [session]);

  if (isPending) {
    return (
      <div className="flex flex-wrap gap-3">
        <div className="h-12 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-12 w-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex flex-wrap gap-3">
        <Link
          href={appPath}
          className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90"
        >
          Continue to app
        </Link>
        <a
          href="#pricing"
          className="rounded-lg border border-border px-5 py-3 text-foreground transition hover:border-muted-foreground"
        >
          View plans
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href="#pricing"
        className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90"
      >
        Subscribe & get started
      </a>
      <a
        href="https://github.com/zkript-apps/tracko"
        target="_blank"
        rel="noreferrer"
        className="rounded-lg border border-border px-5 py-3 text-foreground transition hover:border-muted-foreground"
      >
        View on GitHub
      </a>
    </div>
  );
}

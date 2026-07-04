'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFormSkeleton } from '@/components/ui/auth-form-skeleton';
import { LoadingButton } from '@/components/ui/loading-button';
import { PasswordInput } from '@/components/ui/password-input';
import { signUpSuperAdmin } from '@/lib/auth-client';
import { getBootstrapStatus } from '@/lib/platform';
import { getPostAuthPath } from '@/lib/onboarding';

export default function PlatformSetupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bootstrapConfigured, setBootstrapConfigured] = useState(false);

  useEffect(() => {
    void getBootstrapStatus()
      .then((status) => setBootstrapConfigured(status.bootstrapConfigured))
      .catch(() => setBootstrapConfigured(false))
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signUpSuperAdmin({
      name,
      email,
      password,
      platformBootstrapSecret: bootstrapSecret,
    });

    if (result.error) {
      setLoading(false);
      setError(result.error.message ?? 'Unable to create super admin account.');
      return;
    }

    const nextPath = await getPostAuthPath();
    router.push(nextPath);
    router.refresh();
  }

  if (checking) {
    return <AuthFormSkeleton />;
  }

  if (!bootstrapConfigured) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-slate-950 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-slate-900 p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-white">Setup not configured</h1>
          <p className="mt-3 text-sm text-slate-400">
            Add <code className="text-amber-300">PLATFORM_BOOTSTRAP_SECRET</code>{' '}
            to your API <code className="text-amber-300">.env</code>, restart the
            server, then return here to create the first super admin.
          </p>
          <Link
            href="/sign-in"
            className="mt-6 inline-block text-sm text-emerald-400 hover:underline"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
            WorkTrack Platform
          </p>
          <h1 className="text-2xl font-semibold text-white">
            Create super admin
          </h1>
          <p className="text-sm text-slate-400">
            One-time setup for the first platform operator account.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Full name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Password</span>
            <PasswordInput
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Bootstrap secret</span>
            <input
              type="password"
              required
              value={bootstrapSecret}
              onChange={(event) => setBootstrapSecret(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
              placeholder="From PLATFORM_BOOTSTRAP_SECRET"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Creating account…"
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-amber-400"
          >
            Create super admin
          </LoadingButton>
        </form>
      </div>
    </div>
  );
}

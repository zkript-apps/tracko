'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFormSkeleton } from '@/components/ui/auth-form-skeleton';
import { LoadingButton } from '@/components/ui/loading-button';
import { PasswordInput } from '@/components/ui/password-input';
import { PageLoader } from '@/components/ui/page-loader';
import { getSession, signIn, useSession } from '@/lib/auth-client';
import { getPostAuthPath } from '@/lib/onboarding';

export default function SignInPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (isPending || !session) {
      return;
    }

    setRedirecting(true);
    void getPostAuthPath().then((path) => {
      router.replace(path);
    });
  }, [isPending, router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn.email({
      email,
      password,
    });

    if (result.error) {
      setLoading(false);
      setError(result.error.message ?? 'Unable to sign in.');
      return;
    }

    setRedirecting(true);

    try {
      await getSession();
      const nextPath = await getPostAuthPath();
      router.push(nextPath);
      router.refresh();
    } catch {
      setRedirecting(false);
      setLoading(false);
      setError('Signed in, but could not load your workspace. Try again.');
    }
  }

  if (isPending) {
    return <AuthFormSkeleton />;
  }

  if (redirecting) {
    return <PageLoader label="Signing you in…" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
            Tracko
          </p>
          <h1 className="text-2xl font-semibold text-white">Sign in</h1>
          <p className="text-sm text-slate-400">
            Sign in with the email and password you used when accepting your
            invitation.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60"
              placeholder="hr@company.com"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Password</span>
            <PasswordInput
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              placeholder="••••••••"
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
            loadingText="Signing in…"
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400"
          >
            Sign in
          </LoadingButton>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New accounts require an invitation link from your organization admin or
          HR manager.
        </p>
      </div>
    </div>
  );
}

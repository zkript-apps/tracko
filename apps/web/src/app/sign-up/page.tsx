'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFormSkeleton } from '@/components/ui/auth-form-skeleton';
import { LoadingButton } from '@/components/ui/loading-button';
import { PasswordInput } from '@/components/ui/password-input';
import { signUpWithInvitation } from '@/lib/auth-client';
import { getPostAuthPath, validateInvitationToken } from '@/lib/onboarding';

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [planTier, setPlanTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    async function validate() {
      if (!token) {
        setValidating(false);
        return;
      }

      const result = await validateInvitationToken(token);

      if (result.valid && result.invitation) {
        setEmail(result.invitation.email);
        setPlanTier(result.invitation.planTier);
      } else {
        setError(result.reason ?? 'This invitation link is invalid.');
      }

      setValidating(false);
    }

    void validate();
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signUpWithInvitation({
      name,
      email,
      password,
      invitationToken: token,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? 'Unable to create account.');
      return;
    }

    const nextPath = await getPostAuthPath();
    router.push(nextPath);
    router.refresh();
  }

  if (validating) {
    return <AuthFormSkeleton />;
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-white">
            Invitation required
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Admin accounts are created after a successful subscription payment.
            Use the invitation link sent to your email to set up your account.
          </p>
          <Link
            href="/sign-in"
            className="mt-6 inline-block text-sm text-emerald-400 hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-900 p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-white">
            Invalid invitation
          </h1>
          <p className="mt-3 text-sm text-red-300">{error}</p>
          <Link
            href="/sign-in"
            className="mt-6 inline-block text-sm text-emerald-400 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
            WorkTrack
          </p>
          <h1 className="text-2xl font-semibold text-white">
            Create admin account
          </h1>
          <p className="text-sm text-slate-400">
            Complete your account setup to start configuring your organization.
          </p>
          {planTier ? (
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
              Plan: {planTier}
            </p>
          ) : null}
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
              placeholder="Jane Dela Cruz"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Email</span>
            <input
              type="email"
              required
              readOnly
              value={email}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-400 outline-none"
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
              placeholder="At least 8 characters"
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
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400"
          >
            Create account
          </LoadingButton>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-emerald-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignUpForm />
    </Suspense>
  );
}

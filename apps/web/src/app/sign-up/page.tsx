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
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-foreground">
            Invitation required
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Admin accounts are created after a successful subscription payment.
            Use the invitation link sent to your email to set up your account.
          </p>
          <Link
            href="/sign-in"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-foreground">
            Invalid invitation
          </h1>
          <p className="mt-3 text-sm text-destructive">{error}</p>
          <Link
            href="/sign-in"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Tracko
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            Create admin account
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete your account setup to start configuring your organization.
          </p>
          {planTier ? (
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
              Plan: {planTier}
            </p>
          ) : null}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm text-muted-foreground">Full name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2 disabled:opacity-60"
              placeholder="Jane Dela Cruz"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-muted-foreground">Email</span>
            <input
              type="email"
              required
              readOnly
              value={email}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground outline-none"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-muted-foreground">Password</span>
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
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Creating account…"
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
          >
            Create account
          </LoadingButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-primary hover:underline">
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

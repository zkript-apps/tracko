'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFormSkeleton } from '@/components/ui/auth-form-skeleton';
import { LoadingButton } from '@/components/ui/loading-button';
import { PageLoader } from '@/components/ui/page-loader';
import { PasswordInput } from '@/components/ui/password-input';
import {
  signIn,
  signUpWithOrgInvitation,
  useSession,
} from '@/lib/auth-client';
import { formatOrgRole, getPostInvitePath } from '@/lib/org-roles';
import { acceptOrgInvitation, validateOrgInvitation } from '@/lib/team';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get('id') ?? '';
  const { data: session, isPending } = useSession();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [branchName, setBranchName] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function validate() {
      if (!invitationId) {
        setValidating(false);
        return;
      }

      const result = await validateOrgInvitation(invitationId);

      if (result.valid && result.invitation) {
        setEmail(result.invitation.email);
        setOrganizationName(result.invitation.organizationName);
        setBranchName(result.invitation.branchName);
        setRole(result.invitation.role);
      } else {
        setError(result.reason ?? 'This invitation link is invalid.');
      }

      setValidating(false);
    }

    void validate();
  }, [invitationId]);

  useEffect(() => {
    if (isPending || validating || !session || !invitationId || error) {
      return;
    }

    if (session.user.email.toLowerCase() !== email.toLowerCase()) {
      setError('You are signed in with a different email than this invitation.');
      return;
    }

    setAccepting(true);
    void acceptOrgInvitation(invitationId)
      .then(() => {
        router.replace(getPostInvitePath(role));
        router.refresh();
      })
      .catch((acceptError) => {
        setAccepting(false);
        setError(
          acceptError instanceof Error
            ? acceptError.message
            : 'Unable to accept invitation.',
        );
      });
  }, [email, error, invitationId, isPending, router, session, validating]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const result = await signUpWithOrgInvitation({
          name,
          email,
          password,
          orgInvitationId: invitationId,
        });

        if (result.error) {
          throw new Error(result.error.message ?? 'Unable to create account.');
        }
      } else {
        const result = await signIn.email({ email, password });

        if (result.error) {
          throw new Error(result.error.message ?? 'Unable to sign in.');
        }
      }

      await acceptOrgInvitation(invitationId);
      router.push(getPostInvitePath(role));
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to complete invitation.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (validating || isPending) {
    return <AuthFormSkeleton />;
  }

  if (accepting) {
    return <PageLoader label="Accepting invitation…" />;
  }

  if (!invitationId || (error && !email)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-foreground">Invalid invitation</h1>
          <p className="mt-3 text-sm text-destructive">
            {error ?? 'This invitation link is missing or invalid.'}
          </p>
          <Link
            href="/sign-in"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Go to sign in
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
          <h1 className="text-2xl font-semibold text-foreground">Join {organizationName}</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited as {formatOrgRole(role)}
            {branchName ? ` for ${branchName}` : ''}.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-md px-3 py-2 text-sm transition ${
              mode === 'signup'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`rounded-md px-3 py-2 text-sm transition ${
              mode === 'signin'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign in
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <label className="block space-y-2">
              <span className="text-sm text-muted-foreground">Full name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2 disabled:opacity-60"
              />
            </label>
          ) : null}

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
            loadingText={mode === 'signup' ? 'Creating account…' : 'Signing in…'}
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
          >
            {mode === 'signup' ? 'Create account & join' : 'Sign in & join'}
          </LoadingButton>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <AcceptInviteForm />
    </Suspense>
  );
}

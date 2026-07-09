'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import {
  createAnnouncement,
  getAnnouncements,
  type Announcement,
} from '@/lib/announcements';
import { useSession } from '@/lib/auth-client';
import { getOnboardingStatus, type OnboardingStatus } from '@/lib/onboarding';
import {
  formatOrgRole,
  isHrRole,
  isOrgAdminRole,
} from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  useEffect(() => {
    if (!session) {
      return;
    }

    void getOnboardingStatus().then((status) => {
      setOnboarding(status);
      void getTeamOverview()
        .then(setTeam)
        .catch(() => setTeam(null));
    });
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void getAnnouncements(5)
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]));
  }, [session]);

  if (!session || !team || !onboarding) {
    return null;
  }

  const currentRole = team.currentMember?.role ?? 'member';
  const isAdmin = team.currentMember?.canManageTeam ?? isOrgAdminRole(currentRole);
  const canManageWorkforce =
    isAdmin || isHrRole(currentRole) || team.currentMember?.canInviteEmployees;
  const canInviteEmployees = team.currentMember?.canInviteEmployees ?? false;
  const currentMember = team.members.find(
    (member) => member.userId === session.user.id,
  );
  const branchLabel = currentMember?.branch?.name;

  async function handleAnnouncementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAnnouncementLoading(true);

    try {
      const created = await createAnnouncement({
        title: announcementTitle,
        body: announcementBody,
      });
      setAnnouncements((current) => [created, ...current].slice(0, 5));
      setAnnouncementTitle('');
      setAnnouncementBody('');
      toast.success('Announcement posted.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to post announcement.',
      );
    } finally {
      setAnnouncementLoading(false);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome, {session.user.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {onboarding.organization?.name}
          {branchLabel ? ` · ${branchLabel}` : ''}
        </p>
      </div>

      <section className="mb-10 rounded-2xl border border-primary/20 bg-primary/10 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
          {formatOrgRole(currentRole)}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          {isAdmin ? 'Organization ready' : 'Branch workspace ready'}
        </h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {isAdmin ? (
            <>
              {onboarding.organization?.name ?? 'Your organization'} is set up with{' '}
              {onboarding.branches.length} branch
              {onboarding.branches.length === 1 ? '' : 'es'}. Invite HR managers
              from Team & HR, then monitor attendance and leave from the sidebar.
            </>
          ) : (
            <>
              You can oversee {branchLabel ?? 'your assigned branch'} — review
              attendance, approve leave, and manage employee records.
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {isHrRole(currentRole) ? (
            <Link
              href="/employee"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Clock in/out
            </Link>
          ) : null}
          {canManageWorkforce ? (
            <>
              <Link
                href="/dashboard/attendance"
                className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                View attendance
              </Link>
              <Link
                href="/dashboard/dtr"
                className="inline-flex rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10"
              >
                Review DTR
              </Link>
              <Link
                href="/dashboard/leave"
                className="inline-flex rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10"
              >
                Review leave
              </Link>
              <Link
                href="/dashboard/payroll"
                className="inline-flex rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10"
              >
                Run payroll
              </Link>
              <Link
                href="/dashboard/records"
                className="inline-flex rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10"
              >
                Employee records
              </Link>
            </>
          ) : null}
          {isAdmin ? (
            <Link
              href="/dashboard/team"
              className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-muted-foreground hover:text-foreground"
            >
              Invite HR managers
            </Link>
          ) : canInviteEmployees ? (
            <Link
              href="/dashboard/employees"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Invite employees
            </Link>
          ) : null}
        </div>
      </section>

      {canManageWorkforce ? (
        <section className="mb-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Announcements
                </p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">
                  Latest updates for employees
                </h2>
              </div>
              <Link
                href="/employee/announcements"
                target="_blank"
                className="text-sm text-primary hover:underline"
              >
                Show all announcements
              </Link>
            </div>
            <div className="mt-6 space-y-3">
              {announcements.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No announcements yet.
                </p>
              ) : (
                announcements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {announcement.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {announcement.authorName ?? 'Organization admin'} ·{' '}
                          {new Date(announcement.createdAt).toLocaleString('en-PH')}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {announcement.body}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>

          <section className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              New announcement
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              Post to the employee portal
            </h2>
            <form className="mt-6 space-y-4" onSubmit={handleAnnouncementSubmit}>
              <label className="block space-y-2">
                <span className="text-sm text-muted-foreground">Title</span>
                <input
                  required
                  maxLength={120}
                  value={announcementTitle}
                  onChange={(event) => setAnnouncementTitle(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-muted-foreground">Announcement</span>
                <textarea
                  required
                  rows={6}
                  maxLength={2000}
                  value={announcementBody}
                  onChange={(event) => setAnnouncementBody(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
                />
              </label>
              <LoadingButton
                type="submit"
                loading={announcementLoading}
                loadingText="Posting…"
              >
                Post announcement
              </LoadingButton>
            </form>
          </section>
        </section>
      ) : null}

      {canManageWorkforce ? (
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Live location
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            See where on-duty employees are
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The attendance map refreshes every 5 minutes with locations shared
            while employees keep the portal open during their shift.
          </p>
          <Link
            href="/dashboard/attendance"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Open live map
          </Link>
        </section>
      ) : null}
    </div>
  );
}

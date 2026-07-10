'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAnnouncements, type Announcement } from '@/lib/announcements';

export default function EmployeeAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    void getAnnouncements()
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]));
  }, []);

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">
              Tracko
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              Announcement history
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              All published updates from your HR and admin team.
            </p>
          </div>
          <Link
            href="/employee"
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-muted-foreground hover:text-foreground"
          >
            Back to employee panel
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {announcements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No announcements yet.
            </p>
          ) : (
            announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <h2 className="text-lg font-semibold text-foreground">
                  {announcement.title}
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {announcement.authorName ?? 'Admin'} ·{' '}
                  {new Date(announcement.createdAt).toLocaleString('en-PH')}
                </p>
                <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                  {announcement.body}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

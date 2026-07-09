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
    <div className="min-h-screen bg-background px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">
              Tracko
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              Announcement history
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              All published updates from your HR and admin team.
            </p>
          </div>
          <Link
            href="/employee"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Back to employee panel
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {announcements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
              No announcements yet.
            </p>
          ) : (
            announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <h2 className="text-lg font-semibold text-white">
                  {announcement.title}
                </h2>
                <p className="mt-2 text-xs text-slate-500">
                  {announcement.authorName ?? 'Admin'} ·{' '}
                  {new Date(announcement.createdAt).toLocaleString('en-PH')}
                </p>
                <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">
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

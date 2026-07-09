import { apiFetch } from './api';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorUserId: string;
  authorName: string | null;
  authorEmail: string | null;
};

export async function getAnnouncements(limit?: number): Promise<Announcement[]> {
  const params = new URLSearchParams();
  if (typeof limit === 'number' && limit > 0) {
    params.set('limit', String(limit));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/announcements${suffix}`);
}

export async function createAnnouncement(input: {
  title: string;
  body: string;
}): Promise<Announcement> {
  return apiFetch('/announcements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

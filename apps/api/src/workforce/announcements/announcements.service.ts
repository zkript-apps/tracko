import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { getMongoDb } from '../../database/mongo';
import { WorkforceContextService } from '../workforce-context.service';
import {
  createAnnouncement,
  listAnnouncementsByOrganization,
  type AnnouncementRecord,
} from './announcements.store';

function serializeAnnouncement(
  record: AnnouncementRecord,
  authorName?: string,
  authorEmail?: string,
) {
  return {
    id: record._id,
    title: record.title,
    body: record.body,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    authorUserId: record.authorUserId,
    authorName: authorName ?? null,
    authorEmail: authorEmail ?? null,
  };
}

@Injectable()
export class AnnouncementsService {
  constructor(private readonly workforce: WorkforceContextService) {}

  private async loadAuthors(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, { name?: string; email?: string }>();
    }

    const db = await getMongoDb();
    const users = await db
      .collection<{ _id: string; name?: string; email?: string }>('user')
      .find({ _id: { $in: userIds } })
      .toArray();

    return new Map(users.map((user) => [String(user._id), user]));
  }

  async create(request: Request, input: { title: string; body: string }) {
    const context = await this.workforce.getMemberContext(request);

    if (!context.isAdmin && !context.isHr) {
      throw new ForbiddenException('Organization admin or HR access required.');
    }

    if (!input.title?.trim()) {
      throw new BadRequestException('Announcement title is required.');
    }

    if (!input.body?.trim()) {
      throw new BadRequestException('Announcement body is required.');
    }

    if (input.title.trim().length > 120) {
      throw new BadRequestException('Announcement title must be 120 characters or less.');
    }

    if (input.body.trim().length > 2000) {
      throw new BadRequestException('Announcement body must be 2000 characters or less.');
    }

    const record = await createAnnouncement({
      organizationId: context.organizationId,
      authorUserId: context.userId,
      title: input.title,
      body: input.body,
    });

    const authorMap = await this.loadAuthors([context.userId]);
    const author = authorMap.get(context.userId);

    return serializeAnnouncement(record, author?.name, author?.email);
  }

  async list(request: Request, limit?: number) {
    const context = await this.workforce.getMemberContext(request);
    const records = await listAnnouncementsByOrganization(
      context.organizationId,
      limit,
    );
    const authorMap = await this.loadAuthors(records.map((record) => record.authorUserId));

    return records.map((record) => {
      const author = authorMap.get(record.authorUserId);
      return serializeAnnouncement(record, author?.name, author?.email);
    });
  }
}

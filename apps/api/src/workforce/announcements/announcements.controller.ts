import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AnnouncementsService } from './announcements.service';

class CreateAnnouncementDto {
  title!: string;
  body!: string;
}

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@Req() request: Request, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.announcements.list(
      request,
      Number.isInteger(parsedLimit) && parsedLimit! > 0 ? parsedLimit : undefined,
    );
  }

  @Post()
  create(@Req() request: Request, @Body() body: CreateAnnouncementDto) {
    return this.announcements.create(request, body);
  }
}

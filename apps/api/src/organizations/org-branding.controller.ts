import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Post,
  Put,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { OrgBrandingService } from './org-branding.service';
import { MAX_ORG_LOGO_BYTES } from './org-branding-files.util';
import { isOrgAppearanceEnabled } from '../config/feature-flags';

function requireAppearanceFeature() {
  if (!isOrgAppearanceEnabled()) {
    throw new ForbiddenException(
      'Organization appearance is disabled for this environment.',
    );
  }
}

@Controller('organization/branding')
export class OrgBrandingController {
  constructor(private readonly branding: OrgBrandingService) {}

  @Get()
  getBranding(@Req() request: Request) {
    return this.branding.getBranding(request);
  }

  @Put()
  updateBranding(
    @Req() request: Request,
    @Body()
    body: {
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
    },
  ) {
    requireAppearanceFeature();

    if (!body.primaryColor || !body.secondaryColor || !body.accentColor) {
      throw new BadRequestException(
        'Primary, secondary, and accent colors are required.',
      );
    }

    return this.branding.updateBranding(request, {
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      accentColor: body.accentColor,
    });
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ORG_LOGO_BYTES },
    }),
  )
  uploadLogo(
    @Req() request: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.branding.uploadLogo(request, file);
  }

  @Delete('logo')
  removeLogo(@Req() request: Request) {
    return this.branding.removeLogo(request);
  }

  @Get('logo')
  async getLogo(@Req() request: Request) {
    const file = await this.branding.getLogoFile(request);

    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: `inline; filename="${file.fileName}"`,
    });
  }
}

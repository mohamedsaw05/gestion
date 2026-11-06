import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { FilesService } from './files.service.js';
import { FileListFilterDto, UploadMetadataDto } from './dto/file.dto.js';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.FILES_READ)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: FileListFilterDto) {
    return this.files.listFiles(user.tenantId, query);
  }

  @Get('storage/usage')
  @RequirePermission(PERMISSIONS.FILES_READ)
  storageUsage(@CurrentUser() user: AuthenticatedUser) {
    return this.files.getStorageUsage(user.tenantId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.FILES_READ)
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.files.getFile(user.tenantId, id);
  }

  @Get(':id/download')
  @RequirePermission(PERMISSIONS.FILES_READ)
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.files.getFile(user.tenantId, id);
    if (!fs.existsSync(file.storagePath)) {
      res.status(404).json({ message: 'Fichier physique introuvable sur le disque' });
      return;
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Length', file.sizeBytes);

    const stream = fs.createReadStream(file.storagePath);
    stream.pipe(res);
  }

  @Post('upload')
  @RequirePermission(PERMISSIONS.FILES_UPLOAD)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: any,
    @Body() meta: UploadMetadataDto,
  ) {
    return this.files.saveUploadedFile(user.tenantId, user.userId, file, meta);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.FILES_DELETE)
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.files.deleteFile(user.tenantId, id);
  }
}

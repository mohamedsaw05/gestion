import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { ConfigurationModule } from '../config/config.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [RbacModule, ConfigurationModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

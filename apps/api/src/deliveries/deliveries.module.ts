import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { DeliveriesController } from './deliveries.controller.js';
import { DeliveriesService } from './deliveries.service.js';

@Module({
  imports: [RbacModule, DocumentsModule],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
})
export class DeliveriesModule {}

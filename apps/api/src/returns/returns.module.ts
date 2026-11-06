import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { CreditModule } from '../credit/credit.module.js';
import { ReturnsController } from './returns.controller.js';
import { ReturnsService } from './returns.service.js';

@Module({
  imports: [RbacModule, InventoryModule, DocumentsModule, CreditModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}

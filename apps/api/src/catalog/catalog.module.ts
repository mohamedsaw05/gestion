import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [RbacModule, BusinessProfileModule, InventoryModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { ConfigurationModule } from '../config/config.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SuppliersController } from './suppliers.controller.js';
import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { SuppliersService } from './suppliers.service.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

@Module({
  imports: [RbacModule, ConfigurationModule, InventoryModule],
  controllers: [SuppliersController, PurchaseOrdersController],
  providers: [SuppliersService, PurchaseOrdersService],
})
export class SuppliersModule {}

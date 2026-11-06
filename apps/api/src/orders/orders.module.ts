import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { UnitsModule } from '../units/units.module.js';
import { ConfigurationModule } from '../config/config.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [RbacModule, PricingModule, UnitsModule, ConfigurationModule, SalesModule, InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}

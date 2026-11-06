import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { ConfigurationModule } from '../config/config.module.js';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { StockTransfersController } from './stock-transfers.controller.js';
import { StockTransfersService } from './stock-transfers.service.js';

@Module({
  imports: [RbacModule, ConfigurationModule, BusinessProfileModule],
  controllers: [InventoryController, StockTransfersController],
  providers: [InventoryService, StockTransfersService],
  exports: [InventoryService],
})
export class InventoryModule {}

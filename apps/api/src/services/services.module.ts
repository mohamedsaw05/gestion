import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';

@Module({
  imports: [RbacModule, BusinessProfileModule, InventoryModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}

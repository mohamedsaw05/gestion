import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { CreditModule } from '../credit/credit.module.js';
import { ConfigurationModule } from '../config/config.module.js';
import { UnitsModule } from '../units/units.module.js';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import { HeldCartsService } from './held-carts.service.js';

@Module({
  imports: [
    RbacModule,
    DocumentsModule,
    PricingModule,
    CreditModule,
    ConfigurationModule,
    UnitsModule,
    BusinessProfileModule,
    InventoryModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, HeldCartsService],
  exports: [SalesService, HeldCartsService],
})
export class SalesModule {}

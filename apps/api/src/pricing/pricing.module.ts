import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';

@Module({
  imports: [RbacModule, BusinessProfileModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}

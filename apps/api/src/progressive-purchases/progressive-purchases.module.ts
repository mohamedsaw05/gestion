import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { ProgressivePurchasesController } from './progressive-purchases.controller.js';
import { ProgressivePurchasesService } from './progressive-purchases.service.js';

@Module({ imports: [ConfigurationModule, SalesModule, PricingModule], controllers: [ProgressivePurchasesController], providers: [ProgressivePurchasesService] })
export class ProgressivePurchasesModule {}

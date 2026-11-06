import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { QuarantineController } from './quarantine.controller.js';
import { QuarantineService } from './quarantine.service.js';

@Module({
  imports: [InventoryModule],
  controllers: [QuarantineController],
  providers: [QuarantineService],
  exports: [QuarantineService],
})
export class QuarantineModule {}

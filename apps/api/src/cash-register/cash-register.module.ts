import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { CashRegisterController } from './cash-register.controller.js';
import { CashRegisterService } from './cash-register.service.js';

@Module({
  imports: [RbacModule],
  controllers: [CashRegisterController],
  providers: [CashRegisterService],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}

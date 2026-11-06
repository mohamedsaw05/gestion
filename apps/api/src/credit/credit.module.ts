import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { ConfigurationModule } from '../config/config.module.js';
import { CreditController } from './credit.controller.js';
import { CreditService } from './credit.service.js';

@Module({
  imports: [RbacModule, ConfigurationModule],
  controllers: [CreditController],
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditModule {}

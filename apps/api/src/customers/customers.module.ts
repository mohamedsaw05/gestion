import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [RbacModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}

import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';

@Module({
  imports: [CommonModule, BusinessProfileModule, RbacModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}

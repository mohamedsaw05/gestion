import { Module } from '@nestjs/common';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { RbacService } from './rbac.service.js';

@Module({
  imports: [BusinessProfileModule],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}

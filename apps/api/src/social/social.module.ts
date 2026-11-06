import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { SocialController } from './social.controller.js';
import { SocialService } from './social.service.js';
import { SocialComplianceService } from './social-compliance.service.js';

@Module({
  imports: [RbacModule, BusinessProfileModule],
  controllers: [SocialController],
  providers: [SocialService, SocialComplianceService],
  exports: [SocialService, SocialComplianceService],
})
export class SocialModule {}

import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { UsersModule } from '../users/users.module.js';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { ConfigurationModule } from '../config/config.module.js';
import { MeController } from './me.controller.js';

@Module({
  imports: [RbacModule, UsersModule, BusinessProfileModule, ConfigurationModule],
  controllers: [MeController],
})
export class MeModule {}

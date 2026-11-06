import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { ConfigController } from './config.controller.js';
import { ConfigurationService } from './config.service.js';

@Module({
  imports: [RbacModule],
  controllers: [ConfigController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}

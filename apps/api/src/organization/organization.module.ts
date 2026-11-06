import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller.js';
import { OrganizationController } from './organization.controller.js';

@Module({
  controllers: [LocationsController, OrganizationController],
})
export class OrganizationModule {}

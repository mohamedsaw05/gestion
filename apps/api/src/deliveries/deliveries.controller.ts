import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { DeliveriesService } from './deliveries.service.js';
import { CreateDeliveryDto } from './dto/create-delivery.dto.js';
import { FailDeliveryDto } from './dto/fail-delivery.dto.js';
import { CancelDeliveryDto } from './dto/cancel-delivery.dto.js';

@Controller('deliveries')
@RequireCapability(CAPABILITIES.DELIVERY)
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.DELIVERIES_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.deliveries.list(user.tenantId, user.userId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.DELIVERIES_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.deliveries.getById(user.tenantId, user.userId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.DELIVERIES_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeliveryDto) {
    return this.deliveries.create(user.tenantId, user.userId, dto);
  }

  @Post(':id/out-for-delivery')
  @RequirePermission(PERMISSIONS.DELIVERIES_UPDATE)
  markOutForDelivery(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.deliveries.markOutForDelivery(user.tenantId, user.userId, id);
  }

  @Post(':id/delivered')
  @RequirePermission(PERMISSIONS.DELIVERIES_UPDATE)
  markDelivered(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.deliveries.markDelivered(user.tenantId, user.userId, id);
  }

  @Post(':id/failed')
  @RequirePermission(PERMISSIONS.DELIVERIES_UPDATE)
  markFailed(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: FailDeliveryDto) {
    return this.deliveries.markFailed(user.tenantId, user.userId, id, dto.reason);
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.DELIVERIES_CANCEL)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CancelDeliveryDto) {
    return this.deliveries.cancel(user.tenantId, user.userId, id, dto.reason);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { DepositOrderDto } from './dto/deposit-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { CompleteOrderDto } from './dto/complete-order.dto.js';

@Controller('orders')
@RequireCapability(CAPABILITIES.ORDERS)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ORDERS_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.list(user.tenantId, user.userId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ORDERS_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.getById(user.tenantId, user.userId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ORDERS_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.tenantId, user.userId, dto);
  }

  @Post(':id/advance')
  @RequirePermission(PERMISSIONS.ORDERS_UPDATE)
  advance(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.advance(user.tenantId, user.userId, id);
  }

  @Post(':id/deposit')
  @RequirePermission(PERMISSIONS.ORDERS_UPDATE)
  deposit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: DepositOrderDto) {
    return this.orders.recordDeposit(user.tenantId, user.userId, id, dto.amount, dto.method);
  }

  @Post(':id/complete')
  @RequirePermission(PERMISSIONS.ORDERS_UPDATE)
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CompleteOrderDto) {
    return this.orders.complete(user.tenantId, user.userId, id, dto.payments);
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.ORDERS_CANCEL)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancel(user.tenantId, user.userId, id, dto.reason);
  }
}

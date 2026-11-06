import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto.js';
import { CancelPurchaseOrderDto } from './dto/cancel-purchase-order.dto.js';

@Controller('purchase-orders')
@RequireCapability(CAPABILITIES.PURCHASES)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PURCHASES_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrders.list(user.tenantId, user.userId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PURCHASES_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.purchaseOrders.getById(user.tenantId, user.userId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PURCHASES_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrders.create(user.tenantId, user.userId, dto);
  }

  @Post(':id/confirm')
  @RequirePermission(PERMISSIONS.PURCHASES_UPDATE)
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.purchaseOrders.confirm(user.tenantId, user.userId, id);
  }

  @Post(':id/receive')
  @RequirePermission(PERMISSIONS.PURCHASES_UPDATE)
  receive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.purchaseOrders.receive(user.tenantId, user.userId, id, dto.lines);
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.PURCHASES_CANCEL)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CancelPurchaseOrderDto) {
    return this.purchaseOrders.cancel(user.tenantId, user.userId, id, dto.reason);
  }
}

import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { SalesService } from './sales.service.js';
import { HeldCartsService, type SaveHeldCartDto } from './held-carts.service.js';

@Controller('sales')
export class SalesController {
  constructor(
    private readonly sales: SalesService,
    private readonly heldCarts: HeldCartsService,
  ) {}

  @Get('held-carts')
  @RequirePermission(PERMISSIONS.SALES_READ)
  listHeldCarts(@CurrentUser() user: AuthenticatedUser, @Query('locationId') locationId?: string) {
    return this.heldCarts.list(user.tenantId, locationId);
  }

  @Post('held-carts')
  @RequirePermission(PERMISSIONS.SALES_CREATE)
  createHeldCart(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveHeldCartDto) {
    return this.heldCarts.create(user.tenantId, user.userId, dto);
  }

  @Delete('held-carts/:id')
  @RequirePermission(PERMISSIONS.SALES_CREATE)
  deleteHeldCart(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.heldCarts.delete(user.tenantId, id);
  }

  @Post('held-carts/:id/resume')
  @RequirePermission(PERMISSIONS.SALES_CREATE)
  resumeHeldCart(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.heldCarts.resume(user.tenantId, id, user.userId);
  }

  @Get()
  @RequirePermission(PERMISSIONS.SALES_READ)
  list(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    if (limit !== undefined && !/^\d+$/.test(limit)) {
      throw new BadRequestException('Le paramètre limit doit être un entier positif.');
    }
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    return this.sales.list(user.tenantId, user.userId, parsedLimit);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.SALES_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sales.getById(user.tenantId, user.userId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.SALES_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSaleDto) {
    return this.sales.create(user.tenantId, user.userId, dto);
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.SALES_CANCEL)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.sales.cancel(user.tenantId, user.userId, id, body?.reason);
  }
}

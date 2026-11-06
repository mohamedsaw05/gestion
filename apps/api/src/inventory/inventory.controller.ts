import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { ReconcileInventoryDto } from './dto/reconcile-inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Pas de @RequireCapability ici : la liste des emplacements est une notion
  // organisationnelle nécessaire à TOUTE vente, indépendante du suivi de
  // stock (cf LocationsController pour la même logique côté /locations).
  @Get('locations')
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_READ)
  listLocations(@CurrentUser() user: AuthenticatedUser) {
    return this.inventory.listLocations(user.tenantId);
  }

  @Get('stock')
  @RequireCapability(CAPABILITIES.INVENTORY)
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_READ)
  getStock(@CurrentUser() user: AuthenticatedUser, @Query('locationId') locationId: string) {
    return this.inventory.getStock(user.tenantId, locationId);
  }

  @Post('adjust')
  @RequireCapability(CAPABILITIES.INVENTORY)
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_ADJUST)
  adjust(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdjustStockDto) {
    return this.inventory.adjust(user.tenantId, user.userId, dto);
  }

  @Get('movements')
  @RequireCapability(CAPABILITIES.INVENTORY)
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_READ)
  listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId?: string,
    @Query('productId') productId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.inventory.listMovements(user.tenantId, {
      locationId,
      productId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('reconcile')
  @RequireCapability(CAPABILITIES.INVENTORY)
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_ADJUST)
  reconcile(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReconcileInventoryDto) {
    return this.inventory.reconcileInventory(user.tenantId, user.userId, dto);
  }

  @Get('valuation')
  @RequireCapability(CAPABILITIES.INVENTORY)
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_READ)
  getValuation(@CurrentUser() user: AuthenticatedUser, @Query('locationId') locationId?: string) {
    return this.inventory.getStockValuation(user.tenantId, locationId);
  }
}


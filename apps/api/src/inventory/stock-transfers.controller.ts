import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { StockTransfersService } from './stock-transfers.service.js';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto.js';
import { CancelStockTransferDto } from './dto/cancel-stock-transfer.dto.js';

/**
 * Un transfert n'a de sens que si le tenant utilise ET le stock ET plusieurs
 * emplacements — pas de capability dédiée : les deux capabilities existantes
 * suffisent, en ajouter une troisième purement pour ce contrôleur serait
 * décoratif (cf commentaire du modèle StockTransfer).
 */
@Controller('stock-transfers')
@RequireCapability(CAPABILITIES.INVENTORY)
export class StockTransfersController {
  constructor(private readonly transfers: StockTransfersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.transfers.list(user.tenantId, user.userId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transfers.getById(user.tenantId, user.userId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.INVENTORY_TRANSFER_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStockTransferDto) {
    return this.transfers.create(user.tenantId, user.userId, dto);
  }

  @Post(':id/confirm')
  @RequirePermission(PERMISSIONS.INVENTORY_TRANSFER_CREATE)
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transfers.confirm(user.tenantId, user.userId, id);
  }

  @Post(':id/receive')
  @RequirePermission(PERMISSIONS.INVENTORY_TRANSFER_CREATE)
  receive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transfers.receive(user.tenantId, user.userId, id);
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.INVENTORY_TRANSFER_CREATE)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CancelStockTransferDto) {
    return this.transfers.cancel(user.tenantId, user.userId, id, dto.reason);
  }
}

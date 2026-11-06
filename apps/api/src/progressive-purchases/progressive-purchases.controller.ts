import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { streamReceiptPdf, type ReceiptContent } from '../documents/receipt-pdf.js';
import { CreateProgressivePurchaseDto } from './dto/create-progressive-purchase.dto.js';
import { RecordProgressiveDepositDto } from './dto/record-progressive-deposit.dto.js';
import { RefundProgressiveDto } from './dto/refund-progressive.dto.js';
import { SelectProgressiveProductDto } from './dto/select-progressive-product.dto.js';
import { ProgressivePurchasesService } from './progressive-purchases.service.js';

@Controller('progressive-purchases')
@RequireCapability(CAPABILITIES.PROGRESSIVE_PURCHASES)
export class ProgressivePurchasesController {
  constructor(private readonly purchases: ProgressivePurchasesService) {}

  @Get('stats')
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_READ)
  stats(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : undefined;
    return this.purchases.stats(user.tenantId, fromDate, toDate);
  }

  @Get()
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_READ)
  list(@CurrentUser() user: AuthenticatedUser, @Query('q') query?: string) { return this.purchases.list(user.tenantId, query); }

  @Post()
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProgressivePurchaseDto) { return this.purchases.create(user.tenantId, user.userId, dto); }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.purchases.getById(user.tenantId, id); }

  @Post(':id/deposits')
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_DEPOSIT)
  deposit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RecordProgressiveDepositDto) { return this.purchases.deposit(user.tenantId, user.userId, id, dto); }

  @Post(':id/product')
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_MANAGE)
  selectProduct(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SelectProgressiveProductDto) { return this.purchases.selectProduct(user.tenantId, id, dto.productId); }

  @Post(':id/redeem')
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_REDEEM)
  redeem(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.purchases.redeem(user.tenantId, user.userId, id); }

  @Post(':id/refunds')
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_REFUND)
  refund(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RefundProgressiveDto) { return this.purchases.refund(user.tenantId, user.userId, id, dto); }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_MANAGE)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.purchases.cancel(user.tenantId, id); }

  @Get('receipts/:movementId/pdf')
  @RequirePermission(PERMISSIONS.PROGRESSIVE_PURCHASES_READ)
  async receipt(@CurrentUser() user: AuthenticatedUser, @Param('movementId') movementId: string, @Res() res: Response) {
    const snapshot = await this.purchases.getMovementReceipt(user.tenantId, movementId);
    streamReceiptPdf(snapshot as unknown as ReceiptContent, res, 'RECEIPT');
  }
}

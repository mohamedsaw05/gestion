import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { CashRegisterService } from './cash-register.service.js';
import { CloseCashSessionDto, OpenCashSessionDto, RecordCashMovementDto } from './dto/open-session.dto.js';

@Controller('cash')
export class CashRegisterController {
  constructor(private readonly cash: CashRegisterService) {}

  @Get('sessions/current')
  @RequirePermission(PERMISSIONS.CASH_SESSION_READ)
  async current(@CurrentUser() user: AuthenticatedUser, @Query('locationId') locationId: string) {
    // Enveloppé dans { session } : un contrôleur Nest qui renvoie littéralement
    // `null` produit un corps de réponse VIDE (pas la chaîne "null"), ce qui
    // casse tout client faisant `res.json()` — piège rencontré et corrigé ici.
    return { session: await this.cash.getCurrentSession(user.tenantId, locationId) };
  }

  @Get('sessions')
  @RequirePermission(PERMISSIONS.CASH_SESSION_READ)
  list(@CurrentUser() user: AuthenticatedUser, @Query('locationId') locationId?: string) {
    return this.cash.listSessions(user.tenantId, locationId);
  }

  @Get('sessions/:id')
  @RequirePermission(PERMISSIONS.CASH_SESSION_READ)
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cash.getSessionDetail(user.tenantId, user.userId, id);
  }

  @Post('sessions/open')
  @RequirePermission(PERMISSIONS.CASH_SESSION_MANAGE)
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenCashSessionDto) {
    return this.cash.openSession(user.tenantId, user.userId, dto.locationId, dto.openingFloat, dto.notes);
  }

  @Post('sessions/:id/close')
  @RequirePermission(PERMISSIONS.CASH_SESSION_MANAGE)
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CloseCashSessionDto) {
    return this.cash.closeSession(user.tenantId, user.userId, id, dto.countedAmount, dto.notes);
  }

  @Post('sessions/:id/movements')
  @RequirePermission(PERMISSIONS.CASH_SESSION_MANAGE)
  addMovement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RecordCashMovementDto) {
    return this.cash.recordMovement(user.tenantId, user.userId, id, dto.type, dto.amount, dto.reason);
  }
}

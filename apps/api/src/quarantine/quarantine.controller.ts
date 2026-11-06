import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { QuarantineService } from './quarantine.service.js';
import { QuarantineOperationDto } from './dto/quarantine-operation.dto.js';

@Controller('quarantine')
export class QuarantineController {
  constructor(private readonly quarantine: QuarantineService) {}

  @Get('stock')
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_READ)
  listStock(@CurrentUser() user: AuthenticatedUser, @Query('locationId') locationId?: string) {
    return this.quarantine.listStock(user.tenantId, locationId);
  }

  @Post('operations')
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_ADJUST)
  performOperation(@CurrentUser() user: AuthenticatedUser, @Body() dto: QuarantineOperationDto) {
    return this.quarantine.performOperation(user.tenantId, user.userId, dto);
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { ReturnsService } from './returns.service.js';
import { CreateReturnDto } from './dto/create-return.dto.js';

@Controller('returns')
@RequireCapability(CAPABILITIES.RETURNS)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.RETURNS_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.returns.list(user.tenantId, user.userId);
  }

  @Get('eligible-lines')
  @RequirePermission(PERMISSIONS.RETURNS_READ)
  getEligibleLines(@CurrentUser() user: AuthenticatedUser, @Query('saleId') saleId: string) {
    return this.returns.getEligibleLines(user.tenantId, saleId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.RETURNS_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.returns.getById(user.tenantId, user.userId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.RETURNS_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReturnDto) {
    return this.returns.create(user.tenantId, user.userId, dto);
  }
}

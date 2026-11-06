import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS, CAPABILITIES } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { WarrantiesService } from './warranties.service.js';
import { ClaimWarrantyDto } from './dto/claim-warranty.dto.js';
import { CreateWarrantyDto } from './dto/create-warranty.dto.js';
import { UpdateWarrantyConfigurationDto } from './dto/update-warranty-configuration.dto.js';

@Controller('warranties')
@RequireCapability(CAPABILITIES.WARRANTIES)
export class WarrantiesController {
  constructor(private readonly warranties: WarrantiesService) {}

  @Get('configuration')
  @RequirePermission(PERMISSIONS.WARRANTIES_READ)
  configuration(@CurrentUser() user: AuthenticatedUser) { return this.warranties.getConfiguration(user.tenantId); }

  @Put('configuration')
  @RequirePermission(PERMISSIONS.WARRANTIES_MANAGE)
  updateConfiguration(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateWarrantyConfigurationDto) { return this.warranties.updateConfiguration(user.tenantId, user.userId, dto); }

  @Get('stats')
  @RequirePermission(PERMISSIONS.WARRANTIES_READ)
  stats(@CurrentUser() user: AuthenticatedUser) { return this.warranties.stats(user.tenantId); }

  @Get()
  @RequirePermission(PERMISSIONS.WARRANTIES_READ)
  list(@CurrentUser() user: AuthenticatedUser, @Query('q') query?: string) {
    return this.warranties.list(user.tenantId, query);
  }

  @Post()
  @RequirePermission(PERMISSIONS.WARRANTIES_MANAGE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWarrantyDto) {
    return this.warranties.create(user.tenantId, user.userId, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.WARRANTIES_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.warranties.getById(user.tenantId, id);
  }

  @Post(':id/claim')
  @RequirePermission(PERMISSIONS.WARRANTIES_CLAIM)
  claim(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ClaimWarrantyDto) {
    return this.warranties.claim(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/repair')
  @RequirePermission(PERMISSIONS.WARRANTIES_CLAIM)
  repair(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ClaimWarrantyDto) {
    return this.warranties.setClaimStatus(user.tenantId, user.userId, id, 'IN_REPAIR', dto);
  }

  @Post(':id/close')
  @RequirePermission(PERMISSIONS.WARRANTIES_CLAIM)
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ClaimWarrantyDto) {
    return this.warranties.setClaimStatus(user.tenantId, user.userId, id, 'CLOSED', dto);
  }
}

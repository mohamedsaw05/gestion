import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { PlatformAdminGuard, type PlatformAdminContext } from './guards/platform-admin.guard.js';
import { CurrentPlatformAdmin } from './decorators/current-platform-admin.decorator.js';
import { PlatformTenantsService } from './platform-tenants.service.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';
import { ResetPlatformDto } from './dto/reset-platform.dto.js';
import { ResetTenantPlatformDto } from './dto/reset-tenant-platform.dto.js';

@Controller('platform')
@Public()
@UseGuards(PlatformAdminGuard)
export class PlatformTenantsController {
  constructor(private readonly tenants: PlatformTenantsService) {}

  @Get('stats')
  getStats() {
    return this.tenants.getPlatformStats();
  }

  @Get('diagnostics')
  getDiagnostics() {
    return this.tenants.getPlatformDiagnostics();
  }

  @Get('error-catalog')
  getErrorCatalog(
    @Query('query') query?: string,
    @Query('domain') domain?: string,
    @Query('severity') severity?: string,
  ) {
    return this.tenants.getErrorCatalog(query, domain, severity);
  }

  @Get('tenants')
  listTenants() {
    return this.tenants.listTenants();
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.tenants.createTenant(dto);
  }

  @Patch('tenants/:id')
  updateTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenants.updateTenant(id, dto);
  }

  @Post('tenants/:id/suspend')
  suspendTenant(@Param('id', ParseUUIDPipe) id: string, @Body('reason') reason?: string) {
    return this.tenants.suspendTenant(id, reason);
  }

  @Post('tenants/:id/reactivate')
  reactivateTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.reactivateTenant(id);
  }

  @Get('tenants/:id/reset-preview')
  getTenantResetPreview(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.getTenantResetPreview(id);
  }

  @Get('tenants/:id/backup')
  async exportTenantBackup(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const backup = await this.tenants.exportTenantBackup(id);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `vtm-backup-${backup.tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${dateStr}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(backup, null, 2));
  }

  @Post('tenants/:id/reset')
  resetSingleTenant(
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetTenantPlatformDto,
  ) {
    return this.tenants.resetSingleTenantOperationalData(admin.id, id, dto);
  }

  @Post('reset-all')
  resetAllPlatform(
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
    @Body() dto: ResetPlatformDto,
  ) {
    return this.tenants.resetAllPlatform(admin.id, dto);
  }
}

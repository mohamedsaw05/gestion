import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { DiagnosticsService } from './diagnostics.service.js';
import { RunRepairDto, RunScanDto } from './dto/diagnostic.dto.js';

@Controller('diagnostics')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get('scans')
  @RequirePermission(PERMISSIONS.DIAGNOSTICS_RUN)
  listScans(@CurrentUser() user: AuthenticatedUser) {
    return this.diagnostics.listScans(user.tenantId);
  }

  @Get('scans/:id')
  @RequirePermission(PERMISSIONS.DIAGNOSTICS_RUN)
  getScanDetail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.diagnostics.getScanDetail(user.tenantId, id);
  }

  @Post('scan')
  @RequirePermission(PERMISSIONS.DIAGNOSTICS_RUN)
  runScan(@CurrentUser() user: AuthenticatedUser, @Body() dto: RunScanDto) {
    return this.diagnostics.executeScan(user.tenantId, user.userId, dto);
  }

  @Post('repair')
  @RequirePermission(PERMISSIONS.DIAGNOSTICS_RUN)
  runRepair(@CurrentUser() user: AuthenticatedUser, @Body() dto: RunRepairDto) {
    return this.diagnostics.executeRepair(user.tenantId, user.userId, dto);
  }
}

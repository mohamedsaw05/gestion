import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { ConfigurationService } from './config.service.js';
import { UpdateSettingDto } from './dto/update-setting.dto.js';

@Controller('settings')
export class ConfigController {
  constructor(private readonly config: ConfigurationService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.config.getAll(user.tenantId);
  }

  @Get('catalog')
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  getCatalog() {
    return this.config.getCatalog();
  }

  @Put(':key')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  set(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.config.set(user.tenantId, key, dto.value);
  }

  // ── Résolution hiérarchique par emplacement (Phase 8.1) ──

  @Get('locations/:locationId')
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  getEffectiveForLocation(@CurrentUser() user: AuthenticatedUser, @Param('locationId') locationId: string) {
    return this.config.getAllEffectiveForLocation(user.tenantId, locationId);
  }

  @Put('locations/:locationId/:key')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  setForLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('locationId') locationId: string,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.config.setForLocation(user.tenantId, locationId, key, dto.value);
  }
}

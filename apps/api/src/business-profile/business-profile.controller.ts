import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { BUSINESS_TYPES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { BusinessProfileService } from './business-profile.service.js';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto.js';
import { SetCapabilityDto } from './dto/set-capability.dto.js';

/**
 * Gestion du profil du commerce — même permission que le Configuration
 * Engine (SETTINGS_READ/SETTINGS_MANAGE) : c'est conceptuellement la même
 * responsabilité administrative, pas une nouvelle catégorie de permission.
 */
@Controller('business-profile')
export class BusinessProfileController {
  constructor(private readonly businessProfile: BusinessProfileService) {}

  @Get('context')
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  async getContext(@CurrentUser() user: AuthenticatedUser) {
    const [profile, capabilities, modules] = await Promise.all([
      this.businessProfile.getProfile(user.tenantId),
      this.businessProfile.getResolvedCapabilities(user.tenantId),
      this.businessProfile.getResolvedModules(user.tenantId),
    ]);
    return { profile, capabilities, modules };
  }

  @Get('catalog')
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  getCatalog() {
    return {
      businessTypes: BUSINESS_TYPES,
      capabilities: this.businessProfile.getCapabilitiesCatalog(),
      modules: this.businessProfile.getModulesCatalog(),
    };
  }

  @Put('capabilities/:key')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  setCapability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: SetCapabilityDto,
  ) {
    return this.businessProfile.setCapability(user.tenantId, user.userId, key, dto.enabled);
  }

  @Put('modules/:key')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  setModule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: SetCapabilityDto,
  ) {
    return this.businessProfile.setModule(user.tenantId, user.userId, key, dto.enabled);
  }

  @Put('onboarding')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  completeOnboarding(@CurrentUser() user: AuthenticatedUser, @Body() dto: CompleteOnboardingDto) {
    return this.businessProfile.completeOnboarding(
      user.tenantId,
      user.userId,
      dto.businessType,
      dto.capabilities,
      dto.modules,
    );
  }
}

import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { MODULES_CATALOG } from '@gestionnaire/db';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentPlatformAdmin } from './decorators/current-platform-admin.decorator.js';
import { PlatformAdminGuard, type PlatformAdminContext } from './guards/platform-admin.guard.js';

class SetPlatformTenantModuleDto { @IsBoolean() enabled!: boolean; }

@Controller('platform/tenants/:tenantId/modules')
@Public()
@UseGuards(PlatformAdminGuard)
export class PlatformTenantModulesController {
  constructor(private readonly platform: PlatformPrismaService, private readonly businessProfile: BusinessProfileService) {}

  @Get()
  async get(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    const subscription = await this.platform.client.platformSubscription.findUnique({ where: { tenantId }, include: { plan: true } });
    if (!subscription) throw new BadRequestException('Abonnement de cette organisation introuvable.');
    const modules = await this.businessProfile.getResolvedModules(tenantId);
    return {
      planKey: subscription.plan.key,
      allowedCapabilities: subscription.plan.allowedCapabilities,
      modules: MODULES_CATALOG.map((definition) => ({
        ...definition,
        ...(modules.find((module) => module.key === definition.key) ?? { enabled: definition.category === 'CORE' || definition.category === 'AUTOMATIC' }),
        availableOnPlan: !definition.requiresCapability || subscription.plan.allowedCapabilities.includes(definition.requiresCapability),
      })),
    };
  }

  @Put(':key')
  async set(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('key') key: string,
    @Body() dto: SetPlatformTenantModuleDto,
    @CurrentPlatformAdmin() admin: PlatformAdminContext,
  ) {
    const definition = MODULES_CATALOG.find((module) => module.key === key);
    if (!definition) throw new BadRequestException(`Module inconnu : ${key}`);
    const subscription = await this.platform.client.platformSubscription.findUnique({ where: { tenantId }, include: { plan: true } });
    if (!subscription) throw new BadRequestException('Abonnement de cette organisation introuvable.');
    if (dto.enabled && definition.requiresCapability && !subscription.plan.allowedCapabilities.includes(definition.requiresCapability)) {
      throw new BadRequestException(`Le module « ${definition.label} » n’est pas inclus dans le plan ${subscription.plan.name}.`);
    }
    return this.businessProfile.setModule(tenantId, admin.id, key, dto.enabled);
  }
}

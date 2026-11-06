import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlatformAuthController } from './platform-auth.controller.js';
import { PlatformAuthService } from './platform-auth.service.js';
import { PlatformTenantsController } from './platform-tenants.controller.js';
import { PlatformTenantsService } from './platform-tenants.service.js';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller.js';
import { PlatformSubscriptionsService } from './platform-subscriptions.service.js';
import { PlatformWebhooksController } from './platform-webhooks.controller.js';
import { PlatformWebhooksService } from './platform-webhooks.service.js';
import { TenantSubscriptionController } from './tenant-subscription.controller.js';
import { PlatformFestiveWheelController } from './platform-festive-wheel.controller.js';
import { PlatformFestiveWheelService } from './platform-festive-wheel.service.js';
import { PlatformAdminGuard } from './guards/platform-admin.guard.js';
import { CommercialSettingsService } from './commercial-settings.service.js';
import { PlatformCommercialSettingsController, PublicCommercialSettingsController } from './commercial-settings.controller.js';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { PlatformTenantModulesController } from './platform-tenant-modules.controller.js';

@Module({
  imports: [
    BusinessProfileModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-access-secret-change-me',
      signOptions: { expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as any },
    }),
  ],
  controllers: [
    PlatformAuthController,
    PlatformTenantsController,
    PlatformSubscriptionsController,
    PlatformWebhooksController,
    TenantSubscriptionController,
    PlatformFestiveWheelController,
    PlatformCommercialSettingsController,
    PublicCommercialSettingsController,
    PlatformTenantModulesController,
  ],
  providers: [
    PlatformAuthService,
    PlatformTenantsService,
    PlatformSubscriptionsService,
    PlatformWebhooksService,
    PlatformFestiveWheelService,
    PlatformAdminGuard,
    CommercialSettingsService,
  ],
  exports: [
    PlatformAuthService,
    PlatformTenantsService,
    PlatformSubscriptionsService,
    PlatformWebhooksService,
    PlatformFestiveWheelService,
    CommercialSettingsService,
  ],
})
export class PlatformModule {}

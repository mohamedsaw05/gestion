import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { PricingService } from './pricing.service.js';
import { UpsertCustomerOverrideDto } from './dto/upsert-customer-override.dto.js';
import { CreateQuantityTierDto } from './dto/create-quantity-tier.dto.js';

@Controller('pricing')
@RequireCapability(CAPABILITIES.CUSTOM_PRICING)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('customer-overrides')
  @RequirePermission(PERMISSIONS.PRICING_MANAGE)
  listCustomerOverrides(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
  ) {
    return this.pricing.listCustomerOverrides(user.tenantId, customerId);
  }

  @Post('customer-overrides')
  @RequirePermission(PERMISSIONS.PRICING_MANAGE)
  upsertCustomerOverride(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCustomerOverrideDto) {
    return this.pricing.upsertCustomerOverride(user.tenantId, dto.customerId, dto.productId, dto.price);
  }

  @Delete('customer-overrides/:id')
  @RequirePermission(PERMISSIONS.PRICING_MANAGE)
  deleteCustomerOverride(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pricing.deleteCustomerOverride(user.tenantId, id);
  }

  @Get('quantity-tiers')
  @RequirePermission(PERMISSIONS.PRICING_MANAGE)
  listQuantityTiers(@CurrentUser() user: AuthenticatedUser, @Query('productId') productId?: string) {
    return this.pricing.listQuantityTiers(user.tenantId, productId);
  }

  @Post('quantity-tiers')
  @RequirePermission(PERMISSIONS.PRICING_MANAGE)
  createQuantityTier(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQuantityTierDto) {
    return this.pricing.createQuantityTier(user.tenantId, dto.productId, dto.minQuantity, dto.price);
  }

  @Delete('quantity-tiers/:id')
  @RequirePermission(PERMISSIONS.PRICING_MANAGE)
  deleteQuantityTier(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pricing.deleteQuantityTier(user.tenantId, id);
  }
}

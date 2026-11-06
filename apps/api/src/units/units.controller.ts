import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { UnitsService } from './units.service.js';
import { CreateProductUnitDto } from './dto/create-product-unit.dto.js';

@Controller('units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listForProduct(@CurrentUser() user: AuthenticatedUser, @Query('productId') productId: string) {
    return this.units.listForProduct(user.tenantId, productId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductUnitDto) {
    return this.units.create(user.tenantId, dto.productId, dto.unit, dto.factor);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.units.delete(user.tenantId, id);
  }
}

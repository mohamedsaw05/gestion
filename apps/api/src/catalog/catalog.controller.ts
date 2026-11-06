import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { CatalogService } from './catalog.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { AddBarcodeDto } from './dto/add-barcode.dto.js';
import { AddBundleComponentDto } from './dto/add-bundle-component.dto.js';
import { AddVariantDto } from './dto/add-variant.dto.js';
import { RegisterSerialNumbersDto } from './dto/register-serial-numbers.dto.js';
import { SetWarrantyPolicyDto } from './dto/set-warranty-policy.dto.js';
import { RegisterBatchDto } from './dto/register-batch.dto.js';
import { ImportProductsDto } from './dto/import-products.dto.js';
import { AddProductAliasDto } from './dto/add-alias.dto.js';

@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalog.list(
      user.tenantId,
      locationId,
      search,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  // ── Alias de recherche ──

  @Get(':id/aliases')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listAliases(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.listAliases(user.tenantId, id);
  }

  @Post(':id/aliases')
  @RequirePermission(PERMISSIONS.CATALOG_ALIASES_MANAGE)
  addAlias(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddProductAliasDto,
  ) {
    return this.catalog.addAlias(user.tenantId, id, dto.alias);
  }

  @Delete(':id/aliases/:aliasId')
  @RequirePermission(PERMISSIONS.CATALOG_ALIASES_MANAGE)
  deleteAlias(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('aliasId') aliasId: string,
  ) {
    return this.catalog.deleteAlias(user.tenantId, id, aliasId);
  }


  @Get('barcode/:code')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  findByBarcode(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.catalog.findByBarcode(user.tenantId, code);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.getById(user.tenantId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    return this.catalog.create(user.tenantId, dto);
  }

  @Patch(':id/archive')
  @RequirePermission(PERMISSIONS.CATALOG_ARCHIVE)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.archive(user.tenantId, id);
  }

  // ── Codes-barres ──

  @Get(':id/barcodes')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listBarcodes(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.listBarcodes(user.tenantId, id);
  }

  @Post('barcodes')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  addBarcode(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddBarcodeDto) {
    return this.catalog.addBarcode(user.tenantId, dto.productId, dto.code);
  }

  @Delete('barcodes/:id')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  deleteBarcode(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.deleteBarcode(user.tenantId, id);
  }

  // ── Bundles ──

  @Get(':id/bundle-components')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listBundleComponents(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.listBundleComponents(user.tenantId, id);
  }

  @Post('bundle-components')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  addBundleComponent(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddBundleComponentDto) {
    return this.catalog.addBundleComponent(
      user.tenantId,
      dto.bundleProductId,
      dto.componentProductId,
      dto.quantity,
    );
  }

  @Delete('bundle-components/:id')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  deleteBundleComponent(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.deleteBundleComponent(user.tenantId, id);
  }

  // ── Variantes ──

  @Get(':id/variants')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listVariants(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.listVariants(user.tenantId, id);
  }

  @Post(':id/variants')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  addVariant(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AddVariantDto) {
    return this.catalog.addVariant(user.tenantId, id, dto);
  }

  // ── Numéros de série / IMEI ──

  @Get(':id/serial-numbers')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listSerialNumbers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    return this.catalog.listSerialNumbers(user.tenantId, id, status);
  }

  @Post(':id/serial-numbers')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  registerSerialNumbers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RegisterSerialNumbersDto,
  ) {
    return this.catalog.registerSerialNumbers(user.tenantId, id, dto);
  }

  // ── Politique de garantie ──

  @Get(':id/warranty-policy')
  @RequirePermission(PERMISSIONS.WARRANTIES_READ)
  getWarrantyPolicy(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.getWarrantyPolicy(user.tenantId, id);
  }

  @Put(':id/warranty-policy')
  @RequirePermission(PERMISSIONS.WARRANTIES_MANAGE)
  setWarrantyPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetWarrantyPolicyDto,
  ) {
    return this.catalog.setWarrantyPolicy(user.tenantId, id, dto);
  }

  @Delete(':id/warranty-policy')
  @RequirePermission(PERMISSIONS.WARRANTIES_MANAGE)
  deleteWarrantyPolicy(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.deleteWarrantyPolicy(user.tenantId, id);
  }

  // ── Lots / péremption ──

  @Get(':id/batches')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listBatches(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.listBatches(user.tenantId, id);
  }

  @Post(':id/batches')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  registerBatch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RegisterBatchDto) {
    return this.catalog.registerBatch(user.tenantId, user.userId, id, dto);
  }

  @Post('import')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  importCsv(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportProductsDto) {
    return this.catalog.importCsv(user.tenantId, dto.csvContent, dto.dryRun ?? false);
  }

  // ── Mise à jour & Rentabilité par produit (Partie 23) ──

  @Patch(':id')
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.update(user.tenantId, id, dto);
  }

  @Get(':id/purchases')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listPurchases(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalog.listProductPurchases(
      user.tenantId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id/sales')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listSales(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalog.listProductSales(
      user.tenantId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id/profitability')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  getProfitability(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.catalog.getProductProfitability(user.tenantId, id);
  }
}


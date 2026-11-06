import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { MergeCustomersDto } from './dto/merge-customers.dto.js';
import { ImportCustomersDto } from './dto/import-customers.dto.js';
import { streamCustomerStatementPdf } from './statement-pdf.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CUSTOMERS_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.customers.list(user.tenantId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CUSTOMERS_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.customers.getById(user.tenantId, id);
  }

  @Get(':id/statement')
  @RequirePermission(PERMISSIONS.CUSTOMER_REPORTS_READ)
  getStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.customers.getStatement(user.tenantId, id, from, to);
  }

  @Get(':id/statement/pdf')
  @RequirePermission(PERMISSIONS.CUSTOMER_REPORTS_READ)
  async getStatementPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.customers.getStatement(user.tenantId, id, from, to);
    streamCustomerStatementPdf(data, res);
  }


  @Post()
  @RequirePermission(PERMISSIONS.CUSTOMERS_WRITE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user.tenantId, dto.name, dto.phone, dto.email);
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.CUSTOMERS_WRITE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user.tenantId, id, dto.name, dto.phone, dto.email);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.CUSTOMERS_WRITE)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.customers.archive(user.tenantId, id);
  }

  @Post('merge')
  @RequirePermission(PERMISSIONS.CUSTOMERS_WRITE)
  merge(@CurrentUser() user: AuthenticatedUser, @Body() dto: MergeCustomersDto) {
    return this.customers.merge(
      user.tenantId,
      user.userId,
      dto.sourceCustomerId,
      dto.targetCustomerId,
    );
  }

  @Post('import')
  @RequirePermission(PERMISSIONS.CUSTOMERS_WRITE)
  importCsv(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportCustomersDto) {
    return this.customers.importCsv(user.tenantId, dto.csvContent, dto.dryRun ?? false);
  }
}

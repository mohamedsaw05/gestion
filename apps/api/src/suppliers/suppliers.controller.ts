import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { SuppliersService } from './suppliers.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto.js';

@Controller('suppliers')
@RequireCapability(CAPABILITIES.PURCHASES)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SUPPLIERS_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliers.list(user.tenantId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.SUPPLIERS_WRITE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(user.tenantId, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.SUPPLIERS_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.suppliers.getById(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.SUPPLIERS_WRITE)
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(user.tenantId, id, dto);
  }

  @Post(':id/payments')
  @RequirePermission(PERMISSIONS.SUPPLIER_PAYMENT_MANAGE)
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordSupplierPaymentDto,
  ) {
    return this.suppliers.recordPayment(user.tenantId, id, new Prisma.Decimal(dto.amount), dto.method);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { ServicesService } from './services.service.js';
import { CreateServiceOrderDto } from './dto/create-service-order.dto.js';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto.js';
import { AddServiceItemDto } from './dto/add-service-item.dto.js';
import { BillServiceOrderDto } from './dto/bill-service-order.dto.js';

@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SERVICES_READ)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('locationId') locationId?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.services.list(user.tenantId, user.userId, {
      status,
      customerId,
      locationId,
      assignedUserId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  @RequirePermission(PERMISSIONS.SERVICES_READ)
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.services.getStats(user.tenantId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.SERVICES_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.services.getById(user.tenantId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.SERVICES_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateServiceOrderDto) {
    return this.services.create(user.tenantId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.SERVICES_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceOrderDto,
  ) {
    return this.services.update(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/items')
  @RequirePermission(PERMISSIONS.SERVICES_UPDATE)
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddServiceItemDto,
  ) {
    return this.services.addItem(user.tenantId, user.userId, id, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission(PERMISSIONS.SERVICES_UPDATE)
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.services.removeItem(user.tenantId, user.userId, id, itemId);
  }

  @Post(':id/bill')
  @RequirePermission(PERMISSIONS.SERVICES_BILL)
  bill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BillServiceOrderDto,
  ) {
    return this.services.bill(user.tenantId, user.userId, id, dto);
  }
}

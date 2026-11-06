import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { PeripheralsService, type PrinterProfileInput } from './peripherals.service.js';

class PeripheralProfileDto implements PrinterProfileInput {
  @IsString() @Length(1, 100) name!: string;
  @IsIn(['OFFICE_PRINTER', 'THERMAL_PRINTER', 'BARCODE_SCANNER']) type!: PrinterProfileInput['type'];
  @IsOptional() @IsString() @Length(0, 100) brand?: string;
  @IsOptional() @IsString() @Length(0, 100) model?: string;
  @IsIn(['USB', 'NETWORK', 'WIFI', 'BLUETOOTH', 'SYSTEM_BROWSER', 'LOCAL_AGENT', 'CAMERA']) connectionMode!: PrinterProfileInput['connectionMode'];
  @IsString() @Length(1, 160) terminalId!: string;
  @IsIn(['A4', 'A5', '58mm', '80mm', 'CUSTOM', 'NONE']) paperFormat!: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() cashRegisterId?: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

@Controller('peripherals')
export class PeripheralsController {
  constructor(private readonly peripherals: PeripheralsService) {}
  @Get() @RequirePermission(PERMISSIONS.DEVICES_MANAGE) list(@CurrentUser() user: AuthenticatedUser, @Query('terminalId') terminalId?: string) { return this.peripherals.list(user.tenantId, terminalId); }
  @Post() @RequirePermission(PERMISSIONS.DEVICES_MANAGE) create(@CurrentUser() user: AuthenticatedUser, @Body() dto: PeripheralProfileDto) { return this.peripherals.create(user.tenantId, dto); }
  @Put(':id') @RequirePermission(PERMISSIONS.DEVICES_MANAGE) update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PeripheralProfileDto) { return this.peripherals.update(user.tenantId, id, dto); }
  @Delete(':id') @RequirePermission(PERMISSIONS.DEVICES_MANAGE) remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.peripherals.remove(user.tenantId, id); }
}

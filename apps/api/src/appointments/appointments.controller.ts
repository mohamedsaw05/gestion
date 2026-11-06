import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CapabilityGuard } from '../common/guards/capability.guard.js';
import { PermissionGuard } from '../common/guards/permission.guard.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { AppointmentsService } from './appointments.service.js';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  QueryAppointmentsDto,
} from './dto/appointment.dto.js';

@Controller('appointments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.APPOINTMENTS_READ)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAppointmentsDto,
  ) {
    return this.appointmentsService.list(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.APPOINTMENTS_READ)
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.getById(user.tenantId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.APPOINTMENTS_CREATE)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.APPOINTMENTS_UPDATE)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.APPOINTMENTS_DELETE)
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.delete(user.tenantId, id);
  }
}

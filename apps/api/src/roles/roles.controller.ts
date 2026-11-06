import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { CloneRoleDto } from './dto/clone-role.dto.js';

@Controller('roles')
@RequirePermission(PERMISSIONS.ROLES_MANAGE)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  // Route statique déclarée AVANT ':id' pour ne pas être interceptée par elle.
  @Get('permissions-catalog')
  getPermissionsCatalog() {
    return this.roles.getPermissionsCatalog();
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.roles.list(user.tenantId);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roles.getById(user.tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.roles.create(user.tenantId, user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/clone')
  clone(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CloneRoleDto) {
    return this.roles.clone(user.tenantId, user.userId, id, dto.name);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roles.delete(user.tenantId, user.userId, id);
  }
}

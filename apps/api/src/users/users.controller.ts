import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';

@Controller('users')
@RequirePermission(PERMISSIONS.USERS_MANAGE)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.users.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.users.create(user.tenantId, user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.updateProfile(user.tenantId, id, dto);
  }

  @Post(':id/disable')
  disable(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.users.setStatus(user.tenantId, user.userId, id, 'DISABLED');
  }

  @Post(':id/enable')
  enable(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.users.setStatus(user.tenantId, user.userId, id, 'ACTIVE');
  }

  @Post(':id/roles')
  assignRole(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.users.assignRole(user.tenantId, user.userId, id, dto);
  }

  @Delete(':id/roles/:userRoleId')
  removeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userRoleId') userRoleId: string,
  ) {
    return this.users.removeRole(user.tenantId, user.userId, id, userRoleId);
  }
}

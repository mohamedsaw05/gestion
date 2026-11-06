import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { InvitationsService } from './invitations.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  // ── Administration (authentifié, USERS_MANAGE) ──

  @Post('users/invitations')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvitationDto) {
    return this.invitations.create(user.tenantId, user.userId, dto);
  }

  @Get('users/invitations')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.invitations.list(user.tenantId);
  }

  @Delete('users/invitations/:id')
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invitations.revoke(user.tenantId, user.userId, id);
  }

  // ── Acceptation (PUBLIC — la personne invitée n'a pas encore de compte) ──
  // tenantId explicite dans l'URL (jamais déduit du token seul) : même
  // principe déjà établi pour /auth/refresh, cf docs/PROJECT_STATUS.md §3.3 —
  // évite une recherche cross-tenant qui casserait l'isolation RLS.

  @Get('invitations/:tenantId/:token')
  @Public()
  preview(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('token') token: string) {
    return this.invitations.preview(tenantId, token);
  }

  @Post('invitations/:tenantId/:token/accept')
  @Public()
  accept(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.invitations.accept(tenantId, token, dto.fullName, dto.password);
  }
}

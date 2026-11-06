import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentPlatformAdmin } from '../platform/decorators/current-platform-admin.decorator.js';
import { PlatformAdminGuard, type PlatformAdminContext } from '../platform/guards/platform-admin.guard.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { SupportService } from './support.service.js';

class NewTicketDto { @IsString() @MinLength(4) @MaxLength(180) subject!: string; @IsString() @MinLength(10) @MaxLength(10000) message!: string; }
class ReplyTicketDto { @IsString() @MinLength(2) @MaxLength(10000) response!: string; }

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}
  @Get('availability') availability() { return this.support.getAvailability(); }
  @Get('tickets') list(@CurrentUser() user: AuthenticatedUser) { return this.support.listMine(user.tenantId, user.userId); }
  @Post('tickets') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: NewTicketDto) { return this.support.create(user.tenantId, user.userId, dto.subject, dto.message); }
}

@Controller('platform/support')
@Public()
@UseGuards(PlatformAdminGuard)
export class PlatformSupportController {
  constructor(private readonly support: SupportService) {}
  @Get('tickets') list() { return this.support.listAll(); }
  @Put('tickets/:id/reply') reply(@Param('id') id: string, @Body() dto: ReplyTicketDto, @CurrentPlatformAdmin() admin: PlatformAdminContext) { return this.support.respond(id, dto.response, admin.email); }
}

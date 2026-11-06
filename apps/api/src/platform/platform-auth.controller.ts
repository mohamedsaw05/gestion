import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { PlatformAuthService } from './platform-auth.service.js';
import { PlatformLoginDto } from './dto/platform-login.dto.js';
import { PlatformAdminGuard, type PlatformAdminContext } from './guards/platform-admin.guard.js';
import { CurrentPlatformAdmin } from './decorators/current-platform-admin.decorator.js';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: PlatformLoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @UseGuards(PlatformAdminGuard)
  @Get('me')
  getMe(@CurrentPlatformAdmin() admin: PlatformAdminContext) {
    return this.auth.getMe(admin.id);
  }
}

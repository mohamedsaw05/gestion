import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { PlatformAdminGuard } from './guards/platform-admin.guard.js';
import { PlatformFestiveWheelService } from './platform-festive-wheel.service.js';

@Controller('platform/festive-wheel')
@Public()
@UseGuards(PlatformAdminGuard)
export class PlatformFestiveWheelController {
  constructor(private readonly festiveWheel: PlatformFestiveWheelService) {}

  @Get('config')
  getConfig() {
    return this.festiveWheel.getAdminConfig();
  }

  @Put('config')
  updateConfig(@Body() body: Record<string, unknown>) {
    return this.festiveWheel.updateAdminConfig(body);
  }

  @Get('claims')
  getClaims() {
    return this.festiveWheel.getClaims();
  }

  @Post('reset-spins')
  resetSpins() {
    return this.festiveWheel.resetUserSpins();
  }
}

import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentPlatformAdmin } from './decorators/current-platform-admin.decorator.js';
import { PlatformAdminGuard, type PlatformAdminContext } from './guards/platform-admin.guard.js';
import { CommercialSettingsService } from './commercial-settings.service.js';

class UpdateTariffDto {
  @IsInt() @Min(1) monthlyPrice!: number;
  @IsOptional() @IsString() reason?: string;
}

class UpdateSupportHoursDto {
  @IsString() @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) opensAt!: string;
  @IsString() @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) closesAt!: string;
  @IsString() timeZone!: string;
}

@Controller('commercial')
@Public()
export class PublicCommercialSettingsController {
  constructor(private readonly settings: CommercialSettingsService) {}
  @Get('settings') getSettings() { return this.settings.getPublicSettings(); }
}

@Controller('platform/commercial')
@Public()
@UseGuards(PlatformAdminGuard)
export class PlatformCommercialSettingsController {
  constructor(private readonly settings: CommercialSettingsService) {}
  @Get() getSettings() { return this.settings.getAdminSettings(); }
  @Put('tariff') updateTariff(@Body() dto: UpdateTariffDto, @CurrentPlatformAdmin() actor: PlatformAdminContext) {
    return this.settings.updateMonthlyPrice(dto.monthlyPrice, actor, dto.reason);
  }
  @Put('support-hours') updateSupportHours(@Body() dto: UpdateSupportHoursDto, @CurrentPlatformAdmin() actor: PlatformAdminContext) {
    return this.settings.updateSupportHours(dto, actor);
  }
}

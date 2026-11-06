import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { LearningService } from './learning.service.js';

class SaveProgressDto { @IsBoolean() completed!: boolean; @IsOptional() @IsInt() @Min(0) @Max(500) step?: number; }

@Controller('learning/progress')
export class LearningController {
  constructor(private readonly learning: LearningService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.learning.list(user.tenantId, user.userId); }
  @Put(':guideKey') save(@CurrentUser() user: AuthenticatedUser, @Param('guideKey') key: string, @Body() dto: SaveProgressDto) {
    return this.learning.save(user.tenantId, user.userId, key, { completed: dto.completed, step: dto.step ?? 0 });
  }
}

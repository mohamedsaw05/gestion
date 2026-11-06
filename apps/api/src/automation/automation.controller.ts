import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { AutomationService } from './automation.service.js';
import { AutomationFilterDto, CreateAutomationRuleDto, TestAutomationRuleDto } from './dto/automation.dto.js';

@Controller('automation')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('rules')
  @RequirePermission(PERMISSIONS.AUTOMATION_READ)
  listRules(@CurrentUser() user: AuthenticatedUser) {
    return this.automation.listRules(user.tenantId);
  }

  @Get('rules/:id')
  @RequirePermission(PERMISSIONS.AUTOMATION_READ)
  ruleDetail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.automation.getRuleDetail(user.tenantId, id);
  }

  @Post('rules')
  @RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
  createRule(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAutomationRuleDto) {
    return this.automation.createRule(user.tenantId, user.userId, dto);
  }

  @Patch('rules/:id/toggle')
  @RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
  toggleRule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.automation.toggleRule(user.tenantId, id);
  }

  @Delete('rules/:id')
  @RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
  deleteRule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.automation.deleteRule(user.tenantId, id);
  }

  @Post('rules/:id/test')
  @RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
  testRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TestAutomationRuleDto,
  ) {
    return this.automation.testRuleDryRun(user.tenantId, id, dto.mockPayload);
  }

  @Get('logs')
  @RequirePermission(PERMISSIONS.AUTOMATION_READ)
  listLogs(@CurrentUser() user: AuthenticatedUser, @Query() query: AutomationFilterDto) {
    return this.automation.listLogs(user.tenantId, query);
  }
}

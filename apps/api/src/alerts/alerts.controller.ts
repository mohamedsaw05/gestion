import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { AlertsService } from './alerts.service.js';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  getAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.alerts.getOperationalAlerts(user.tenantId);
  }

  @Get('count')
  async getAlertsCount(@CurrentUser() user: AuthenticatedUser) {
    const res = await this.alerts.getOperationalAlerts(user.tenantId);
    return { count: res.total };
  }
}

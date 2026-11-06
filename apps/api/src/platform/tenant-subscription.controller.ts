import { Controller, Get, NotFoundException, Post } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { PlatformFestiveWheelService } from './platform-festive-wheel.service.js';

@Controller('tenant-subscription')
export class TenantSubscriptionController {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly festiveWheel: PlatformFestiveWheelService,
  ) {}

  @Get('festive-wheel/status')
  getFestiveWheelStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.festiveWheel.getPublicStatus(user.tenantId, user.userId);
  }

  @Post('festive-wheel/spin')
  spinFestiveWheel(@CurrentUser() user: AuthenticatedUser) {
    return this.festiveWheel.spinWheel(user.tenantId, user.userId);
  }

  @Get('current')
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  async getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.db.run(user.tenantId, async (tx) => {
      const sub = await tx.platformSubscription.findUnique({
        where: { tenantId: user.tenantId },
        include: { plan: true },
      });

      if (!sub) {
        throw new NotFoundException('Aucun abonnement trouvé pour cet espace');
      }

      const activeUsers = await tx.user.count({
        where: { tenantId: user.tenantId, status: 'ACTIVE', deletedAt: null },
      });

      const locations = await tx.location.count({
        where: { tenantId: user.tenantId, deletedAt: null },
      });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlySales = await tx.sale.count({
        where: { tenantId: user.tenantId, createdAt: { gte: startOfMonth } },
      });

      return {
        id: sub.id,
        status: sub.status,
        startedAt: sub.startedAt,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        gracePeriodEnd: sub.gracePeriodEnd,
        plan: {
          key: sub.plan.key,
          name: sub.plan.name,
          description: sub.plan.description,
          priceMonthly: sub.plan.priceMonthly,
          currency: sub.plan.currency,
          allowedCapabilities: sub.plan.allowedCapabilities,
        },
        quotas: {
          users: {
            current: activeUsers,
            max: sub.plan.maxUsers,
            isReached: activeUsers >= sub.plan.maxUsers,
          },
          locations: {
            current: locations,
            max: sub.plan.maxLocations,
            isReached: locations >= sub.plan.maxLocations,
          },
          monthlySales: {
            current: monthlySales,
            max: sub.plan.maxMonthlySales,
            isReached: sub.plan.maxMonthlySales > 0 && monthlySales >= sub.plan.maxMonthlySales,
          },
        },
      };
    });
  }

  @Get('invoices')
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  async getInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.db.run(user.tenantId, async (tx) => {
      return tx.platformInvoice.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
      });
    });
  }
}

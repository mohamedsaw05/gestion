import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator.js';
import { PlatformPrismaService } from './common/platform-prisma.service.js';

@Controller()
export class AppController {
  constructor(private readonly platform: PlatformPrismaService) {}

  @Public()
  @Get(['health', 'api/health'])
  async health() {
    const start = performance.now();
    try {
      // 1. Probe database connectivity and latency
      await this.platform.client.$queryRaw`SELECT 1`;
      const dbLatencyMs = Math.round(performance.now() - start);

      // 2. Probe Outbox background queue health
      const pendingOutboxCount = await this.platform.client.outboxEvent.count({
        where: { processedAt: null },
      });

      const oldestPending = await this.platform.client.outboxEvent.findFirst({
        where: { processedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });

      const oldestAgeSeconds = oldestPending
        ? Math.round((Date.now() - oldestPending.createdAt.getTime()) / 1000)
        : 0;

      const mem = process.memoryUsage();

      return {
        status: oldestAgeSeconds > 300 ? 'degraded' : 'healthy',
        service: 'gestionnaire-api',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        database: {
          status: 'up',
          latencyMs: dbLatencyMs,
        },
        outboxQueue: {
          pendingEvents: pendingOutboxCount,
          oldestPendingAgeSeconds: oldestAgeSeconds,
          status: oldestAgeSeconds > 300 ? 'lagging' : 'healthy',
        },
        system: {
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          rssMb: Math.round(mem.rss / 1024 / 1024),
        },
      };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'unhealthy',
        service: 'gestionnaire-api',
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Database connectivity check failed',
      });
    }
  }
}

import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

@Controller('audit')
export class AuditController {
  constructor(private readonly db: PrismaTenantService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.db.run(user.tenantId, (tx) =>
      tx.auditLog.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }
}

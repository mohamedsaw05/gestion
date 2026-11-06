import { Injectable } from '@nestjs/common';
import { newId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

@Injectable()
export class LearningService {
  constructor(private readonly db: PrismaTenantService) {}
  list(tenantId: string, userId: string) {
    return this.db.run(tenantId, (tx) => tx.learningProgress.findMany({ where: { tenantId, userId }, orderBy: { updatedAt: 'desc' } }));
  }
  save(tenantId: string, userId: string, guideKey: string, progress: unknown) {
    const value = progress as any;
    return this.db.run(tenantId, async (tx) => tx.learningProgress.upsert({
      where: { tenantId_userId_guideKey: { tenantId, userId, guideKey } },
      create: { id: newId(), tenantId, userId, guideKey, progress: value },
      update: { progress: value },
    }));
  }
}

import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module.js';
import { AuditController } from './audit.controller.js';
import { OutboxWorkerService } from './outbox-worker.service.js';

@Module({
  imports: [RbacModule],
  controllers: [AuditController],
  providers: [OutboxWorkerService],
})
export class AuditModule {}

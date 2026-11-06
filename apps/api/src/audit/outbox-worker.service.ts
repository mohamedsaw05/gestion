import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma, PrismaClient } from '@prisma/client';
import { newTransactionalId } from '@gestionnaire/db';

/**
 * Implémentation du pattern Outbox (cf docs/architecture/01-analyse-risques.md §4.2
 * et docs/architecture/02-moteurs.md §19/§27) : relaie les événements écrits par
 * les moteurs métier (dans LEUR transaction) vers le journal d'audit.
 *
 * Ce worker est un processus interne de confiance sans entrée utilisateur ; il
 * doit pouvoir relayer les événements de TOUS les tenants. Il se connecte avec
 * le rôle Postgres dédié `worker_runtime` (créé par la migration
 * least_privilege_roles), qui n'a de policy RLS explicite (cf
 * docs/architecture/07-securite.md §3) que sur OutboxEvent (SELECT/UPDATE) et
 * AuditLog (INSERT) — jamais BYPASSRLS, jamais d'accès à une autre table.
 */
@Injectable()
export class OutboxWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private readonly prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL_WORKER ?? process.env.DATABASE_URL,
  });
  private running = false;

  @Interval(5000)
  async processOutbox() {
    if (this.running) return; // évite le chevauchement si un cycle précédent est encore en cours
    this.running = true;
    try {
      const pending = await this.prisma.outboxEvent.findMany({
        where: { processedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      for (const event of pending) {
        try {
          const payload = event.payload as Record<string, unknown>;
          // Écriture de l'AuditLog et marquage "traité" dans LA MÊME transaction :
          // soit les deux réussissent, soit aucun (pas d'état intermédiaire visible).
          await this.prisma.$transaction(async (tx) => {
            await tx.auditLog.create({
              data: {
                id: newTransactionalId(),
                tenantId: event.tenantId,
                actorUserId: (payload.actorUserId as string | undefined) ?? null,
                actorType: payload.actorUserId ? 'USER' : 'SYSTEM',
                eventType: event.eventType,
                entityType: (payload.entityType as string | undefined) ?? 'unknown',
                entityId: (payload.entityId as string | undefined) ?? event.id,
                payload: payload as Prisma.InputJsonValue,
              },
            });
            await tx.outboxEvent.update({
              where: { id: event.id },
              data: { processedAt: new Date() },
            });
          });
        } catch (err) {
          this.logger.error(`Échec de traitement de l'événement outbox ${event.id}`, err as Error);
          // processedAt reste NULL : retenté au prochain cycle (livraison at-least-once,
          // cf docs/architecture/02-moteurs.md §19).
        }
      }
    } catch (err) {
      // PostgreSQL peut être momentanément indisponible au démarrage local ou
      // lors d'une interruption réseau. Le prochain cycle retentera la lecture.
      this.logger.warn(`Worker outbox en attente de PostgreSQL : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    } finally {
      this.running = false;
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}

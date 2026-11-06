import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PERMISSIONS, newId, newTransactionalId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { RbacService } from '../rbac/rbac.service.js';

/**
 * Cash Register Engine (cf docs/architecture/02-moteurs.md §15 et
 * docs/PROJECT_STATUS.md §6 — prochain moteur prioritaire après la
 * configuration intelligente des commerces). Portée volontairement simple :
 * une session ouverte par emplacement (fond de caisse + mouvements manuels
 * dépôt/retrait + paiements CASH rattachés automatiquement), fermeture avec
 * comptage réel et écart calculé — pas de multi-tiroir, pas de coffre
 * intermédiaire, pas de devise multiple par session (PLANNED si besoin).
 *
 * Ne bloque JAMAIS une vente : le rattachement d'un paiement CASH à la
 * session ouverte (cf SalesService) est du "best effort", une vente reste
 * possible sans session de caisse ouverte (aucune régression sur le
 * comportement existant, cf règle de migration "ne jamais casser un tenant
 * existant").
 */
@Injectable()
export class CashRegisterService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly rbac: RbacService,
  ) {}

  /**
   * Vérifie le scope de localisation d'une action sur une session déjà
   * existante (ouverture couverte automatiquement par PermissionGuard via
   * locationId dans le body, mais fermeture/mouvement n'ont que l'id de
   * session dans l'URL — le guard générique ne peut pas deviner l'emplacement
   * concerné, cf commentaire de PermissionGuard).
   *
   * Appelé AVANT d'ouvrir la transaction d'écriture (jamais depuis
   * l'intérieur d'un `db.run` déjà ouvert) : `RbacService.can` ouvre lui-même
   * sa propre transaction via `PrismaTenantService.run`, et Prisma ne
   * supporte pas l'imbrication de deux transactions interactives sur le même
   * client — l'état (session ouverte/fermée) est de toute façon revérifié à
   * l'intérieur de la transaction d'écriture qui suit, donc aucune fenêtre de
   * race condition n'est introduite par cette séparation en deux étapes.
   */
  private async assertLocationScope(tenantId: string, userId: string, locationId: string): Promise<void> {
    const allowed = await this.rbac.can(tenantId, userId, PERMISSIONS.CASH_SESSION_MANAGE, { locationId });
    if (!allowed) {
      throw new ForbiddenException("Cette session de caisse n'est pas dans votre périmètre (emplacement)");
    }
  }

  private async getSessionLocationOrThrow(tenantId: string, sessionId: string): Promise<string> {
    const session = await this.db.run(tenantId, (tx) =>
      tx.cashSession.findFirst({ where: { id: sessionId, tenantId }, select: { locationId: true } }),
    );
    if (!session) throw new NotFoundException('Session de caisse introuvable');
    return session.locationId;
  }

  private async assertReadScope(tenantId: string, userId: string, locationId: string): Promise<void> {
    const allowed = await this.rbac.can(tenantId, userId, PERMISSIONS.CASH_SESSION_READ, { locationId });
    if (!allowed) {
      throw new ForbiddenException("Cette session de caisse n'est pas dans votre périmètre (emplacement)");
    }
  }

  async getCurrentSession(tenantId: string, locationId: string) {
    return this.db.run(tenantId, (tx) =>
      tx.cashSession.findFirst({ where: { tenantId, locationId, status: 'OPEN' } }),
    );
  }

  async listSessions(tenantId: string, locationId?: string) {
    return this.db.run(tenantId, (tx) =>
      tx.cashSession.findMany({
        where: { tenantId, locationId },
        orderBy: { openedAt: 'desc' },
        take: 100,
      }),
    );
  }

  async getSessionDetail(tenantId: string, userId: string, sessionId: string) {
    const locationId = await this.getSessionLocationOrThrow(tenantId, sessionId);
    await this.assertReadScope(tenantId, userId, locationId);

    return this.db.run(tenantId, async (tx) => {
      const session = await tx.cashSession.findFirst({ where: { id: sessionId, tenantId } });
      if (!session) throw new NotFoundException('Session de caisse introuvable');
      const [movements, payments] = await Promise.all([
        tx.cashMovement.findMany({ where: { tenantId, sessionId }, orderBy: { createdAt: 'asc' } }),
        tx.payment.findMany({ where: { tenantId, cashSessionId: sessionId }, orderBy: { createdAt: 'asc' } }),
      ]);
      return { session, movements, payments };
    });
  }

  async openSession(tenantId: string, userId: string, locationId: string, openingFloat: string, notes?: string) {
    const amount = new Prisma.Decimal(openingFloat);
    if (amount.lessThan(0)) {
      throw new BadRequestException('Le fond de caisse ne peut pas être négatif');
    }
    return this.db.run(tenantId, async (tx) => {
      const location = await tx.location.findFirst({ where: { id: locationId, tenantId, deletedAt: null } });
      if (!location) throw new NotFoundException('Emplacement introuvable');

      try {
        return await tx.cashSession.create({
          data: {
            id: newId(),
            tenantId,
            locationId,
            openedByUserId: userId,
            openingFloat: amount,
            notes,
          },
        });
      } catch (err) {
        // Contrainte d'unicité partielle "une session OPEN par emplacement"
        // (cf migration cash_register) — traduit en erreur métier lisible
        // plutôt que de laisser fuiter une erreur Prisma brute.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('Une session de caisse est déjà ouverte pour cet emplacement');
        }
        throw err;
      }
    });
  }

  async recordMovement(
    tenantId: string,
    userId: string,
    sessionId: string,
    type: 'CASH_IN' | 'CASH_OUT',
    amountInput: string,
    reason: string,
  ) {
    const amount = new Prisma.Decimal(amountInput);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Le montant du mouvement doit être strictement positif');
    }
    const locationId = await this.getSessionLocationOrThrow(tenantId, sessionId);
    await this.assertLocationScope(tenantId, userId, locationId);

    return this.db.run(tenantId, async (tx) => {
      const session = await tx.cashSession.findFirst({ where: { id: sessionId, tenantId } });
      if (!session) throw new NotFoundException('Session de caisse introuvable');
      if (session.status !== 'OPEN') {
        throw new BadRequestException('Cette session de caisse est déjà fermée');
      }
      return tx.cashMovement.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          sessionId,
          type,
          amount,
          reason,
          createdByUserId: userId,
        },
      });
    });
  }

  async closeSession(tenantId: string, userId: string, sessionId: string, countedInput: string, notes?: string) {
    const counted = new Prisma.Decimal(countedInput);
    if (counted.lessThan(0)) {
      throw new BadRequestException('Le montant compté ne peut pas être négatif');
    }
    const locationId = await this.getSessionLocationOrThrow(tenantId, sessionId);
    await this.assertLocationScope(tenantId, userId, locationId);

    return this.db.run(tenantId, async (tx) => {
      const session = await tx.cashSession.findFirst({ where: { id: sessionId, tenantId } });
      if (!session) throw new NotFoundException('Session de caisse introuvable');
      if (session.status !== 'OPEN') {
        throw new BadRequestException('Cette session de caisse est déjà fermée');
      }

      const [movements, payments] = await Promise.all([
        tx.cashMovement.findMany({ where: { tenantId, sessionId } }),
        tx.payment.findMany({ where: { tenantId, cashSessionId: sessionId } }),
      ]);
      const cashIn = movements
        .filter((m) => m.type === 'CASH_IN')
        .reduce((sum, m) => sum.plus(m.amount), new Prisma.Decimal(0));
      const cashOut = movements
        .filter((m) => m.type === 'CASH_OUT')
        .reduce((sum, m) => sum.plus(m.amount), new Prisma.Decimal(0));
      const cashSales = payments.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));

      const expectedAmount = session.openingFloat.plus(cashSales).plus(cashIn).minus(cashOut);
      const discrepancy = counted.minus(expectedAmount);

      return tx.cashSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closedByUserId: userId,
          closedAt: new Date(),
          countedAmount: counted,
          expectedAmount,
          discrepancy,
          notes: notes ?? session.notes,
        },
      });
    });
  }
}

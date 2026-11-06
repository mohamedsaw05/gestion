import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CAPABILITIES, newTransactionalId, PERMISSIONS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { InventoryService } from './inventory.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import type { CreateStockTransferDto } from './dto/create-stock-transfer.dto.js';

const ACTIVE_STATUSES = ['DRAFT'] as const;

/**
 * Stock Transfer Engine (Phase 13). Cycle DRAFT (créé, aucun mouvement) →
 * CONFIRMED (stock RÉELLEMENT sorti de l'emplacement source) → RECEIVED
 * (stock RÉELLEMENT entré à l'emplacement destination) — la période
 * CONFIRMED reflète honnêtement la marchandise "en transit" (ni à l'un ni à
 * l'autre emplacement). CANCELLED possible uniquement depuis DRAFT, même
 * règle que PurchaseOrder (annuler après sortie de stock laisserait un état
 * incohérent). Délègue entièrement à InventoryService.applyStockMovementWithTx
 * pour chaque mouvement — jamais de duplication de la logique de verrouillage.
 */
@Injectable()
export class StockTransfersService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly inventory: InventoryService,
    private readonly businessProfile: BusinessProfileService,
    private readonly rbac: RbacService,
  ) {}

  private async buildVisibilityWhere(tenantId: string, userId: string): Promise<Prisma.StockTransferWhereInput> {
    const visibility = await this.rbac.getRecordVisibility(tenantId, userId, PERMISSIONS.INVENTORY_TRANSFER_CREATE);
    if (visibility.allLocations) return {};

    const or: Prisma.StockTransferWhereInput[] = [];
    if (visibility.locationIds.length > 0) {
      or.push({ fromLocationId: { in: visibility.locationIds } });
      or.push({ toLocationId: { in: visibility.locationIds } });
    }
    if (visibility.ownRecordsOnly) or.push({ createdByUserId: userId });
    if (visibility.teamLocationIds.length > 0) {
      const teamUserIds = await this.rbac.resolveTeamMemberUserIds(tenantId, visibility.teamLocationIds);
      if (teamUserIds.length > 0) or.push({ createdByUserId: { in: teamUserIds } });
    }
    return or.length > 0 ? { OR: or } : { id: '__none__' };
  }

  async list(tenantId: string, userId: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    return this.db.run(tenantId, (tx) =>
      tx.stockTransfer.findMany({
        where: { tenantId, ...visibilityWhere },
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async getById(tenantId: string, userId: string, id: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    const transfer = await this.db.run(tenantId, (tx) =>
      tx.stockTransfer.findFirst({ where: { id, tenantId, ...visibilityWhere }, include: { lines: true } }),
    );
    if (!transfer) throw new NotFoundException('Transfert introuvable');
    return transfer;
  }

  async create(tenantId: string, actorUserId: string, dto: CreateStockTransferDto) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException("L'emplacement source et l'emplacement destination doivent être différents");
    }
    // Défense en profondeur (même principe que SalesService pour
    // customer_credit) : le contrôleur ne peut vérifier qu'UNE capability
    // (@RequireCapability n'accepte qu'une clé) — "multiple_locations" est
    // revérifiée ici explicitement, un transfert n'ayant de sens qu'avec
    // plusieurs emplacements réellement autorisés pour ce commerce.
    const multiLocationsEnabled = await this.businessProfile.isCapabilityEnabled(
      tenantId,
      CAPABILITIES.MULTIPLE_LOCATIONS,
    );
    if (!multiLocationsEnabled) {
      throw new BadRequestException(
        "Les transferts de stock nécessitent l'activation de \"Plusieurs emplacements\" (cf Profil du commerce)",
      );
    }

    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.stockTransfer.findFirst({
        where: { tenantId, operationId: dto.operationId },
        include: { lines: true },
      });
      if (existing) return existing;

      const [fromLocation, toLocation] = await Promise.all([
        tx.location.findFirst({ where: { id: dto.fromLocationId, tenantId, deletedAt: null } }),
        tx.location.findFirst({ where: { id: dto.toLocationId, tenantId, deletedAt: null } }),
      ]);
      if (!fromLocation) throw new BadRequestException('Emplacement source introuvable');
      if (!toLocation) throw new BadRequestException('Emplacement destination introuvable');

      const productIds = dto.lines.map((l) => l.productId);
      const products = await tx.product.findMany({ where: { tenantId, id: { in: productIds }, deletedAt: null } });
      const productById = new Map(products.map((p) => [p.id, p]));

      const transferId = newTransactionalId();
      const lineInputs: { productId: string; productNameSnapshot: string; quantity: Prisma.Decimal }[] = [];

      for (const line of dto.lines) {
        const product = productById.get(line.productId);
        if (!product) throw new BadRequestException(`Produit introuvable ou inactif : ${line.productId}`);
        if (!product.isStocked) {
          throw new BadRequestException(`"${product.name}" n'est pas un produit stocké, il ne peut pas être transféré`);
        }
        const quantity = new Prisma.Decimal(line.quantity);
        if (quantity.lessThanOrEqualTo(0)) {
          throw new BadRequestException('La quantité doit être strictement positive');
        }
        lineInputs.push({ productId: product.id, productNameSnapshot: product.name, quantity });
      }

      await tx.stockTransfer.create({
        data: {
          id: transferId,
          tenantId,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          createdByUserId: actorUserId,
          operationId: dto.operationId,
        },
      });
      for (const line of lineInputs) {
        await tx.stockTransferLine.create({ data: { id: newTransactionalId(), tenantId, transferId, ...line } });
      }

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'inventory.transfer.created',
          payload: { actorUserId, entityType: 'StockTransfer', entityId: transferId, fromLocationId: dto.fromLocationId, toLocationId: dto.toLocationId },
        },
      });

      return tx.stockTransfer.findFirst({ where: { id: transferId }, include: { lines: true } });
    });
  }

  /** DRAFT → CONFIRMED : le stock QUITTE réellement l'emplacement source. */
  async confirm(tenantId: string, actorUserId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({ where: { id, tenantId }, include: { lines: true } });
      if (!transfer) throw new NotFoundException('Transfert introuvable');
      if (transfer.status !== 'DRAFT') {
        throw new BadRequestException(`Seul un transfert DRAFT peut être confirmé (statut actuel : ${transfer.status})`);
      }

      for (const line of transfer.lines) {
        await this.inventory.applyStockMovementWithTx(
          tx,
          tenantId,
          transfer.fromLocationId,
          line.productId,
          line.quantity.negated(),
          'transfer_out',
          'transfer',
          transfer.id,
        );
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: { status: 'CONFIRMED', shippedAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'inventory.transfer.confirmed',
          payload: { actorUserId, entityType: 'StockTransfer', entityId: id },
        },
      });
      return { ...updated, lines: transfer.lines };
    });
  }

  /** CONFIRMED → RECEIVED : le stock ENTRE réellement à l'emplacement destination. */
  async receive(tenantId: string, actorUserId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({ where: { id, tenantId }, include: { lines: true } });
      if (!transfer) throw new NotFoundException('Transfert introuvable');
      if (transfer.status !== 'CONFIRMED') {
        throw new BadRequestException(
          `Un transfert ${transfer.status} ne peut pas être réceptionné (doit être CONFIRMED)`,
        );
      }

      for (const line of transfer.lines) {
        await this.inventory.applyStockMovementWithTx(
          tx,
          tenantId,
          transfer.toLocationId,
          line.productId,
          line.quantity,
          'transfer_in',
          'transfer',
          transfer.id,
        );
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'inventory.transfer.received',
          payload: { actorUserId, entityType: 'StockTransfer', entityId: id },
        },
      });
      return { ...updated, lines: transfer.lines };
    });
  }

  async cancel(tenantId: string, actorUserId: string, id: string, reason?: string) {
    return this.db.run(tenantId, async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({ where: { id, tenantId } });
      if (!transfer) throw new NotFoundException('Transfert introuvable');
      if (!(ACTIVE_STATUSES as readonly string[]).includes(transfer.status)) {
        throw new BadRequestException(
          `Un transfert ${transfer.status} ne peut pas être annulé (le stock a déjà quitté l'emplacement source)`,
        );
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'inventory.transfer.cancelled',
          payload: { actorUserId, entityType: 'StockTransfer', entityId: id, reason: reason ?? null },
        },
      });
      return updated;
    });
  }
}

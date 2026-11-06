import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId, newTransactionalId, PERMISSIONS, SETTINGS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { ConfigurationService } from '../config/config.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { SuppliersService } from './suppliers.service.js';
import type { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import type { ReceivePurchaseOrderLineDto } from './dto/receive-purchase-order.dto.js';

const ACTIVE_STATUSES = ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED'] as const;

/**
 * Purchase Engine (Phase 10). Workflow : DRAFT → CONFIRMED → (réceptions
 * partielles ou totale) → RECEIVED, avec CANCELLED possible tant qu'aucune
 * réception n'a eu lieu (annuler après une réception laisserait un stock
 * déjà entré et une dette déjà engagée incohérents avec l'annulation — même
 * principe que Order.complete()).
 *
 * La réception NE duplique PAS la logique de stock : elle délègue à
 * InventoryService.applyStockMovementWithTx (même verrouillage pessimiste
 * que Sales/Inventory) et à SuppliersService.recordPurchaseDebtWithTx pour la
 * dette — tout DANS la même transaction, jamais deux écritures séparées.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly config: ConfigurationService,
    private readonly inventory: InventoryService,
    private readonly suppliers: SuppliersService,
    private readonly rbac: RbacService,
  ) {}

  private async buildVisibilityWhere(tenantId: string, userId: string): Promise<Prisma.PurchaseOrderWhereInput> {
    const visibility = await this.rbac.getRecordVisibility(tenantId, userId, PERMISSIONS.PURCHASES_READ);
    if (visibility.allLocations) return {};

    const or: Prisma.PurchaseOrderWhereInput[] = [];
    if (visibility.locationIds.length > 0) or.push({ locationId: { in: visibility.locationIds } });
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
      tx.purchaseOrder.findMany({
        where: { tenantId, ...visibilityWhere },
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async getById(tenantId: string, userId: string, id: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    const order = await this.db.run(tenantId, (tx) =>
      tx.purchaseOrder.findFirst({ where: { id, tenantId, ...visibilityWhere }, include: { lines: true } }),
    );
    if (!order) throw new NotFoundException('Commande fournisseur introuvable');
    return order;
  }

  async create(tenantId: string, actorUserId: string, dto: CreatePurchaseOrderDto) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.purchaseOrder.findFirst({
        where: { tenantId, operationId: dto.operationId },
        include: { lines: true },
      });
      if (existing) return existing;

      const supplier = await tx.supplier.findFirst({ where: { id: dto.supplierId, tenantId, deletedAt: null } });
      if (!supplier) throw new BadRequestException('Fournisseur introuvable');

      const currency =
        dto.currency ?? (await this.config.getWithTx<string>(tx, tenantId, SETTINGS.DEFAULT_CURRENCY));
      const purchaseOrderId = newTransactionalId();

      const productIds = dto.lines.map((l) => l.productId);
      const products = await tx.product.findMany({ where: { tenantId, id: { in: productIds }, deletedAt: null } });
      const productById = new Map(products.map((p) => [p.id, p]));

      let subtotal = new Prisma.Decimal(0);
      const lineInputs: {
        productId: string;
        productNameSnapshot: string;
        unitSnapshot: string;
        quantityOrdered: Prisma.Decimal;
        unitCostSnapshot: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }[] = [];

      for (const line of dto.lines) {
        const product = productById.get(line.productId);
        if (!product) throw new BadRequestException(`Produit introuvable ou inactif : ${line.productId}`);
        const quantity = new Prisma.Decimal(line.quantity);
        const unitCost = new Prisma.Decimal(line.unitCost);
        if (quantity.lessThanOrEqualTo(0)) throw new BadRequestException('La quantité doit être strictement positive');
        if (unitCost.lessThan(0)) throw new BadRequestException('Le coût unitaire ne peut pas être négatif');

        const lineTotal = quantity.times(unitCost);
        subtotal = subtotal.plus(lineTotal);
        lineInputs.push({
          productId: product.id,
          productNameSnapshot: product.name,
          unitSnapshot: product.unit,
          quantityOrdered: quantity,
          unitCostSnapshot: unitCost,
          lineTotal,
        });
      }

      await tx.purchaseOrder.create({
        data: {
          id: purchaseOrderId,
          tenantId,
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          currency,
          subtotal,
          createdByUserId: actorUserId,
          operationId: dto.operationId,
        },
      });
      for (const line of lineInputs) {
        await tx.purchaseOrderLine.create({ data: { id: newTransactionalId(), tenantId, purchaseOrderId, ...line } });
      }

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'purchases.order.created',
          payload: { actorUserId, entityType: 'PurchaseOrder', entityId: purchaseOrderId, subtotal: subtotal.toString() },
        },
      });

      return tx.purchaseOrder.findFirst({ where: { id: purchaseOrderId }, include: { lines: true } });
    });
  }

  async confirm(tenantId: string, actorUserId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.purchaseOrder.findFirst({ where: { id, tenantId } });
      if (!order) throw new NotFoundException('Commande fournisseur introuvable');
      if (order.status !== 'DRAFT') {
        throw new BadRequestException(`Seule une commande DRAFT peut être confirmée (statut actuel : ${order.status})`);
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'purchases.order.confirmed',
          payload: { actorUserId, entityType: 'PurchaseOrder', entityId: id },
        },
      });
      return updated;
    });
  }

  async receive(tenantId: string, actorUserId: string, id: string, receivedLines: ReceivePurchaseOrderLineDto[]) {
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.purchaseOrder.findFirst({ where: { id, tenantId }, include: { lines: true } });
      if (!order) throw new NotFoundException('Commande fournisseur introuvable');
      if (order.status !== 'CONFIRMED' && order.status !== 'PARTIALLY_RECEIVED') {
        throw new BadRequestException(
          `Une commande ${order.status} ne peut pas être réceptionnée (doit être CONFIRMED ou PARTIALLY_RECEIVED)`,
        );
      }

      const lineById = new Map(order.lines.map((l) => [l.id, l]));
      let receivedValue = new Prisma.Decimal(0);

      for (const received of receivedLines) {
        const line = lineById.get(received.purchaseOrderLineId);
        if (!line) throw new BadRequestException(`Ligne de commande introuvable : ${received.purchaseOrderLineId}`);
        const quantity = new Prisma.Decimal(received.quantity);
        if (quantity.lessThanOrEqualTo(0)) {
          throw new BadRequestException('La quantité réceptionnée doit être strictement positive');
        }
        const remaining = line.quantityOrdered.minus(line.quantityReceived);
        if (quantity.greaterThan(remaining)) {
          throw new BadRequestException(
            `Quantité reçue (${quantity.toString()}) supérieure au restant dû pour "${line.productNameSnapshot}" (${remaining.toString()})`,
          );
        }

        await this.inventory.applyStockMovementWithTx(
          tx,
          tenantId,
          order.locationId,
          line.productId,
          quantity,
          'purchase_receipt',
          'purchase',
          order.id,
        );
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { quantityReceived: line.quantityReceived.plus(quantity) },
        });
        receivedValue = receivedValue.plus(quantity.times(line.unitCostSnapshot));
      }

      if (receivedValue.greaterThan(0)) {
        await this.suppliers.recordPurchaseDebtWithTx(tx, tenantId, order.supplierId, receivedValue, order.id);
      }

      const refreshedLines = await tx.purchaseOrderLine.findMany({ where: { tenantId, purchaseOrderId: id } });
      const fullyReceived = refreshedLines.every((l) => l.quantityReceived.greaterThanOrEqualTo(l.quantityOrdered));
      const newStatus = fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      const updated = await tx.purchaseOrder.update({ where: { id }, data: { status: newStatus } });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'purchases.order.received',
          payload: {
            actorUserId,
            entityType: 'PurchaseOrder',
            entityId: id,
            receivedValue: receivedValue.toString(),
            status: newStatus,
          },
        },
      });

      return { ...updated, lines: refreshedLines };
    });
  }

  async cancel(tenantId: string, actorUserId: string, id: string, reason?: string) {
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.purchaseOrder.findFirst({ where: { id, tenantId } });
      if (!order) throw new NotFoundException('Commande fournisseur introuvable');
      if (!(ACTIVE_STATUSES as readonly string[]).includes(order.status)) {
        throw new BadRequestException(`Une commande ${order.status} ne peut pas être annulée`);
      }
      if (order.status === 'PARTIALLY_RECEIVED') {
        throw new BadRequestException(
          'Une commande déjà partiellement réceptionnée ne peut plus être annulée (stock et dette déjà engagés)',
        );
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'purchases.order.cancelled',
          payload: { actorUserId, entityType: 'PurchaseOrder', entityId: id, reason: reason ?? null },
        },
      });
      return updated;
    });
  }
}

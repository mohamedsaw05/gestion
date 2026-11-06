import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId, newTransactionalId, PERMISSIONS, SETTINGS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { UnitsService } from '../units/units.service.js';
import { ConfigurationService } from '../config/config.service.js';
import { SalesService } from '../sales/sales.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { CompleteOrderPaymentDto } from './dto/complete-order.dto.js';

const ACTIVE_STATUSES = ['DRAFT', 'CONFIRMED', 'PREPARING', 'READY'] as const;
type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

const NEXT_STATUS: Record<ActiveStatus, ActiveStatus | null> = {
  DRAFT: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: null, // READY se termine par complete(), pas par "progresser" une étape de plus
};

/**
 * Order Engine (Phase 11). Une COMMANDE n'est jamais une VENTE : elle
 * n'affecte JAMAIS le stock avant sa complétion — cf commentaire du modèle
 * Order dans schema.prisma. La complétion délègue entièrement à
 * SalesService.create (stock, paiement, crédit, documents, événements) :
 * ce service ne duplique aucune de cette logique transactionnelle.
 *
 * Réservation de stock à la confirmation = PLANNED (Inventory 2.0, Phase 17).
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly pricing: PricingService,
    private readonly units: UnitsService,
    private readonly config: ConfigurationService,
    private readonly sales: SalesService,
    private readonly inventory: InventoryService,
    private readonly rbac: RbacService,
  ) {}

  /** Même mécanisme de visibilité par scope que SalesService — cf RbacService.getRecordVisibility. */
  private async buildVisibilityWhere(tenantId: string, userId: string): Promise<Prisma.OrderWhereInput> {
    const visibility = await this.rbac.getRecordVisibility(tenantId, userId, PERMISSIONS.ORDERS_READ);
    if (visibility.allLocations) return {};

    const or: Prisma.OrderWhereInput[] = [];
    if (visibility.locationIds.length > 0) or.push({ locationId: { in: visibility.locationIds } });
    if (visibility.ownRecordsOnly) or.push({ sellerUserId: userId });
    if (visibility.teamLocationIds.length > 0) {
      const teamUserIds = await this.rbac.resolveTeamMemberUserIds(tenantId, visibility.teamLocationIds);
      if (teamUserIds.length > 0) or.push({ sellerUserId: { in: teamUserIds } });
    }
    return or.length > 0 ? { OR: or } : { id: '__none__' };
  }

  async list(tenantId: string, userId: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    return this.db.run(tenantId, (tx) =>
      tx.order.findMany({
        where: { tenantId, ...visibilityWhere },
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async getById(tenantId: string, userId: string, id: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    const order = await this.db.run(tenantId, (tx) =>
      tx.order.findFirst({ where: { id, tenantId, ...visibilityWhere }, include: { lines: true } }),
    );
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }

  async create(tenantId: string, sellerUserId: string, dto: CreateOrderDto) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.order.findFirst({
        where: { tenantId, operationId: dto.operationId },
        include: { lines: true },
      });
      if (existing) return existing;

      const currency =
        dto.currency ?? (await this.config.getWithTx<string>(tx, tenantId, SETTINGS.DEFAULT_CURRENCY));
      const orderId = newTransactionalId();

      const productIds = dto.lines.map((l) => l.productId);
      const products = await tx.product.findMany({
        where: { tenantId, id: { in: productIds }, deletedAt: null },
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      let subtotal = new Prisma.Decimal(0);
      const lineInputs: {
        productId: string;
        productNameSnapshot: string;
        unitSnapshot: string;
        quantity: Prisma.Decimal;
        conversionFactorSnapshot: Prisma.Decimal;
        unitPriceSnapshot: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }[] = [];

      for (const line of dto.lines) {
        const product = productById.get(line.productId);
        if (!product) {
          throw new BadRequestException(`Produit introuvable ou inactif : ${line.productId}`);
        }
        const quantity = new Prisma.Decimal(line.quantity);
        if (quantity.lessThanOrEqualTo(0)) {
          throw new BadRequestException('La quantité doit être strictement positive');
        }

        const resolvedUnit = await this.units.resolveUnit(tx, tenantId, product.id, product.unit, line.unit);
        const referenceQuantity = quantity.times(resolvedUnit.factor);

        const { unitPrice: referenceUnitPrice } = await this.pricing.resolveUnitPrice(
          tx,
          tenantId,
          product.id,
          dto.customerId,
          referenceQuantity,
          product.basePrice,
        );
        const unitPriceInOrderedUnit = referenceUnitPrice.times(resolvedUnit.factor);
        const lineTotal = referenceUnitPrice.times(referenceQuantity);
        subtotal = subtotal.plus(lineTotal);

        lineInputs.push({
          productId: product.id,
          productNameSnapshot: product.name,
          unitSnapshot: resolvedUnit.unit,
          quantity,
          conversionFactorSnapshot: resolvedUnit.factor,
          unitPriceSnapshot: unitPriceInOrderedUnit,
          lineTotal,
        });
      }

      await tx.order.create({
        data: {
          id: orderId,
          tenantId,
          locationId: dto.locationId,
          customerId: dto.customerId,
          sellerUserId,
          currency,
          subtotal,
          operationId: dto.operationId,
        },
      });
      for (const line of lineInputs) {
        await tx.orderLine.create({ data: { id: newTransactionalId(), tenantId, orderId, ...line } });
      }

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'orders.order.created',
          payload: { actorUserId: sellerUserId, entityType: 'Order', entityId: orderId, subtotal: subtotal.toString() },
        },
      });

      return tx.order.findFirst({ where: { id: orderId }, include: { lines: true } });
    });
  }

  /**
   * Réservation de stock (Phase 13) : incrémente StockLevel.quantityReserved
   * pour chaque ligne stockée — le stock reste physiquement en rayon mais
   * n'est plus DISPONIBLE pour une autre vente/commande tant que celle-ci
   * n'est pas complétée ou annulée. Un produit non stocké (service, bundle,
   * inventaire désactivé) est silencieusement ignoré — pas d'erreur, pas de
   * réservation à faire.
   */
  private async reserveOrderStockWithTx(tx: Prisma.TransactionClient, tenantId: string, orderId: string, locationId: string) {
    const lines = await tx.orderLine.findMany({ where: { tenantId, orderId } });
    const products = await tx.product.findMany({ where: { tenantId, id: { in: lines.map((l) => l.productId) } } });
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const line of lines) {
      const product = productById.get(line.productId);
      if (!product?.isStocked) continue;
      const referenceQuantity = line.quantity.times(line.conversionFactorSnapshot);
      await this.inventory.reserveStockWithTx(tx, tenantId, locationId, line.productId, referenceQuantity, line.productNameSnapshot);
    }
  }

  /** Symétrique de reserveOrderStockWithTx — appelée à l'annulation ET à la complétion. */
  private async releaseOrderStockWithTx(tx: Prisma.TransactionClient, tenantId: string, orderId: string, locationId: string) {
    const lines = await tx.orderLine.findMany({ where: { tenantId, orderId } });
    const products = await tx.product.findMany({ where: { tenantId, id: { in: lines.map((l) => l.productId) } } });
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const line of lines) {
      const product = productById.get(line.productId);
      if (!product?.isStocked) continue;
      const referenceQuantity = line.quantity.times(line.conversionFactorSnapshot);
      await this.inventory.releaseStockReservationWithTx(tx, tenantId, locationId, line.productId, referenceQuantity);
    }
  }

  /** Fait progresser la commande d'une étape (DRAFT→CONFIRMED→PREPARING→READY). */
  async advance(tenantId: string, actorUserId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id, tenantId } });
      if (!order) throw new NotFoundException('Commande introuvable');
      if (!(ACTIVE_STATUSES as readonly string[]).includes(order.status)) {
        throw new BadRequestException(`Une commande ${order.status} ne peut plus progresser`);
      }
      const next = NEXT_STATUS[order.status as ActiveStatus];
      if (!next) {
        throw new BadRequestException(
          'Cette commande est prête : utilisez la finalisation pour la transformer en vente',
        );
      }

      // La réservation n'a lieu qu'UNE fois, à la toute première confirmation
      // (DRAFT→CONFIRMED) — les étapes suivantes (PREPARING, READY) ne
      // touchent jamais le stock, seulement le statut.
      if (order.status === 'DRAFT' && next === 'CONFIRMED') {
        await this.reserveOrderStockWithTx(tx, tenantId, id, order.locationId);
      }

      const updated = await tx.order.update({
        where: { id },
        data: { status: next, confirmedAt: next === 'CONFIRMED' ? new Date() : order.confirmedAt },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'orders.order.status_changed',
          payload: { actorUserId, entityType: 'Order', entityId: id, before: order.status, after: next },
        },
      });
      return updated;
    });
  }

  async recordDeposit(tenantId: string, actorUserId: string, id: string, amountInput: string, method: string) {
    const amount = new Prisma.Decimal(amountInput);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Le montant de l'acompte doit être strictement positif");
    }
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id, tenantId } });
      if (!order) throw new NotFoundException('Commande introuvable');
      if (!(ACTIVE_STATUSES as readonly string[]).includes(order.status)) {
        throw new BadRequestException(`Impossible d'enregistrer un acompte sur une commande ${order.status}`);
      }
      const newDeposit = order.depositPaid.plus(amount);
      if (newDeposit.greaterThan(order.subtotal)) {
        throw new BadRequestException(
          `L'acompte total (${newDeposit.toString()}) dépasserait le montant de la commande (${order.subtotal.toString()})`,
        );
      }

      const updated = await tx.order.update({
        where: { id },
        data: { depositPaid: newDeposit, depositMethod: method },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'orders.order.deposit_recorded',
          payload: { actorUserId, entityType: 'Order', entityId: id, amount: amount.toString(), method },
        },
      });
      return updated;
    });
  }

  async cancel(tenantId: string, actorUserId: string, id: string, reason?: string) {
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id, tenantId } });
      if (!order) throw new NotFoundException('Commande introuvable');
      if (order.status === 'COMPLETED') {
        throw new BadRequestException('Une commande déjà transformée en vente ne peut pas être annulée');
      }
      if (order.status === 'CANCELLED') {
        return order;
      }

      // Réservation existante SEULEMENT si la commande a dépassé DRAFT au
      // moins une fois — DRAFT n'a jamais réservé quoi que ce soit (rien à
      // libérer, un DRAFT annulé n'a jamais touché le stock).
      if (order.status !== 'DRAFT') {
        await this.releaseOrderStockWithTx(tx, tenantId, id, order.locationId);
      }

      const updated = await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'orders.order.cancelled',
          payload: { actorUserId, entityType: 'Order', entityId: id, reason: reason ?? null },
        },
      });
      return updated;
    });
  }

  /**
   * Transforme la commande en VENTE réelle — délègue entièrement à
   * SalesService.create. L'operationId de la vente est dérivé de l'id de la
   * commande (déterministe) : si `complete()` est rejouée après un incident
   * partiel (vente créée mais Order pas encore marqué COMPLETED), la seconde
   * tentative retrouve la MÊME vente via l'idempotence déjà native de
   * SalesService plutôt que d'en créer une seconde.
   */
  async complete(tenantId: string, actorUserId: string, id: string, payments?: CompleteOrderPaymentDto[]) {
    const order = await this.db.run(tenantId, (tx) =>
      tx.order.findFirst({ where: { id, tenantId }, include: { lines: true } }),
    );
    if (!order) throw new NotFoundException('Commande introuvable');

    if (order.status === 'COMPLETED') {
      return order; // idempotent : déjà complétée, rien à refaire
    }
    if (order.status === 'DRAFT' || order.status === 'CANCELLED') {
      throw new BadRequestException(
        `Une commande ${order.status} doit d'abord être confirmée avant de pouvoir être finalisée`,
      );
    }

    // Contrôle d'expiration de validité du devis (15 jours par défaut, configurable)
    const quoteValiditySetting = await this.db.run(tenantId, (tx) =>
      this.config.getWithTx<string>(tx, tenantId, SETTINGS.QUOTE_VALIDITY_DAYS),
    );
    const validityDays = quoteValiditySetting ? Number(quoteValiditySetting) : 15;
    if (validityDays > 0) {
      const createdAtMs = new Date(order.createdAt).getTime();
      const elapsedDays = (Date.now() - createdAtMs) / (1000 * 3600 * 24);
      if (elapsedDays > validityDays) {
        throw new BadRequestException(
          `Ce devis a expiré (validité de ${validityDays} jours dépassée). Veuillez actualiser les prix ou émettre un nouveau devis.`,
        );
      }
    }

    const allPayments = [
      ...(order.depositPaid.greaterThan(0)
        ? [{ method: order.depositMethod ?? 'CASH', amount: order.depositPaid.toString() }]
        : []),
      ...(payments ?? []).map((p) => ({ method: p.method, amount: p.amount })),
    ];

    const sale = await this.sales.create(tenantId, actorUserId, {
      locationId: order.locationId,
      customerId: order.customerId ?? undefined,
      currency: order.currency,
      operationId: order.id,
      lines: order.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity.toString(),
        unit: l.unitSnapshot ?? undefined,
        unitPriceOverride: l.unitPriceSnapshot.toString(),
      })),
      payments: allPayments as { method: 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'CHECK'; amount: string }[],
    });

    return this.db.run(tenantId, async (tx) => {
      // Le stock a RÉELLEMENT été décrémenté par SalesService.create ci-dessus
      // — la réservation posée à la confirmation n'a plus de raison d'être,
      // elle est libérée ICI (jamais avant sales.create, qui ouvre sa propre
      // transaction : la libérer trop tôt laisserait une fenêtre où le stock
      // seraît ni réservé ni encore réellement vendu).
      await this.releaseOrderStockWithTx(tx, tenantId, id, order.locationId);

      const updated = await tx.order.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date(), saleId: sale!.id },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'orders.order.completed',
          payload: { actorUserId, entityType: 'Order', entityId: id, saleId: sale!.id },
        },
      });
      return { ...updated, sale };
    });
  }
}

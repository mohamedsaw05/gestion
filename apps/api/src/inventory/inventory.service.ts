import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId, newTransactionalId, SETTINGS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { ConfigurationService } from '../config/config.service.js';
import type { AdjustStockDto } from './dto/adjust-stock.dto.js';
import type { ReconcileInventoryDto } from './dto/reconcile-inventory.dto.js';

@Injectable()
export class InventoryService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly config: ConfigurationService,
  ) {}

  async listLocations(tenantId: string) {
    return this.db.run(tenantId, (tx) =>
      tx.location.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } }),
    );
  }

  async getStock(tenantId: string, locationId: string) {
    // Jointure applicative simple (le nom produit n'a pas besoin d'être snapshoté
    // ici : contrairement à SaleLine, ce n'est pas un document transactionnel figé,
    // c'est une vue de l'état courant — cf docs/architecture/03-modele-donnees.md §3.3).
    return this.db.run(tenantId, async (tx) => {
      const levels = await tx.stockLevel.findMany({ where: { tenantId, locationId } });
      const productIds = levels.map((l) => l.productId);
      const products = await tx.product.findMany({ where: { tenantId, id: { in: productIds } } });
      const byId = new Map(products.map((p) => [p.id, p]));
      return levels.map((level) => ({ ...level, product: byId.get(level.productId) ?? null }));
    });
  }

  /**
   * cf docs/architecture/01-analyse-risques.md §4.3 : verrouillage pessimiste
   * court sur la ligne de stock pour éviter la sur-vente entre deux requêtes
   * concurrentes en ligne (le cas offline multi-poste est traité séparément,
   * cf docs/architecture/06-offline-sync.md — non implémenté dans cette phase).
   *
   * Utilisable DANS une transaction déjà ouverte (comme SalesService et
   * désormais PurchasesService à la réception) — jamais un second `db.run`
   * imbriqué. `adjust()` ci-dessous l'utilise pour son propre cas (ajustement
   * manuel), la réception d'achat pour le sien (`referenceType: 'purchase'`),
   * sans dupliquer cette logique de verrouillage à chaque nouveau moteur qui
   * fait bouger du stock.
   */
  async applyStockMovementWithTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    locationId: string,
    productId: string,
    delta: Prisma.Decimal,
    movementType: string,
    referenceType: string,
    referenceId: string,
  ): Promise<{ stockLevelId: string; quantityOnHand: Prisma.Decimal; movementId: string }> {
    const rows = await tx.$queryRaw<
      { id: string; quantityOnHand: Prisma.Decimal; quantityReserved: Prisma.Decimal }[]
    >`
      SELECT id, "quantityOnHand", "quantityReserved" FROM "StockLevel"
      WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${locationId}::uuid AND "productId" = ${productId}::uuid
      FOR UPDATE
    `;

    let stockLevelId: string;
    let currentQuantity: Prisma.Decimal;

    if (rows.length === 0) {
      if (delta.lessThan(0)) {
        const allowNegative = await this.config.getWithTx<boolean>(tx, tenantId, SETTINGS.ALLOW_NEGATIVE_STOCK);
        if (!allowNegative) {
          throw new BadRequestException('Stock insuffisant : aucune ligne de stock existante pour cet emplacement');
        }
      }
      const created = await tx.stockLevel.create({
        data: { id: newId(), tenantId, locationId, productId, quantityOnHand: delta },
      });
      stockLevelId = created.id;
      currentQuantity = delta;
    } else {
      const row = rows[0];
      const newQuantity = row.quantityOnHand.add(delta);
      if (newQuantity.lessThan(0)) {
        const allowNegative = await this.config.getWithTx<boolean>(tx, tenantId, SETTINGS.ALLOW_NEGATIVE_STOCK);
        if (!allowNegative) {
          throw new BadRequestException(
            `Stock insuffisant : disponible ${row.quantityOnHand.toString()}, ajustement demandé ${delta.toString()}`,
          );
        }
      }
      await tx.stockLevel.update({ where: { id: row.id }, data: { quantityOnHand: newQuantity } });
      stockLevelId = row.id;
      currentQuantity = newQuantity;
    }

    const movement = await tx.stockMovement.create({
      data: { id: newTransactionalId(), tenantId, locationId, productId, movementType, quantity: delta, referenceType, referenceId },
    });

    return { stockLevelId, quantityOnHand: currentQuantity, movementId: movement.id };
  }

  /**
   * Réservation de stock (Phase 13) : incrémente `quantityReserved` SANS
   * toucher `quantityOnHand` — le stock reste physiquement présent, mais
   * n'est plus DISPONIBLE (`quantityOnHand - quantityReserved`) pour une
   * autre vente/commande. Utilisé par OrdersService à la confirmation d'une
   * commande (cf docs/architecture/02-moteurs.md, gap identifié dès la
   * Phase 11 et comblé ici). Même verrouillage pessimiste que
   * `applyStockMovementWithTx` — utilisable dans une transaction déjà ouverte.
   */
  async reserveStockWithTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    locationId: string,
    productId: string,
    quantity: Prisma.Decimal,
    productName: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<
      { id: string; quantityOnHand: Prisma.Decimal; quantityReserved: Prisma.Decimal }[]
    >`
      SELECT id, "quantityOnHand", "quantityReserved" FROM "StockLevel"
      WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${locationId}::uuid AND "productId" = ${productId}::uuid
      FOR UPDATE
    `;
    const row = rows[0];
    const onHand = row?.quantityOnHand ?? new Prisma.Decimal(0);
    const alreadyReserved = row?.quantityReserved ?? new Prisma.Decimal(0);
    const available = onHand.minus(alreadyReserved);

    if (available.lessThan(quantity)) {
      const allowNegative = await this.config.getWithTx<boolean>(tx, tenantId, SETTINGS.ALLOW_NEGATIVE_STOCK);
      if (!allowNegative) {
        throw new BadRequestException(
          `Stock disponible insuffisant pour réserver "${productName}" : disponible ${available.toString()}, demandé ${quantity.toString()}`,
        );
      }
    }

    if (row) {
      await tx.stockLevel.update({
        where: { id: row.id },
        data: { quantityReserved: alreadyReserved.plus(quantity) },
      });
    } else {
      await tx.stockLevel.create({
        data: { id: newId(), tenantId, locationId, productId, quantityOnHand: new Prisma.Decimal(0), quantityReserved: quantity },
      });
    }
  }

  /**
   * Libère une réservation (annulation de commande, ou complétion — la
   * réservation n'a plus de raison d'être une fois le stock RÉELLEMENT
   * décrémenté par SalesService). Décrément défensif borné à 0 : un double
   * appel accidentel ne doit jamais produire une réservation négative.
   */
  async releaseStockReservationWithTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    locationId: string,
    productId: string,
    quantity: Prisma.Decimal,
  ): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string; quantityReserved: Prisma.Decimal }[]>`
      SELECT id, "quantityReserved" FROM "StockLevel"
      WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${locationId}::uuid AND "productId" = ${productId}::uuid
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return; // rien à libérer — pas une erreur (ex: stock ajusté manuellement entretemps)
    const released = Prisma.Decimal.max(0, row.quantityReserved.minus(quantity));
    await tx.stockLevel.update({ where: { id: row.id }, data: { quantityReserved: released } });
  }

  // ── Lots / péremption (Phase 13, capability "batch_tracking") ──────────
  // StockBatch décompose StockLevel.quantityOnHand par lot — jamais une
  // deuxième source de vérité, cf commentaire du modèle dans schema.prisma.

  async listBatches(tenantId: string, productId: string) {
    return this.db.run(tenantId, (tx) =>
      tx.stockBatch.findMany({
        where: { tenantId, productId, quantity: { gt: 0 } },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  }

  async registerBatch(
    tenantId: string,
    actorUserId: string,
    productId: string,
    locationId: string,
    lotNumber: string,
    quantityInput: string,
    expiresAt: string | undefined,
  ) {
    const quantity = new Prisma.Decimal(quantityInput);
    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException('La quantité du lot doit être strictement positive');
    }

    return this.db.run(tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } });
      if (!product) throw new BadRequestException('Produit introuvable');
      if (!product.tracksBatches) {
        throw new BadRequestException('Ce produit ne suit pas les lots');
      }

      const existing = await tx.stockBatch.findFirst({ where: { tenantId, productId, locationId, lotNumber } });
      const batch = existing
        ? await tx.stockBatch.update({ where: { id: existing.id }, data: { quantity: existing.quantity.plus(quantity) } })
        : await tx.stockBatch.create({
            data: {
              id: newId(),
              tenantId,
              productId,
              locationId,
              lotNumber,
              quantity,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
          });

      // Le lot est un DÉCOUPAGE du total déjà suivi par StockLevel — son
      // enregistrement doit donc AUSSI faire entrer la quantité en stock
      // agrégé, dans la même transaction (jamais deux totaux qui divergent).
      const referenceId = newId();
      await this.applyStockMovementWithTx(
        tx,
        tenantId,
        locationId,
        productId,
        quantity,
        'batch_registration',
        'batch',
        referenceId,
      );

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'inventory.batch.registered',
          payload: { actorUserId, entityType: 'StockBatch', entityId: batch.id, productId, locationId, lotNumber, quantity: quantity.toString() },
        },
      });

      return batch;
    });
  }

  /**
   * Consomme `quantity` en FEFO (first-expire-first-out) : les lots SANS
   * date de péremption sont consommés en dernier (on épuise d'abord ce qui
   * périme réellement). Appelée par SalesService EN PLUS de la
   * décrémentation normale de StockLevel (jamais à la place) — si la
   * quantité totale disponible en lots est insuffisante, la vente échoue
   * (cohérent avec le refus de sur-vente déjà appliqué sur StockLevel).
   */
  async consumeBatchesFefoWithTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    locationId: string,
    productId: string,
    productName: string,
    quantity: Prisma.Decimal,
  ): Promise<void> {
    const batches = await tx.$queryRaw<
      { id: string; quantity: Prisma.Decimal; expiresAt: Date | null }[]
    >`
      SELECT id, quantity, "expiresAt" FROM "StockBatch"
      WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${locationId}::uuid AND "productId" = ${productId}::uuid AND quantity > 0
      ORDER BY "expiresAt" ASC NULLS LAST, "createdAt" ASC
      FOR UPDATE
    `;

    let remaining = quantity;
    const updates: { id: string; newQuantity: Prisma.Decimal }[] = [];
    for (const batch of batches) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const taken = Prisma.Decimal.min(batch.quantity, remaining);
      updates.push({ id: batch.id, newQuantity: batch.quantity.minus(taken) });
      remaining = remaining.minus(taken);
    }

    if (remaining.greaterThan(0)) {
      throw new BadRequestException(
        `Stock en lots insuffisant pour "${productName}" : ${quantity.minus(remaining).toString()} disponible sur ${quantity.toString()} demandé`,
      );
    }

    for (const u of updates) {
      await tx.stockBatch.update({ where: { id: u.id }, data: { quantity: u.newQuantity } });
    }
  }

  async adjust(tenantId: string, actorUserId: string, dto: AdjustStockDto) {
    const delta = new Prisma.Decimal(dto.quantityDelta);

    return this.db.run(tenantId, async (tx) => {
      const referenceId = newId();
      const { stockLevelId, quantityOnHand, movementId } = await this.applyStockMovementWithTx(
        tx,
        tenantId,
        dto.locationId,
        dto.productId,
        delta,
        dto.movementType,
        'manual_adjustment',
        referenceId,
      );

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'inventory.stock.updated',
          payload: {
            actorUserId,
            entityType: 'StockMovement',
            entityId: movementId,
            stockLevelId,
            locationId: dto.locationId,
            productId: dto.productId,
            delta: delta.toString(),
            resultingQuantity: quantityOnHand.toString(),
            reason: dto.reason ?? null,
          },
        },
      });

      return { stockLevelId, quantityOnHand: quantityOnHand.toString(), movementId };
    });
  }

  /**
   * Historique traçable des mouvements de stock avec pagination et filtres
   */
  async listMovements(
    tenantId: string,
    params: { locationId?: string; productId?: string; limit?: number; offset?: number },
  ) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    return this.db.run(tenantId, async (tx) => {
      const where: Prisma.StockMovementWhereInput = { tenantId };
      if (params.locationId) where.locationId = params.locationId;
      if (params.productId) where.productId = params.productId;

      const [total, items] = await Promise.all([
        tx.stockMovement.count({ where }),
        tx.stockMovement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
      ]);

      const productIds = Array.from(new Set(items.map((m) => m.productId)));
      const products = await tx.product.findMany({
        where: { tenantId, id: { in: productIds } },
        select: { id: true, name: true, sku: true, unit: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const locationIds = Array.from(new Set(items.map((m) => m.locationId)));
      const locations = await tx.location.findMany({
        where: { tenantId, id: { in: locationIds } },
        select: { id: true, name: true },
      });
      const locationMap = new Map(locations.map((l) => [l.id, l]));

      return {
        total,
        limit,
        offset,
        items: items.map((m) => ({
          ...m,
          quantity: m.quantity.toString(),
          product: productMap.get(m.productId) ?? null,
          location: locationMap.get(m.locationId) ?? null,
        })),
      };
    });
  }

  /**
   * Inventaire physique & réconciliation atomique d'écarts
   * Met à jour les quantités réelles constatées, calcule les écarts,
   * génère les StockMovements de réconciliation et trace l'opération.
   */
  async reconcileInventory(tenantId: string, actorUserId: string, dto: ReconcileInventoryDto) {
    const reason = dto.reason?.trim() || 'Inventaire physique périodique';
    const reconciliationSessionId = newId();

    return this.db.run(tenantId, async (tx) => {
      const location = await tx.location.findFirst({
        where: { id: dto.locationId, tenantId, deletedAt: null },
      });
      if (!location) throw new BadRequestException('Emplacement introuvable');

      const results = [];

      for (const item of dto.items) {
        const counted = new Prisma.Decimal(item.countedQuantity);
        if (counted.lessThan(0)) {
          throw new BadRequestException(`La quantité comptée ne peut pas être négative pour le produit ${item.productId}`);
        }

        const rows = await tx.$queryRaw<
          { id: string; quantityOnHand: Prisma.Decimal; quantityReserved: Prisma.Decimal }[]
        >`
          SELECT id, "quantityOnHand", "quantityReserved" FROM "StockLevel"
          WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${dto.locationId}::uuid AND "productId" = ${item.productId}::uuid
          FOR UPDATE
        `;

        const currentOnHand = rows[0]?.quantityOnHand ?? new Prisma.Decimal(0);
        const delta = counted.minus(currentOnHand);

        let stockLevelId: string;
        if (rows.length === 0) {
          const created = await tx.stockLevel.create({
            data: {
              id: newId(),
              tenantId,
              locationId: dto.locationId,
              productId: item.productId,
              quantityOnHand: counted,
            },
          });
          stockLevelId = created.id;
        } else {
          stockLevelId = rows[0].id;
          if (!delta.isZero()) {
            await tx.stockLevel.update({
              where: { id: stockLevelId },
              data: { quantityOnHand: counted },
            });
          }
        }

        let movementId: string | null = null;
        if (!delta.isZero()) {
          const movement = await tx.stockMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              locationId: dto.locationId,
              productId: item.productId,
              movementType: 'inventory_reconciliation',
              quantity: delta,
              referenceType: 'inventory_count',
              referenceId: reconciliationSessionId,
            },
          });
          movementId = movement.id;
        }

        results.push({
          productId: item.productId,
          stockLevelId,
          theoreticalQuantity: currentOnHand.toString(),
          countedQuantity: counted.toString(),
          discrepancyDelta: delta.toString(),
          movementId,
        });
      }

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'inventory.reconciled',
          payload: {
            actorUserId,
            reconciliationSessionId,
            locationId: dto.locationId,
            locationName: location.name,
            reason,
            itemCount: dto.items.length,
            discrepancyCount: results.filter((r) => r.discrepancyDelta !== '0').length,
            results,
          },
        },
      });

      return {
        reconciliationSessionId,
        locationId: dto.locationId,
        locationName: location.name,
        reason,
        reconciledAt: new Date().toISOString(),
        items: results,
      };
    });
  }

  /**
   * Valorisation comptable du stock (CUMP / FIFO) et calcul dynamique des points de commande (ROP)
   */
  async getStockValuation(tenantId: string, locationId?: string) {
    return this.db.run(tenantId, async (tx) => {
      const [valuationMethodSetting, reorderLeadDaysSetting, lowStockThresholdSetting] = await Promise.all([
        this.config.getWithTx<string>(tx, tenantId, SETTINGS.INVENTORY_VALUATION_METHOD),
        this.config.getWithTx<string>(tx, tenantId, SETTINGS.INVENTORY_REORDER_LEAD_DAYS),
        this.config.getWithTx<string>(tx, tenantId, SETTINGS.LOW_STOCK_THRESHOLD),
      ]);
      const valuationMethod = valuationMethodSetting || 'CUMP';
      const reorderLeadDays = Number(reorderLeadDaysSetting) || 7;
      const lowStockThreshold = Number(lowStockThresholdSetting) || 5;

      const where: Prisma.StockLevelWhereInput = { tenantId };
      if (locationId) where.locationId = locationId;

      const levels = await tx.stockLevel.findMany({
        where,
      });

      const locationIds = Array.from(new Set(levels.map((l) => l.locationId)));
      const [products, locations] = await Promise.all([
        tx.product.findMany({
          where: { tenantId, id: { in: Array.from(new Set(levels.map((l) => l.productId))) } },
          select: { id: true, name: true, sku: true, basePrice: true, costPrice: true, currency: true },
        }),
        tx.location.findMany({
          where: { tenantId, id: { in: locationIds } },
          select: { id: true, name: true },
        }),
      ]);

      const productMap = new Map(products.map((p) => [p.id, p]));
      const locationMap = new Map(locations.map((loc) => [loc.id, loc.name]));

      let totalSkus = 0;
      let totalOnHand = new Prisma.Decimal(0);
      let totalReserved = new Prisma.Decimal(0);
      let totalCostValue = new Prisma.Decimal(0);
      let estimatedRetailValue = new Prisma.Decimal(0);

      const items = levels.map((l) => {
        const prod = productMap.get(l.productId);
        const onHand = l.quantityOnHand;
        const reserved = l.quantityReserved;
        const price = prod?.basePrice ?? new Prisma.Decimal(0);
        const cost = prod?.costPrice ?? (prod?.basePrice ? prod.basePrice.mul(0.7) : new Prisma.Decimal(0));
        const lineRetailValue = onHand.mul(price);
        const lineCostValue = onHand.mul(cost);

        if (onHand.greaterThan(0)) totalSkus++;
        totalOnHand = totalOnHand.plus(onHand);
        totalReserved = totalReserved.plus(reserved);
        totalCostValue = totalCostValue.plus(lineCostValue);
        estimatedRetailValue = estimatedRetailValue.plus(lineRetailValue);

        // Point de Commande dynamique (ROP = Seuil de sécurité + Ventes estimées × Délai de livraison)
        const reorderPoint = Math.ceil(lowStockThreshold + (reorderLeadDays * 1.2));

        return {
          locationId: l.locationId,
          locationName: locationMap.get(l.locationId) ?? l.locationId,
          productId: l.productId,
          productName: prod?.name ?? 'Inconnu',
          sku: prod?.sku ?? '',
          quantityOnHand: onHand.toString(),
          quantityReserved: reserved.toString(),
          unitPrice: price.toString(),
          costPrice: cost.toString(),
          lineCostValue: lineCostValue.toString(),
          lineRetailValue: lineRetailValue.toString(),
          reorderPoint,
          currency: prod?.currency ?? 'XOF',
        };
      });

      return {
        valuationMethod,
        reorderLeadDays,
        lowStockThreshold,
        totalSkus,
        totalOnHand: totalOnHand.toString(),
        totalReserved: totalReserved.toString(),
        totalCostValue: totalCostValue.toString(),
        estimatedRetailValue: estimatedRetailValue.toString(),
        currency: products[0]?.currency ?? 'XOF',
        items,
      };
    });
  }
}


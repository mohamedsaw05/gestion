import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newTransactionalId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import type { QuarantineOperationDto } from './dto/quarantine-operation.dto.js';

@Injectable()
export class QuarantineService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * Liste les emplacements de quarantaine et leur stock défectueux / SAV
   */
  async listStock(tenantId: string, quarantineLocationId?: string) {
    return this.db.run(tenantId, async (tx) => {
      const locations = await tx.location.findMany({
        where: {
          tenantId,
          type: 'QUARANTINE',
          id: quarantineLocationId ? quarantineLocationId : undefined,
          deletedAt: null,
        },
      });

      if (locations.length === 0) return [];
      const locationIds = locations.map((l) => l.id);

      const stockLevels = await tx.stockLevel.findMany({
        where: {
          tenantId,
          locationId: { in: locationIds },
          quantityOnHand: { gt: new Prisma.Decimal(0) },
        },
      });

      const productIds = Array.from(new Set(stockLevels.map((s) => s.productId)));
      const products = await tx.product.findMany({
        where: { tenantId, id: { in: productIds } },
        select: { id: true, name: true, sku: true, unit: true, costPrice: true },
      });
      const productById = new Map(products.map((p) => [p.id, p]));
      const locationById = new Map(locations.map((l) => [l.id, l]));

      return stockLevels.map((sl) => {
        const prod = productById.get(sl.productId);
        const loc = locationById.get(sl.locationId);
        return {
          stockLevelId: sl.id,
          locationId: sl.locationId,
          locationName: loc?.name ?? 'Quarantaine',
          productId: sl.productId,
          productName: prod?.name ?? 'Produit inconnu',
          sku: prod?.sku ?? null,
          unit: prod?.unit ?? 'unité',
          quantityInQuarantine: sl.quantityOnHand.toString(),
          estimatedCostPrice: prod?.costPrice?.toString() ?? null,
          updatedAt: sl.updatedAt,
        };
      });
    });
  }

  /**
   * Exécute une opération autorisée et tracée de SAV / Quarantaine
   */
  async performOperation(tenantId: string, actorUserId: string, dto: QuarantineOperationDto) {
    if (!dto.notes || dto.notes.trim().length === 0) {
      throw new BadRequestException('Un rapport technique ou une justification obligatoire est requise');
    }

    const qty = new Prisma.Decimal(dto.quantity);
    if (qty.lessThanOrEqualTo(0)) {
      throw new BadRequestException('La quantité doit être strictement positive');
    }

    return this.db.run(tenantId, async (tx) => {
      const location = await tx.location.findFirst({
        where: { id: dto.quarantineLocationId, tenantId, type: 'QUARANTINE', deletedAt: null },
      });
      if (!location) {
        throw new NotFoundException('Emplacement de quarantaine introuvable');
      }

      const product = await tx.product.findFirst({
        where: { id: dto.productId, tenantId, deletedAt: null },
      });
      if (!product) {
        throw new NotFoundException('Produit introuvable');
      }

      // Verrouillage pessimiste de la ligne de stock en quarantaine
      const stockRows = await tx.$queryRaw<{ id: string; quantityOnHand: Prisma.Decimal }[]>`
        SELECT id, "quantityOnHand" FROM "StockLevel"
        WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${dto.quarantineLocationId}::uuid AND "productId" = ${dto.productId}::uuid
        FOR UPDATE
      `;
      const available = stockRows[0]?.quantityOnHand ?? new Prisma.Decimal(0);

      // Pour les opérations déplaçant ou sortant du stock, vérifier le disponible
      const isMovementOperation = ['RESTOCK', 'SUPPLIER_RETURN', 'EXCHANGE', 'SCRAP'].includes(dto.operation);
      if (isMovementOperation && available.lessThan(qty)) {
        throw new BadRequestException(
          `Stock insuffisant en quarantaine pour "${product.name}" : disponible ${available.toString()}, demandé ${qty.toString()}`,
        );
      }

      const operationId = newTransactionalId();

      switch (dto.operation) {
        case 'RESTOCK': {
          if (!dto.targetLocationId) {
            throw new BadRequestException('targetLocationId (boutique cible) est requis pour une remise en stock');
          }
          const targetLoc = await tx.location.findFirst({
            where: { id: dto.targetLocationId, tenantId, deletedAt: null },
          });
          if (!targetLoc) throw new NotFoundException('Emplacement cible introuvable');

          // Sortie de quarantaine
          await tx.stockLevel.update({
            where: { id: stockRows[0].id },
            data: { quantityOnHand: available.minus(qty) },
          });
          await tx.stockMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              locationId: dto.quarantineLocationId,
              productId: dto.productId,
              movementType: 'transfer_out',
              quantity: qty.negated(),
              referenceType: 'quarantine_restock',
              referenceId: operationId,
            },
          });

          // Entrée dans le stock vendable cible
          await this.inventory.applyStockMovementWithTx(
            tx,
            tenantId,
            dto.targetLocationId,
            dto.productId,
            qty,
            'transfer_in',
            'quarantine_restock',
            operationId,
          );
          break;
        }

        case 'SCRAP': {
          // Sortie définitive du stock pour mise au rebut
          await tx.stockLevel.update({
            where: { id: stockRows[0].id },
            data: { quantityOnHand: available.minus(qty) },
          });
          await tx.stockMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              locationId: dto.quarantineLocationId,
              productId: dto.productId,
              movementType: 'adjustment',
              quantity: qty.negated(),
              referenceType: 'quarantine_scrap',
              referenceId: operationId,
            },
          });
          break;
        }

        case 'SUPPLIER_RETURN': {
          // Sortie de stock pour retour au fournisseur
          await tx.stockLevel.update({
            where: { id: stockRows[0].id },
            data: { quantityOnHand: available.minus(qty) },
          });
          await tx.stockMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              locationId: dto.quarantineLocationId,
              productId: dto.productId,
              movementType: 'adjustment',
              quantity: qty.negated(),
              referenceType: 'quarantine_supplier_return',
              referenceId: operationId,
            },
          });
          break;
        }

        case 'EXCHANGE': {
          if (!dto.targetLocationId) {
            throw new BadRequestException('targetLocationId (boutique délivrant l\'échange) est requis');
          }
          // Sortie de quarantaine pour régularisation de l'article défectueux
          await tx.stockLevel.update({
            where: { id: stockRows[0].id },
            data: { quantityOnHand: available.minus(qty) },
          });
          await tx.stockMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              locationId: dto.quarantineLocationId,
              productId: dto.productId,
              movementType: 'adjustment',
              quantity: qty.negated(),
              referenceType: 'quarantine_exchange',
              referenceId: operationId,
            },
          });
          // Sortie d'une unité vendable de la boutique pour le client
          await this.inventory.applyStockMovementWithTx(
            tx,
            tenantId,
            dto.targetLocationId,
            dto.productId,
            qty.negated(),
            'sale',
            'quarantine_exchange_delivery',
            operationId,
          );
          break;
        }

        case 'DIAGNOSTIC':
        case 'REPAIR':
          // Pas de mouvement de stock direct, acte technique tracé
          break;
      }

      // Journalisation dans l'Outbox transactionnel pour traçabilité intégrale
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: `inventory.quarantine.${dto.operation.toLowerCase()}`,
          payload: {
            actorUserId,
            operation: dto.operation,
            quarantineLocationId: dto.quarantineLocationId,
            productId: dto.productId,
            productName: product.name,
            quantity: qty.toString(),
            targetLocationId: dto.targetLocationId ?? null,
            supplierId: dto.supplierId ?? null,
            notes: dto.notes.trim(),
            cost: dto.cost ?? null,
            operationId,
          },
        },
      });

      return {
        success: true,
        operationId,
        operation: dto.operation,
        productId: dto.productId,
        productName: product.name,
        quantity: qty.toString(),
        notes: dto.notes.trim(),
        performedAt: new Date().toISOString(),
      };
    });
  }
}

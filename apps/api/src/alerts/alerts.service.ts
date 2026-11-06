import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

export interface OperationalAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: 'STOCK' | 'EXPIRATION' | 'CREDIT' | 'CASH';
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  actionUrl: string;
  createdAt: string;
}

@Injectable()
export class AlertsService {
  constructor(private readonly db: PrismaTenantService) {}

  async getOperationalAlerts(tenantId: string): Promise<{ total: number; alerts: OperationalAlert[] }> {
    return this.db.run(tenantId, async (tx) => {
      const alerts: OperationalAlert[] = [];
      const now = new Date();
      const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 1. Alertes de Stock Faible / Rupture
      const lowStockLevels = await tx.stockLevel.findMany({
        where: {
          tenantId,
          quantityOnHand: { lte: new Prisma.Decimal(5) },
        },
        take: 20,
      });

      if (lowStockLevels.length > 0) {
        const productIds = lowStockLevels.map((l) => l.productId);
        const locationIds = lowStockLevels.map((l) => l.locationId);

        const [products, locations] = await Promise.all([
          tx.product.findMany({
            where: { tenantId, id: { in: productIds }, deletedAt: null, isStocked: true },
            select: { id: true, name: true, sku: true },
          }),
          tx.location.findMany({
            where: { tenantId, id: { in: locationIds } },
            select: { id: true, name: true },
          }),
        ]);

        const productMap = new Map(products.map((p) => [p.id, p]));
        const locationMap = new Map(locations.map((loc) => [loc.id, loc]));

        for (const level of lowStockLevels) {
          const product = productMap.get(level.productId);
          if (!product) continue;

          const locationName = locationMap.get(level.locationId)?.name ?? 'Dépôt';
          const onHand = Number(level.quantityOnHand);
          const isOut = onHand <= 0;

          alerts.push({
            id: `stock-${level.id}`,
            severity: isOut ? 'CRITICAL' : 'WARNING',
            category: 'STOCK',
            title: isOut ? `Rupture de stock : ${product.name}` : `Stock faible : ${product.name}`,
            message: `Quantité restante: ${onHand} à l'emplacement « ${locationName} » (Réf: ${product.sku}).`,
            entityType: 'StockLevel',
            entityId: level.id,
            actionUrl: '/inventory',
            createdAt: now.toISOString(),
          });
        }
      }

      // 2. Alertes de Lots Périmés ou Proches de Péremption (< 30 jours)
      const expiringBatches = await tx.stockBatch.findMany({
        where: {
          tenantId,
          quantity: { gt: 0 },
          expiresAt: { lte: inThirtyDays },
        },
        orderBy: { expiresAt: 'asc' },
        take: 15,
      });

      if (expiringBatches.length > 0) {
        const batchProductIds = expiringBatches.map((b) => b.productId);
        const batchProducts = await tx.product.findMany({
          where: { tenantId, id: { in: batchProductIds } },
          select: { id: true, name: true },
        });
        const batchProdMap = new Map(batchProducts.map((p) => [p.id, p]));

        for (const batch of expiringBatches) {
          if (!batch.expiresAt) continue;
          const isExpired = batch.expiresAt.getTime() <= now.getTime();
          const prodName = batchProdMap.get(batch.productId)?.name ?? 'Article';
          const expDateStr = batch.expiresAt.toLocaleDateString('fr-FR');

          alerts.push({
            id: `batch-${batch.id}`,
            severity: isExpired ? 'CRITICAL' : 'WARNING',
            category: 'EXPIRATION',
            title: isExpired ? `Lot périmé : ${prodName}` : `Péremption imminente : ${prodName}`,
            message: `Lot n° ${batch.lotNumber} (${batch.quantity.toString()} unités) - ${isExpired ? 'Périmé depuis le' : 'Expire le'} ${expDateStr}.`,
            entityType: 'StockBatch',
            entityId: batch.id,
            actionUrl: '/products',
            createdAt: now.toISOString(),
          });
        }
      }

      // 3. Alertes Créances Clients Échues (> 30 jours sans mouvement avec solde dû)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const overdueCreditAccounts = await tx.creditAccount.findMany({
        where: {
          tenantId,
          balance: { gt: new Prisma.Decimal(0) },
          updatedAt: { lte: thirtyDaysAgo },
        },
        take: 15,
      });

      if (overdueCreditAccounts.length > 0) {
        const customerIds = overdueCreditAccounts.map((a) => a.customerId);
        const customers = await tx.customer.findMany({
          where: { tenantId, id: { in: customerIds } },
          select: { id: true, name: true, phone: true },
        });
        const custMap = new Map(customers.map((c) => [c.id, c]));

        for (const acc of overdueCreditAccounts) {
          const cust = custMap.get(acc.customerId);
          alerts.push({
            id: `credit-${acc.id}`,
            severity: 'WARNING',
            category: 'CREDIT',
            title: `Créance en retard : ${cust?.name ?? 'Client'}`,
            message: `Solde impayé de ${acc.balance.toString()} XOF sans règlement depuis plus de 30 jours.`,
            entityType: 'CreditAccount',
            entityId: acc.id,
            actionUrl: '/credit',
            createdAt: now.toISOString(),
          });
        }
      }

      // 4. Alertes Sessions de Caisse ouvertes depuis plus de 24h
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const staleCashSessions = await tx.cashSession.findMany({
        where: {
          tenantId,
          status: 'OPEN',
          openedAt: { lte: twentyFourHoursAgo },
        },
        take: 5,
      });

      if (staleCashSessions.length > 0) {
        const cashLocIds = staleCashSessions.map((s) => s.locationId);
        const cashLocations = await tx.location.findMany({
          where: { tenantId, id: { in: cashLocIds } },
          select: { id: true, name: true },
        });
        const cashLocMap = new Map(cashLocations.map((l) => [l.id, l]));

        for (const session of staleCashSessions) {
          const locName = cashLocMap.get(session.locationId)?.name ?? 'Caisse';
          alerts.push({
            id: `cash-${session.id}`,
            severity: 'WARNING',
            category: 'CASH',
            title: `Session de caisse non clôturée : ${locName}`,
            message: `Ouverte depuis le ${session.openedAt.toLocaleDateString('fr-FR')} à ${session.openedAt.toLocaleTimeString('fr-FR')}. Clôture requise pour sécuriser le rapprochement.`,
            entityType: 'CashSession',
            entityId: session.id,
            actionUrl: '/cash',
            createdAt: now.toISOString(),
          });
        }
      }

      return {
        total: alerts.length,
        alerts,
      };
    });
  }
}

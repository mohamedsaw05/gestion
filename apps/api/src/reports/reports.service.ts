import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import type { ReportFilterDto } from './dto/report-filter.dto.js';
import type { StockValuationFilterDto } from './dto/stock-valuation-filter.dto.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly rbac: RbacService,
  ) {}

  /**
   * Vérifie et applique les restrictions de localisation RBAC
   */
  private async resolveLocationFilter(
    tenantId: string,
    userId: string,
    requestedLocationId?: string,
  ): Promise<string[] | undefined> {
    const visibility = await this.rbac.getRecordVisibility(
      tenantId,
      userId,
      PERMISSIONS.REPORTS_SALES_READ,
    );

    if (visibility.allLocations) {
      return requestedLocationId ? [requestedLocationId] : undefined;
    }

    if (requestedLocationId) {
      if (!visibility.locationIds.includes(requestedLocationId)) {
        throw new ForbiddenException("Accès non autorisé pour cet emplacement");
      }
      return [requestedLocationId];
    }

    return visibility.locationIds;
  }

  private buildDateFilter(filter: ReportFilterDto): { gte?: Date; lte?: Date } | undefined {
    if (!filter.startDate && !filter.endDate) return undefined;
    const dateWhere: { gte?: Date; lte?: Date } = {};
    if (filter.startDate) dateWhere.gte = new Date(filter.startDate);
    if (filter.endDate) {
      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);
      dateWhere.lte = end;
    }
    return dateWhere;
  }

  /**
   * Synthèse globale des indicateurs d'activité (ventes, retours, stock, créances)
   */
  async getSummary(tenantId: string, userId: string, filter: ReportFilterDto) {
    const allowedLocations = await this.resolveLocationFilter(tenantId, userId, filter.locationId);
    const dateFilter = this.buildDateFilter(filter);

    return this.db.run(tenantId, async (prisma) => {
      const saleWhere: Prisma.SaleWhereInput = {
        tenantId,
        ...(allowedLocations ? { locationId: { in: allowedLocations } } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      };

      // 1. Agrégat des ventes
      const allSales = await prisma.sale.findMany({
        where: saleWhere,
        select: {
          status: true,
          grandTotal: true,
          subtotal: true,
          taxTotal: true,
          discountTotal: true,
          amountPaid: true,
          balanceDue: true,
          currency: true,
        },
      });

      let completedCount = 0;
      let cancelledCount = 0;
      let grossTotal = 0;
      let subtotal = 0;
      let taxTotal = 0;
      let discountTotal = 0;
      let amountPaid = 0;
      let balanceDue = 0;
      let currency = 'XOF';

      for (const s of allSales) {
        if (s.currency) currency = s.currency;
        if (s.status === 'COMPLETED') {
          completedCount++;
          grossTotal += Number(s.grandTotal);
          subtotal += Number(s.subtotal);
          taxTotal += Number(s.taxTotal);
          discountTotal += Number(s.discountTotal);
          amountPaid += Number(s.amountPaid);
          balanceDue += Number(s.balanceDue);
        } else if (s.status === 'CANCELLED') {
          cancelledCount++;
        }
      }

      const averageCart = completedCount > 0 ? grossTotal / completedCount : 0;

      // 2. Retours et remboursements
      const returnWhere: Prisma.ReturnWhereInput = {
        tenantId,
        ...(allowedLocations ? { locationId: { in: allowedLocations } } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      };

      const returns = await prisma.return.findMany({
        where: returnWhere,
        select: { refundAmount: true },
      });

      const returnCount = returns.length;
      const refundedTotal = returns.reduce((sum: number, r: { refundAmount: Prisma.Decimal | null }) => {
        return sum + Number(r.refundAmount || 0);
      }, 0);
      const netSales = grossTotal - refundedTotal;

      // 3. Valorisation du stock disponible
      const stockLevels = await prisma.stockLevel.findMany({
        where: {
          tenantId,
          ...(allowedLocations ? { locationId: { in: allowedLocations } } : {}),
        },
      });

      const productIds = Array.from(new Set(stockLevels.map((s: { productId: string }) => s.productId)));
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, basePrice: true, costPrice: true },
      });
      const productMap = new Map<string, { basePrice: number; costPrice: number | null }>(
        products.map((p: { id: string; basePrice: Prisma.Decimal; costPrice: Prisma.Decimal | null }) => [
          p.id,
          {
            basePrice: Number(p.basePrice),
            costPrice: p.costPrice !== null ? Number(p.costPrice) : null,
          },
        ]),
      );

      let totalUnitsOnHand = 0;
      let valuationAtSale = 0;
      let valuationAtCost = 0;
      let unknownCostUnits = 0;
      let lowStockCount = 0;

      const thresholdSetting = prisma.tenantSetting?.findFirst
        ? await prisma.tenantSetting.findFirst({
            where: { tenantId, key: 'inventory.lowStockThreshold' },
          })
        : null;
      const threshold = thresholdSetting && typeof thresholdSetting.value === 'string'
        ? Number(thresholdSetting.value) || 5
        : 5;

      for (const sl of stockLevels) {
        const qty = Number(sl.quantityOnHand);
        totalUnitsOnHand += qty;
        const prod = productMap.get(sl.productId);
        const salePrice = prod?.basePrice ?? 0;
        const cost = prod?.costPrice;
        valuationAtSale += qty * salePrice;
        if (cost !== null && cost !== undefined) {
          valuationAtCost += qty * cost;
        } else {
          unknownCostUnits += qty;
        }
        if (qty <= threshold) {
          lowStockCount++;
        }
      }

      // 4. Créances clients ouvertes (dette due au tenant)
      const creditAccounts = await prisma.creditAccount.findMany({
        where: {
          tenantId,
          balance: { gt: 0 },
        },
        select: { balance: true },
      });

      const outstandingDebtTotal = creditAccounts.reduce(
        (sum: number, acc: { balance: Prisma.Decimal }) => sum + Number(acc.balance),
        0,
      );
      const indebtedCustomersCount = creditAccounts.length;

      return {
        period: {
          startDate: filter.startDate || null,
          endDate: filter.endDate || null,
        },
        currency,
        sales: {
          totalSalesCount: allSales.length,
          completedCount,
          cancelledCount,
          grossTotal: Math.round(grossTotal * 100) / 100,
          netSales: Math.round(netSales * 100) / 100,
          subtotal: Math.round(subtotal * 100) / 100,
          taxTotal: Math.round(taxTotal * 100) / 100,
          discountTotal: Math.round(discountTotal * 100) / 100,
          amountPaid: Math.round(amountPaid * 100) / 100,
          balanceDue: Math.round(balanceDue * 100) / 100,
          averageCart: Math.round(averageCart * 100) / 100,
        },
        returns: {
          count: returnCount,
          refundedTotal: Math.round(refundedTotal * 100) / 100,
        },
        inventory: {
          totalUnitsOnHand,
          valuationTotal: Math.round(valuationAtSale * 100) / 100, // prix public de vente
          valuationAtSale: Math.round(valuationAtSale * 100) / 100,
          valuationAtCost: Math.round(valuationAtCost * 100) / 100, // coût d'acquisition / CUMP
          unknownCostUnits,
          lowStockCount,
        },
        credit: {
          outstandingDebtTotal: Math.round(outstandingDebtTotal * 100) / 100,
          indebtedCustomersCount,
        },
      };
    });
  }

  /**
   * Évolution quotidienne des ventes
   */
  async getDailySales(tenantId: string, userId: string, filter: ReportFilterDto) {
    const allowedLocations = await this.resolveLocationFilter(tenantId, userId, filter.locationId);
    const dateFilter = this.buildDateFilter(filter);

    return this.db.run(tenantId, async (prisma) => {
      const sales = await prisma.sale.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          ...(allowedLocations ? { locationId: { in: allowedLocations } } : {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        select: {
          createdAt: true,
          grandTotal: true,
          amountPaid: true,
          balanceDue: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const dayMap = new Map<
        string,
        { date: string; count: number; revenue: number; amountPaid: number; balanceDue: number }
      >();

      for (const s of sales) {
        const dateKey = s.createdAt.toISOString().slice(0, 10);
        const existing = dayMap.get(dateKey) || {
          date: dateKey,
          count: 0,
          revenue: 0,
          amountPaid: 0,
          balanceDue: 0,
        };
        existing.count += 1;
        existing.revenue += Number(s.grandTotal);
        existing.amountPaid += Number(s.amountPaid);
        existing.balanceDue += Number(s.balanceDue);
        dayMap.set(dateKey, existing);
      }

      return Array.from(dayMap.values()).map((d) => ({
        ...d,
        revenue: Math.round(d.revenue * 100) / 100,
        amountPaid: Math.round(d.amountPaid * 100) / 100,
        balanceDue: Math.round(d.balanceDue * 100) / 100,
      }));
    });
  }

  /**
   * Répartition des encaissements par moyen de paiement
   */
  async getByPaymentMethod(tenantId: string, userId: string, filter: ReportFilterDto) {
    const allowedLocations = await this.resolveLocationFilter(tenantId, userId, filter.locationId);
    const dateFilter = this.buildDateFilter(filter);

    return this.db.run(tenantId, async (prisma) => {
      const payments = await prisma.payment.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          sale: {
            status: 'COMPLETED',
            ...(allowedLocations ? { locationId: { in: allowedLocations } } : {}),
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
        },
        select: {
          method: true,
          amount: true,
        },
      });

      const methodMap = new Map<string, { count: number; totalAmount: number }>();
      let grandTotalPaid = 0;

      for (const p of payments) {
        const amount = Number(p.amount);
        grandTotalPaid += amount;
        const existing = methodMap.get(p.method) || { count: 0, totalAmount: 0 };
        existing.count += 1;
        existing.totalAmount += amount;
        methodMap.set(p.method, existing);
      }

      return Array.from(methodMap.entries())
        .map(([method, stats]) => ({
          method,
          count: stats.count,
          totalAmount: Math.round(stats.totalAmount * 100) / 100,
          percentage:
            grandTotalPaid > 0
              ? Math.round((stats.totalAmount / grandTotalPaid) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);
    });
  }

  /**
   * Répartition des ventes par catégorie de produit
   */
  async getByCategory(tenantId: string, userId: string, filter: ReportFilterDto) {
    const allowedLocations = await this.resolveLocationFilter(tenantId, userId, filter.locationId);
    const dateFilter = this.buildDateFilter(filter);

    return this.db.run(tenantId, async (prisma) => {
      const saleLines = await prisma.saleLine.findMany({
        where: {
          tenantId,
          sale: {
            status: 'COMPLETED',
            ...(allowedLocations ? { locationId: { in: allowedLocations } } : {}),
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
        },
        select: {
          productId: true,
          quantity: true,
          lineTotal: true,
        },
      });

      const productIds = Array.from(new Set(saleLines.map((l: { productId: string }) => l.productId)));
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, categoryId: true },
      });
      const categoryIds = Array.from(
        new Set(
          products
            .map((p: { categoryId: string | null }) => p.categoryId)
            .filter((c: string | null): c is string => Boolean(c)),
        ),
      );

      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      });
      const categoryNameById = new Map<string, string>(
        categories.map((c: { id: string; name: string }) => [c.id, c.name]),
      );
      const productCategoryMap = new Map<string, string>();
      for (const p of products) {
        const catName = p.categoryId ? categoryNameById.get(p.categoryId) ?? 'Autre' : 'Sans catégorie';
        productCategoryMap.set(p.id, catName);
      }

      const catMap = new Map<string, { itemsSold: number; revenue: number }>();
      let totalCatRevenue = 0;

      for (const line of saleLines) {
        const catName = productCategoryMap.get(line.productId) ?? 'Sans catégorie';
        const rev = Number(line.lineTotal);
        const qty = Number(line.quantity);
        totalCatRevenue += rev;

        const existing = catMap.get(catName) || { itemsSold: 0, revenue: 0 };
        existing.itemsSold += qty;
        existing.revenue += rev;
        catMap.set(catName, existing);
      }

      return Array.from(catMap.entries())
        .map(([categoryName, stats]) => ({
          categoryName,
          itemsSold: Math.round(stats.itemsSold * 100) / 100,
          revenue: Math.round(stats.revenue * 100) / 100,
          percentage:
            totalCatRevenue > 0
              ? Math.round((stats.revenue / totalCatRevenue) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);
    });
  }

  /**
   * Export CSV des ventes avec protection contre l'injection de formules
   * Conforme aux exigences de sécurité OWASP / §5.11
   */
  async exportSalesCsv(tenantId: string, userId: string, filter: ReportFilterDto): Promise<string> {
    const allowedLocations = await this.resolveLocationFilter(tenantId, userId, filter.locationId);
    const dateFilter = this.buildDateFilter(filter);

    return this.db.run(tenantId, async (prisma) => {
      const sales = await prisma.sale.findMany({
        where: {
          tenantId,
          ...(allowedLocations ? { locationId: { in: allowedLocations } } : {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        include: {
          documents: { select: { number: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });

      const sanitize = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        // OWASP CSV Injection Defense : neutraliser =, +, -, @, tab, newline
        if (/^[=+\-@\t\r]/.test(str)) {
          return `"'${str.replace(/"/g, '""')}"`;
        }
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const header = [
        'ID Vente',
        'Numéro Reçu',
        'Date & Heure',
        'Emplacement',
        'Statut',
        'Devise',
        'Sous-total',
        'Taxes',
        'Remises',
        'Total Net',
        'Montant Encaissé',
        'Solde Restant',
      ].join(';');

      const rows = sales.map((s) => {
        const docNum = s.documents[0]?.number || '';
        return [
          sanitize(s.id),
          sanitize(docNum),
          sanitize(s.createdAt.toISOString()),
          sanitize(s.locationId),
          sanitize(s.status),
          sanitize(s.currency),
          sanitize(s.subtotal.toString()),
          sanitize(s.taxTotal.toString()),
          sanitize(s.discountTotal.toString()),
          sanitize(s.grandTotal.toString()),
          sanitize(s.amountPaid.toString()),
          sanitize(s.balanceDue.toString()),
        ].join(';');
      });

      // Préfixe BOM UTF-8 pour Excel
      return '\uFEFF' + [header, ...rows].join('\r\n');
    });
  }

  /**
   * Valorisation complète du stock (coût d'acquisition CUMP, prix public normal, prix promo et marges)
   */
  async getStockValuation(
    tenantId: string,
    userId: string,
    filter: StockValuationFilterDto,
  ) {
    const allowedLocations = await this.resolveLocationFilter(tenantId, userId, filter.locationId);

    return this.db.run(tenantId, async (prisma) => {
      // 1. Paramètres de valorisation et devise
      const [valuationSetting, currencySetting, promoSetting] = await Promise.all([
        prisma.tenantSetting.findFirst({ where: { tenantId, key: 'inventory.valuationMethod' } }),
        prisma.tenantSetting.findFirst({ where: { tenantId, key: 'commerce.defaultCurrency' } }),
        prisma.tenantSetting.findFirst({ where: { tenantId, key: 'pricing.activePromoDiscountPercent' } }),
      ]);

      const valuationMethod = (typeof valuationSetting?.value === 'string' && valuationSetting.value) ? valuationSetting.value : 'CUMP';
      const currency = filter.currency || (typeof currencySetting?.value === 'string' ? currencySetting.value : 'XOF');
      const activeTenantPromo = typeof promoSetting?.value === 'number' ? promoSetting.value : 0;
      const appliedPromoDiscountPercent = filter.promoDiscountPercent !== undefined ? filter.promoDiscountPercent : activeTenantPromo;
      const hasActivePromotion = appliedPromoDiscountPercent > 0;

      // 2. Emplacements autorisés et séparation Quarantaine
      const locations = await prisma.location.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(allowedLocations ? { id: { in: allowedLocations } } : {}),
        },
      });
      const locationMap = new Map(locations.map((l) => [l.id, l]));
      const commercialLocationIds = locations.filter((l) => l.type !== 'QUARANTINE').map((l) => l.id);
      const quarantineLocationIds = locations.filter((l) => l.type === 'QUARANTINE').map((l) => l.id);

      // 3. Produits cibles (physiques, stockés, actifs)
      const productWhere: Prisma.ProductWhereInput = {
        tenantId,
        deletedAt: null,
        isStocked: true,
        type: 'PHYSICAL',
        ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
        ...(filter.brand ? { brand: { contains: filter.brand, mode: 'insensitive' } } : {}),
      };

      const [products, categories] = await Promise.all([
        prisma.product.findMany({
          where: productWhere,
          select: {
            id: true,
            sku: true,
            name: true,
            brand: true,
            categoryId: true,
            unit: true,
            basePrice: true,
            costPrice: true,
          },
          orderBy: { name: 'asc' },
        }),
        prisma.category.findMany({
          where: { tenantId },
          select: { id: true, name: true },
        }),
      ]);

      const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
      const productIds = products.map((p) => p.id);

      // 4. Niveaux de stocks commerciaux et quarantaine
      const [commercialStockLevels, quarantineStockLevels, inTransitTransfers] = await Promise.all([
        prisma.stockLevel.findMany({
          where: {
            tenantId,
            productId: { in: productIds },
            ...(commercialLocationIds.length > 0 ? { locationId: { in: commercialLocationIds } } : {}),
          },
        }),
        prisma.stockLevel.findMany({
          where: {
            tenantId,
            productId: { in: productIds },
            locationId: { in: quarantineLocationIds },
          },
        }),
        prisma.stockTransferLine.findMany({
          where: {
            tenantId,
            productId: { in: productIds },
            transfer: { status: 'CONFIRMED' },
          },
          select: {
            productId: true,
            quantity: true,
          },
        }),
      ]);

      const inTransitByProduct = new Map<string, number>();
      for (const t of inTransitTransfers) {
        const cur = inTransitByProduct.get(t.productId) ?? 0;
        inTransitByProduct.set(t.productId, cur + Number(t.quantity));
      }

      const quarantineByProduct = new Map<string, number>();
      for (const q of quarantineStockLevels) {
        const cur = quarantineByProduct.get(q.productId) ?? 0;
        quarantineByProduct.set(q.productId, cur + Number(q.quantityOnHand));
      }

      const stockByProduct = new Map<string, { onHand: number; reserved: number }>();
      const locationStockMap = new Map<string, { vendable: number; normalSale: number; promoSale: number; cost: number }>();

      for (const sl of commercialStockLevels) {
        const onHand = Number(sl.quantityOnHand);
        const reserved = Number(sl.quantityReserved);
        const prev = stockByProduct.get(sl.productId) ?? { onHand: 0, reserved: 0 };
        stockByProduct.set(sl.productId, {
          onHand: prev.onHand + onHand,
          reserved: prev.reserved + reserved,
        });

        const curLoc = locationStockMap.get(sl.locationId) ?? { vendable: 0, normalSale: 0, promoSale: 0, cost: 0 };
        const vendable = Math.max(0, onHand - reserved);
        curLoc.vendable += vendable;
        locationStockMap.set(sl.locationId, curLoc);
      }

      // 5. Calculs par produit
      let totalPhysicalOnHand = 0;
      let totalReserved = 0;
      let totalVendableAvailable = 0;
      let totalInQuarantine = 0;
      let totalInTransit = 0;
      let outOfStockProductsCount = 0;

      let acquisitionCostTotal = 0;
      let knownCostQuantity = 0;
      let knownCostProductsCount = 0;
      let unknownCostQuantity = 0;
      let unknownCostProductsCount = 0;

      let normalSaleValueTotal = 0;
      let promoSaleValueTotal = 0;
      let quarantineCostTotal = 0;
      let quarantineKnownProductsCount = 0;

      let positiveMarginProductsCount = 0;
      let lowMarginProductsCount = 0;
      let zeroMarginProductsCount = 0;
      let lossMakingInPromoCount = 0;

      const lossMakingProducts: any[] = [];
      const detailedProducts: any[] = [];
      const categoryAggregation = new Map<string, {
        categoryId: string | null;
        categoryName: string;
        productsCount: number;
        vendableQuantity: number;
        acquisitionCostTotal: number;
        normalSaleValueTotal: number;
        promotionalSaleValueTotal: number;
      }>();

      for (const prod of products) {
        const stock = stockByProduct.get(prod.id) ?? { onHand: 0, reserved: 0 };
        const inTransit = inTransitByProduct.get(prod.id) ?? 0;
        const inQuarantine = quarantineByProduct.get(prod.id) ?? 0;

        const onHand = stock.onHand;
        const reserved = stock.reserved;
        const vendable = Math.max(0, onHand - reserved);

        totalPhysicalOnHand += onHand;
        totalReserved += reserved;
        totalVendableAvailable += vendable;
        totalInTransit += inTransit;
        totalInQuarantine += inQuarantine;

        if (vendable <= 0) {
          outOfStockProductsCount++;
        }

        const basePrice = Number(prod.basePrice);
        const costPrice = prod.costPrice !== null ? Number(prod.costPrice) : null;
        const hasKnownCost = costPrice !== null && costPrice >= 0;

        const promoPrice = hasActivePromotion
          ? Math.max(0, basePrice * (1 - appliedPromoDiscountPercent / 100))
          : basePrice;

        const normalTotalSale = Math.round(vendable * basePrice * 100) / 100;
        const promoTotalSale = Math.round(vendable * promoPrice * 100) / 100;
        normalSaleValueTotal += normalTotalSale;
        promoSaleValueTotal += promoTotalSale;

        let totalAcquisitionCost: number | null = null;
        let normalMargin: number | null = null;
        let normalMarginRate: number | null = null;
        let normalMarkupRate: number | null = null;
        let promoMargin: number | null = null;
        let promoMarginRate: number | null = null;
        let promoMarkupRate: number | null = null;
        let isLossMakingInPromo = false;

        if (hasKnownCost && costPrice !== null) {
          knownCostProductsCount++;
          knownCostQuantity += vendable;
          totalAcquisitionCost = Math.round(vendable * costPrice * 100) / 100;
          acquisitionCostTotal += totalAcquisitionCost;

          normalMargin = Math.round((normalTotalSale - totalAcquisitionCost) * 100) / 100;
          normalMarginRate = totalAcquisitionCost > 0
            ? Math.round((normalMargin / totalAcquisitionCost) * 10000) / 100
            : 0;
          normalMarkupRate = normalTotalSale > 0
            ? Math.round((normalMargin / normalTotalSale) * 10000) / 100
            : 0;

          promoMargin = Math.round((promoTotalSale - totalAcquisitionCost) * 100) / 100;
          promoMarginRate = totalAcquisitionCost > 0
            ? Math.round((promoMargin / totalAcquisitionCost) * 10000) / 100
            : 0;
          promoMarkupRate = promoTotalSale > 0
            ? Math.round((promoMargin / promoTotalSale) * 10000) / 100
            : 0;

          if (promoMargin < 0) {
            isLossMakingInPromo = true;
            lossMakingInPromoCount++;
            const unitLoss = Math.round((costPrice - promoPrice) * 100) / 100;
            const totalPotentialLoss = Math.round(vendable * unitLoss * 100) / 100;
            lossMakingProducts.push({
              id: prod.id,
              sku: prod.sku,
              name: prod.name,
              costPrice,
              basePrice,
              promoPrice: Math.round(promoPrice * 100) / 100,
              margin: promoMargin,
              lossPerUnit: unitLoss,
              vendableQuantity: vendable,
              totalPotentialLoss,
            });
          }

          if (normalMarginRate > 10) {
            positiveMarginProductsCount++;
          } else if (normalMarginRate > 0) {
            lowMarginProductsCount++;
          } else {
            zeroMarginProductsCount++;
          }

          if (inQuarantine > 0) {
            quarantineCostTotal += inQuarantine * costPrice;
            quarantineKnownProductsCount++;
          }
        } else {
          unknownCostProductsCount++;
          unknownCostQuantity += vendable;
        }

        const catId = prod.categoryId || 'NON_CATEGORISE';
        const catName = (prod.categoryId && categoryMap.get(prod.categoryId)) || 'Non catégorisé';
        const curCat = categoryAggregation.get(catId) ?? {
          categoryId: prod.categoryId,
          categoryName: catName,
          productsCount: 0,
          vendableQuantity: 0,
          acquisitionCostTotal: 0,
          normalSaleValueTotal: 0,
          promotionalSaleValueTotal: 0,
        };
        curCat.productsCount++;
        curCat.vendableQuantity += vendable;
        curCat.normalSaleValueTotal += normalTotalSale;
        curCat.promotionalSaleValueTotal += promoTotalSale;
        if (totalAcquisitionCost !== null) {
          curCat.acquisitionCostTotal += totalAcquisitionCost;
        }
        categoryAggregation.set(catId, curCat);

        detailedProducts.push({
          id: prod.id,
          sku: prod.sku,
          name: prod.name,
          categoryName: (prod.categoryId && categoryMap.get(prod.categoryId)) || null,
          brand: prod.brand,
          unit: prod.unit,
          quantityOnHand: onHand,
          quantityReserved: reserved,
          vendableQuantity: vendable,
          inQuarantineQuantity: inQuarantine,
          inTransitQuantity: inTransit,
          costPrice,
          hasKnownCost,
          basePrice,
          promoPrice: Math.round(promoPrice * 100) / 100,
          normalTotalSale,
          promoTotalSale,
          totalAcquisitionCost,
          normalMargin,
          normalMarginRate,
          normalMarkupRate,
          promoMargin,
          promoMarginRate,
          promoMarkupRate,
          isLossMakingInPromo,
        });
      }

      const potentialNormalMargin = Math.round((normalSaleValueTotal - acquisitionCostTotal) * 100) / 100;
      const potentialNormalMarginRatePercent = acquisitionCostTotal > 0
        ? Math.round((potentialNormalMargin / acquisitionCostTotal) * 10000) / 100
        : 0;
      const potentialNormalMarkupRatePercent = normalSaleValueTotal > 0
        ? Math.round((potentialNormalMargin / normalSaleValueTotal) * 10000) / 100
        : 0;

      const potentialPromoMargin = Math.round((promoSaleValueTotal - acquisitionCostTotal) * 100) / 100;
      const potentialPromoMarginRatePercent = acquisitionCostTotal > 0
        ? Math.round((potentialPromoMargin / acquisitionCostTotal) * 10000) / 100
        : 0;
      const potentialPromoMarkupRatePercent = promoSaleValueTotal > 0
        ? Math.round((potentialPromoMargin / promoSaleValueTotal) * 10000) / 100
        : 0;

      const breakdownByCategory = Array.from(categoryAggregation.values()).map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        productsCount: c.productsCount,
        vendableQuantity: Math.round(c.vendableQuantity * 100) / 100,
        acquisitionCostTotal: Math.round(c.acquisitionCostTotal * 100) / 100,
        normalSaleValueTotal: Math.round(c.normalSaleValueTotal * 100) / 100,
        promotionalSaleValueTotal: Math.round(c.promotionalSaleValueTotal * 100) / 100,
        normalMargin: Math.round((c.normalSaleValueTotal - c.acquisitionCostTotal) * 100) / 100,
        promoMargin: Math.round((c.promotionalSaleValueTotal - c.acquisitionCostTotal) * 100) / 100,
      }));

      const breakdownByLocation = locations.map((loc) => {
        const data = locationStockMap.get(loc.id) ?? { vendable: 0, normalSale: 0, promoSale: 0, cost: 0 };
        return {
          locationId: loc.id,
          locationName: loc.name,
          locationType: loc.type,
          vendableQuantity: Math.round(data.vendable * 100) / 100,
          acquisitionCostTotal: Math.round(data.cost * 100) / 100,
          normalSaleValueTotal: Math.round(data.normalSale * 100) / 100,
          promotionalSaleValueTotal: Math.round(data.promoSale * 100) / 100,
          inQuarantineQuantity: loc.type === 'QUARANTINE' ? data.vendable : 0,
        };
      });

      return {
        asOf: new Date().toISOString(),
        currency,
        scope: {
          locationId: filter.locationId || null,
          locationName: filter.locationId ? (locationMap.get(filter.locationId)?.name || 'Emplacement') : 'Toute l\'entreprise',
          categoryId: filter.categoryId || null,
          brand: filter.brand || null,
        },
        valuationMethod,
        quantities: {
          totalPhysicalOnHand: Math.round(totalPhysicalOnHand * 100) / 100,
          totalReserved: Math.round(totalReserved * 100) / 100,
          totalVendableAvailable: Math.round(totalVendableAvailable * 100) / 100,
          totalInQuarantine: Math.round(totalInQuarantine * 100) / 100,
          totalInTransit: Math.round(totalInTransit * 100) / 100,
          outOfStockProductsCount,
          totalTrackedProductsCount: products.length,
        },
        valuation: {
          acquisitionCostTotal: Math.round(acquisitionCostTotal * 100) / 100,
          knownCostQuantity: Math.round(knownCostQuantity * 100) / 100,
          knownCostProductsCount,
          unknownCostQuantity: Math.round(unknownCostQuantity * 100) / 100,
          unknownCostProductsCount,
          isValuationComplete: unknownCostProductsCount === 0,
          normalSaleValueTotal: Math.round(normalSaleValueTotal * 100) / 100,
          promoSaleValueTotal: Math.round(promoSaleValueTotal * 100) / 100,
          hasActivePromotion,
          appliedPromoDiscountPercent,
          potentialNormalMargin,
          potentialNormalMarginRatePercent,
          potentialNormalMarkupRatePercent,
          potentialPromoMargin,
          potentialPromoMarginRatePercent,
          potentialPromoMarkupRatePercent,
          quarantineCostTotal: Math.round(quarantineCostTotal * 100) / 100,
          quarantineKnownProductsCount,
        },
        profitabilityAnalysis: {
          positiveMarginProductsCount,
          lowMarginProductsCount,
          zeroMarginProductsCount,
          lossMakingInPromoCount,
          lossMakingProducts,
        },
        breakdownByCategory,
        breakdownByLocation,
        products: detailedProducts,
      };
    });
  }

  /**
   * Export CSV détaillé de la valorisation du stock
   */
  async exportStockValuationCsv(
    tenantId: string,
    userId: string,
    filter: StockValuationFilterDto,
  ): Promise<string> {
    const report = await this.getStockValuation(tenantId, userId, filter);

    const sanitize = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (/^[=+\-@]/.test(str)) str = "'" + str;
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const header = [
      'SKU',
      'Article',
      'Catégorie',
      'Marque',
      'Unité',
      'Stock Physique',
      'Réservé',
      'Vendable Disponible',
      'En Quarantaine SAV',
      'En Transit',
      'Coût Achat (CUMP)',
      'Prix Vente Normal',
      'Prix Vente Promo',
      'Total Valeur Achat',
      'Total Vente Normale',
      'Total Vente Promo',
      'Marge Normale',
      'Taux Marge Normale (%)',
      'Taux Marque Normale (%)',
      'Marge Promo',
      'Taux Marge Promo (%)',
      'Vendu à Perte en Promo',
    ].join(';');

    const rows = report.products.map((p: any) =>
      [
        sanitize(p.sku),
        sanitize(p.name),
        sanitize(p.categoryName),
        sanitize(p.brand),
        sanitize(p.unit),
        sanitize(p.quantityOnHand),
        sanitize(p.quantityReserved),
        sanitize(p.vendableQuantity),
        sanitize(p.inQuarantineQuantity),
        sanitize(p.inTransitQuantity),
        sanitize(p.costPrice !== null ? p.costPrice : 'INCONNU'),
        sanitize(p.basePrice),
        sanitize(p.promoPrice),
        sanitize(p.totalAcquisitionCost !== null ? p.totalAcquisitionCost : 'NON_VALORISÉ'),
        sanitize(p.normalTotalSale),
        sanitize(p.promoTotalSale),
        sanitize(p.normalMargin !== null ? p.normalMargin : ''),
        sanitize(p.normalMarginRate !== null ? `${p.normalMarginRate}%` : ''),
        sanitize(p.normalMarkupRate !== null ? `${p.normalMarkupRate}%` : ''),
        sanitize(p.promoMargin !== null ? p.promoMargin : ''),
        sanitize(p.promoMarginRate !== null ? `${p.promoMarginRate}%` : ''),
        sanitize(p.isLossMakingInPromo ? 'OUI' : 'NON'),
      ].join(';'),
    );

    return '\uFEFF' + [header, ...rows].join('\r\n');
  }
}

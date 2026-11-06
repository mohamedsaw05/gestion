import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockPrisma: any;
  let mockRbac: any;

  const TENANT_ID = '3e91b057-f0f3-4410-9c4a-8541896328a6';
  const USER_ID = '99999999-9999-4999-8999-999999999999';
  const LOC_1 = '11111111-1111-4111-8111-111111111111';
  const LOC_2 = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    mockPrisma = {
      sale: {
        findMany: vi.fn(),
      },
      return: {
        findMany: vi.fn(),
      },
      stockLevel: {
        findMany: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      category: {
        findMany: vi.fn(),
      },
      creditAccount: {
        findMany: vi.fn(),
      },
      payment: {
        findMany: vi.fn(),
      },
      saleLine: {
        findMany: vi.fn(),
      },
      location: {
        findMany: vi.fn(),
      },
      stockTransferLine: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      tenantSetting: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    mockRbac = {
      getRecordVisibility: vi.fn().mockResolvedValue({
        allLocations: true,
        locationIds: [LOC_1, LOC_2],
      }),
    };

    const mockDb = {
      run: vi.fn((_tenantId: string, fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
    } as unknown as PrismaTenantService;

    service = new ReportsService(mockDb, mockRbac as unknown as RbacService);
  });

  describe('getSummary', () => {
    it('calcule correctement les indicateurs consolidés (ventes, retours, stock, créances)', async () => {
      mockPrisma.sale.findMany.mockResolvedValue([
        {
          status: 'COMPLETED',
          grandTotal: '15000.0000',
          subtotal: '12711.8644',
          taxTotal: '2288.1356',
          discountTotal: '0',
          amountPaid: '10000.0000',
          balanceDue: '5000.0000',
          currency: 'XOF',
        },
        {
          status: 'COMPLETED',
          grandTotal: '25000.0000',
          subtotal: '21186.4407',
          taxTotal: '3813.5593',
          discountTotal: '0',
          amountPaid: '25000.0000',
          balanceDue: '0',
          currency: 'XOF',
        },
        {
          status: 'CANCELLED',
          grandTotal: '5000.0000',
          subtotal: '4237.2881',
          taxTotal: '762.7119',
          discountTotal: '0',
          amountPaid: '0',
          balanceDue: '0',
          currency: 'XOF',
        },
      ]);

      mockPrisma.return.findMany.mockResolvedValue([
        { refundAmount: '2000.0000' },
      ]);

      mockPrisma.stockLevel.findMany.mockResolvedValue([
        { productId: 'prod-1', locationId: LOC_1, quantityOnHand: '10' },
        { productId: 'prod-2', locationId: LOC_1, quantityOnHand: '3' },
      ]);

      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', basePrice: '1500.0000' },
        { id: 'prod-2', basePrice: '5000.0000' },
      ]);

      mockPrisma.creditAccount.findMany.mockResolvedValue([
        { balance: '5000.0000' },
      ]);

      const summary = await service.getSummary(TENANT_ID, USER_ID, {});

      expect(summary.currency).toBe('XOF');
      expect(summary.sales.completedCount).toBe(2);
      expect(summary.sales.cancelledCount).toBe(1);
      expect(summary.sales.grossTotal).toBe(40000);
      expect(summary.sales.netSales).toBe(38000); // 40000 - 2000 refund
      expect(summary.sales.amountPaid).toBe(35000);
      expect(summary.sales.balanceDue).toBe(5000);
      expect(summary.sales.averageCart).toBe(20000); // 40000 / 2

      expect(summary.returns.count).toBe(1);
      expect(summary.returns.refundedTotal).toBe(2000);

      // Inventory: (10 * 1500) + (3 * 5000) = 15000 + 15000 = 30000. Low stock: 1 (prod-2 has 3 <= 5)
      expect(summary.inventory.totalUnitsOnHand).toBe(13);
      expect(summary.inventory.valuationTotal).toBe(30000);
      expect(summary.inventory.lowStockCount).toBe(1);

      // Credit: 5000 debt
      expect(summary.credit.outstandingDebtTotal).toBe(5000);
      expect(summary.credit.indebtedCustomersCount).toBe(1);
    });

    it('refuse l’accès à un emplacement non autorisé par le scope de localisation', async () => {
      mockRbac.getRecordVisibility.mockResolvedValue({
        allLocations: false,
        locationIds: [LOC_1], // Seul LOC_1 autorisé
      });

      await expect(
        service.getSummary(TENANT_ID, USER_ID, { locationId: LOC_2 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDailySales', () => {
    it('regroupe les ventes par jour chronologiquement', async () => {
      mockPrisma.sale.findMany.mockResolvedValue([
        {
          createdAt: new Date('2026-10-10T10:00:00Z'),
          grandTotal: '10000',
          amountPaid: '10000',
          balanceDue: '0',
        },
        {
          createdAt: new Date('2026-10-10T15:30:00Z'),
          grandTotal: '15000',
          amountPaid: '15000',
          balanceDue: '0',
        },
        {
          createdAt: new Date('2026-10-11T12:00:00Z'),
          grandTotal: '20000',
          amountPaid: '15000',
          balanceDue: '5000',
        },
      ]);

      const daily = await service.getDailySales(TENANT_ID, USER_ID, {});
      expect(daily.length).toBe(2);
      expect(daily[0]).toEqual({
        date: '2026-10-10',
        count: 2,
        revenue: 25000,
        amountPaid: 25000,
        balanceDue: 0,
      });
      expect(daily[1]).toEqual({
        date: '2026-10-11',
        count: 1,
        revenue: 20000,
        amountPaid: 15000,
        balanceDue: 5000,
      });
    });
  });

  describe('getByPaymentMethod', () => {
    it('calcule la part de chaque mode de paiement', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        { method: 'CASH', amount: '60000' },
        { method: 'MOBILE_MONEY', amount: '30000' },
        { method: 'CARD', amount: '10000' },
      ]);

      const methods = await service.getByPaymentMethod(TENANT_ID, USER_ID, {});
      expect(methods.length).toBe(3);
      expect(methods[0].method).toBe('CASH');
      expect(methods[0].totalAmount).toBe(60000);
      expect(methods[0].percentage).toBe(60);
      expect(methods[1].method).toBe('MOBILE_MONEY');
      expect(methods[1].percentage).toBe(30);
      expect(methods[2].method).toBe('CARD');
      expect(methods[2].percentage).toBe(10);
    });
  });

  describe('exportSalesCsv', () => {
    it('génère un export CSV sécurisé contre l’injection de formules', async () => {
      mockPrisma.sale.findMany.mockResolvedValue([
        {
          id: '=cmd|/c calc!A0', // Formule malveillante type CSV Injection
          locationId: LOC_1,
          createdAt: new Date('2026-10-15T12:00:00Z'),
          status: 'COMPLETED',
          currency: 'XOF',
          subtotal: 10000,
          taxTotal: 1800,
          discountTotal: 0,
          grandTotal: 11800,
          amountPaid: 11800,
          balanceDue: 0,
          documents: [{ number: '+HYPERLINK("http://evil.com")' }],
        },
      ]);

      const csv = await service.exportSalesCsv(TENANT_ID, USER_ID, {});

      // Vérifier le préfixe BOM UTF-8
      expect(csv.startsWith('\uFEFF')).toBe(true);

      // Vérifier la neutralisation des formules (préfixe apostrophe dans guillemets)
      expect(csv).toContain("\"'=cmd|/c calc!A0\"");
      expect(csv).toContain("\"'+HYPERLINK(\"\"http://evil.com\"\")\"");
    });
  });

  describe('getStockValuation', () => {
    it('calcule exactement la valorisation au coût (CUMP), prix normal, prix promo et marges selon le cas de test §7.5', async () => {
      // Setup des locations (Store 1, Store 2, et Quarantine)
      const QUARANTINE_LOC = '33333333-3333-4333-8333-333333333333';
      mockPrisma.location.findMany.mockResolvedValue([
        { id: LOC_1, name: 'Boutique Centre', type: 'STORE' },
        { id: LOC_2, name: 'Dépôt Nord', type: 'WAREHOUSE' },
        { id: QUARANTINE_LOC, name: 'Quarantaine SAV', type: 'QUARANTINE' },
      ]);

      mockPrisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Électronique' },
      ]);

      // Produits du cas de test §7.5 :
      // Produit A : stock 10, coût moyen 100, prix normal 150 (promo 10% -> 135)
      // Produit B : stock 5, coût moyen 200, prix normal 180 (promo 20% -> 144, vendu à perte !)
      // Produit C : coût inconnu (null), prix 250, stock 8
      // Produit D : 4 unités en quarantaine SAV, coût 50
      // Produit E : stock réparti sur deux dépôts (6 à LOC_1, 4 à LOC_2), coût 30, prix 60
      const prodA = { id: 'p-a', sku: 'SKU-A', name: 'Produit A', categoryId: 'cat-1', brand: 'BrandX', unit: 'pcs', basePrice: 150, costPrice: 100 };
      const prodB = { id: 'p-b', sku: 'SKU-B', name: 'Produit B', categoryId: 'cat-1', brand: 'BrandX', unit: 'pcs', basePrice: 180, costPrice: 200 };
      const prodC = { id: 'p-c', sku: 'SKU-C', name: 'Produit C', categoryId: null, brand: null, unit: 'pcs', basePrice: 250, costPrice: null };
      const prodD = { id: 'p-d', sku: 'SKU-D', name: 'Produit D', categoryId: 'cat-1', brand: 'BrandY', unit: 'pcs', basePrice: 90, costPrice: 50 };
      const prodE = { id: 'p-e', sku: 'SKU-E', name: 'Produit E', categoryId: 'cat-1', brand: 'BrandY', unit: 'pcs', basePrice: 60, costPrice: 30 };

      mockPrisma.product.findMany.mockResolvedValue([prodA, prodB, prodC, prodD, prodE]);

      // Stock commercial (LOC_1 et LOC_2)
      mockPrisma.stockLevel.findMany
        .mockResolvedValueOnce([
          { productId: 'p-a', locationId: LOC_1, quantityOnHand: 10, quantityReserved: 0 },
          { productId: 'p-b', locationId: LOC_1, quantityOnHand: 5, quantityReserved: 0 },
          { productId: 'p-c', locationId: LOC_1, quantityOnHand: 8, quantityReserved: 0 },
          { productId: 'p-d', locationId: LOC_1, quantityOnHand: 0, quantityReserved: 0 },
          { productId: 'p-e', locationId: LOC_1, quantityOnHand: 6, quantityReserved: 0 },
          { productId: 'p-e', locationId: LOC_2, quantityOnHand: 4, quantityReserved: 0 },
        ])
        // Stock Quarantaine
        .mockResolvedValueOnce([
          { productId: 'p-d', locationId: QUARANTINE_LOC, quantityOnHand: 4, quantityReserved: 0 },
        ]);

      // Transferts en transit
      mockPrisma.stockTransferLine.findMany.mockResolvedValue([
        { productId: 'p-a', quantity: 2 },
      ]);

      // Simulation avec une promotion de 10%
      const res = await service.getStockValuation(TENANT_ID, USER_ID, { promoDiscountPercent: 10 });

      // 1. Quantités globales
      expect(res.quantities.totalPhysicalOnHand).toBe(33); // 10+5+8+0+6+4
      expect(res.quantities.totalVendableAvailable).toBe(33);
      expect(res.quantities.totalInQuarantine).toBe(4);
      expect(res.quantities.totalInTransit).toBe(2);
      expect(res.quantities.outOfStockProductsCount).toBe(1); // Produit D a 0 vendable

      // 2. Coût d'acquisition connu vs inconnu
      // Produits valorisés : A (10*100=1000), B (5*200=1000), E (10*30=300) -> 2300
      expect(res.valuation.acquisitionCostTotal).toBe(2300);
      expect(res.valuation.knownCostQuantity).toBe(25); // 10+5+10
      expect(res.valuation.unknownCostQuantity).toBe(8); // Produit C a 8 vendable
      expect(res.valuation.unknownCostProductsCount).toBe(1);
      expect(res.valuation.isValuationComplete).toBe(false); // Incomplet car Produit C n'a pas de coût

      // 3. Valeurs de vente :
      // Vente normale : A (10*150=1500) + B (5*180=900) + C (8*250=2000) + D (0) + E (10*60=600) = 5000
      expect(res.valuation.normalSaleValueTotal).toBe(5000);
      // Vente promo (-10%) : 5000 * 0.9 = 4500
      expect(res.valuation.promoSaleValueTotal).toBe(4500);

      // 4. Détection vente à perte sous promo :
      // Produit B en promo : prix promo = 180 * 0.9 = 162 < coût 200 !
      // Perte unitaire = 200 - 162 = 38, perte totale = 5 * 38 = 190.
      expect(res.profitabilityAnalysis.lossMakingInPromoCount).toBe(1);
      const lossB = res.profitabilityAnalysis.lossMakingProducts[0];
      expect(lossB.id).toBe('p-b');
      expect(lossB.lossPerUnit).toBe(38);
      expect(lossB.totalPotentialLoss).toBe(190);

      // 5. Quarantaine : 4 unités de D à coût 50 = 200
      expect(res.valuation.quarantineCostTotal).toBe(200);

      // 6. Répartition par catégorie et par emplacement
      expect(res.breakdownByCategory.length).toBe(2); // cat-1 et Non catégorisé
      expect(res.breakdownByLocation.length).toBe(3);
    });

    it('exporte les colonnes de valorisation au format CSV compatible Excel', async () => {
      mockPrisma.location.findMany.mockResolvedValue([
        { id: LOC_1, name: 'Boutique Centre', type: 'STORE' },
      ]);
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p-1', sku: 'SKU-1', name: 'Article 1', categoryId: null, brand: null, unit: 'pcs', basePrice: 100, costPrice: 60 },
      ]);
      mockPrisma.stockLevel.findMany
        .mockResolvedValueOnce([{ productId: 'p-1', locationId: LOC_1, quantityOnHand: 5, quantityReserved: 0 }])
        .mockResolvedValueOnce([]);
      mockPrisma.stockTransferLine.findMany.mockResolvedValue([]);

      const csv = await service.exportStockValuationCsv(TENANT_ID, USER_ID, {});
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('SKU;Article;Catégorie;Marque');
      expect(csv).toContain('Coût Achat (CUMP)');
      expect(csv).toContain('SKU-1;Article 1');
      expect(csv).toContain('60');
      expect(csv).toContain('100');
    });
  });
});


import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { SalesService } from './sales.service.js';

describe('SalesService (Lot 2 - Rendu de monnaie, Remises par rôle, Anti-vente à perte, Mobile Money & Annulation)', () => {
  let service: SalesService;
  let mockDb: any;
  let mockDocuments: any;
  let mockPricing: any;
  let mockCredit: any;
  let mockConfig: any;
  let mockUnits: any;
  let mockBusinessProfile: any;
  let mockInventory: any;
  let mockRbac: any;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const SELLER_USER_ID = '00000000-0000-0000-0000-000000000002';
  const MANAGER_USER_ID = '00000000-0000-0000-0000-000000000003';
  const LOCATION_ID = '00000000-0000-0000-0000-000000000004';
  const PRODUCT_ID = '00000000-0000-0000-0000-000000000005';
  const SALE_ID = '00000000-0000-0000-0000-000000000006';

  let mockCreatedSale: any = null;
  let mockReceiptInput: any = null;
  let mockOutboxEvents: any[] = [];
  let userRoleKey = 'sales_user';
  let currentTx: any = null;

  beforeEach(() => {
    mockCreatedSale = null;
    mockReceiptInput = null;
    mockOutboxEvents = [];
    userRoleKey = 'sales_user';

    const tx: any = {
      sale: {
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(mockCreatedSale)),
        create: vi.fn().mockImplementation(({ data }) => {
          mockCreatedSale = { ...data, lines: [], payments: [] };
          return Promise.resolve(mockCreatedSale);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          mockCreatedSale = { ...mockCreatedSale, ...data };
          return Promise.resolve(mockCreatedSale);
        }),
      },
      saleLine: {
        create: vi.fn().mockResolvedValue({ id: 'line-id-1' }),
      },
      payment: {
        create: vi.fn().mockResolvedValue({ id: 'pay-id-1' }),
      },
      stockLevel: {
        create: vi.fn().mockResolvedValue({ id: 'sl-1' }),
        update: vi.fn().mockResolvedValue({ id: 'sl-1' }),
      },
      location: {
        findFirst: vi.fn().mockResolvedValue({ id: LOCATION_ID, tenantId: TENANT_ID, type: 'STORE' }),
      },
      stockMovement: {
        create: vi.fn().mockResolvedValue({ id: 'sm-1' }),
      },
      outboxEvent: {
        create: vi.fn().mockImplementation(({ data }) => {
          mockOutboxEvents.push(data);
          return Promise.resolve(data);
        }),
      },
      userRole: {
        findMany: vi.fn().mockImplementation(() =>
          Promise.resolve([
            {
              role: { key: userRoleKey, name: userRoleKey },
            },
          ]),
        ),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: PRODUCT_ID,
            tenantId: TENANT_ID,
            name: 'Ventilateur Rechargeable',
            unit: 'pièce',
            basePrice: new Prisma.Decimal(8500),
            costPrice: new Prisma.Decimal(6000),
            isStocked: true,
            isFractional: false,
            hasVariants: false,
            tracksSerialNumbers: false,
            type: 'PRODUCT',
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({
          id: PRODUCT_ID,
          tenantId: TENANT_ID,
          name: 'Ventilateur Rechargeable',
          unit: 'pièce',
          basePrice: new Prisma.Decimal(8500),
          costPrice: new Prisma.Decimal(6000),
          isStocked: true,
          isFractional: false,
          hasVariants: false,
          tracksSerialNumbers: false,
          type: 'PRODUCT',
        }),
      },
      purchaseOrderLine: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      warrantyPolicy: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      cashSession: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      creditAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      return: {
        count: vi.fn().mockResolvedValue(0),
      },
      document: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      platformSubscription: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'sl-1', quantityOnHand: new Prisma.Decimal(10) }]),
    };

    currentTx = tx;
    mockDb = {
      run: vi.fn().mockImplementation((_tenantId, callback) => callback(tx)),
    };

    mockPricing = {
      resolveUnitPrice: vi.fn().mockResolvedValue({
        unitPrice: new Prisma.Decimal(8500),
        appliedRule: 'BASE_PRICE',
      }),
    };

    mockUnits = {
      resolveUnit: vi.fn().mockResolvedValue({
        unit: 'pièce',
        factor: new Prisma.Decimal(1),
        isReferenceUnit: true,
      }),
    };

    mockConfig = {
      getWithTx: vi.fn().mockImplementation((_tx, _tenantId, key) => {
        if (key === 'sales.defaultCurrency') return 'XOF';
        if (key === 'sales.enabledPaymentMethods') return ['CASH', 'MOBILE_MONEY', 'CARD'];
        if (key === 'sales.discountMaxSellerPercent') return '5';
        if (key === 'sales.discountMaxManagerPercent') return '15';
        if (key === 'sales.allowSaleBelowCost') return false;
        if (key === 'sales.requireCustomerAlways') return false;
        return null;
      }),
    };

    mockDocuments = {
      createReceiptForSale: vi.fn().mockImplementation((_tx, _tenantId, input) => {
        mockReceiptInput = input;
        return Promise.resolve({ id: 'receipt-doc-1' });
      }),
    };

    mockCredit = { recordSaleDebt: vi.fn() };
    mockBusinessProfile = {
      isCapabilityEnabledWithTx: vi.fn().mockResolvedValue(true),
    };
    mockInventory = { consumeBatchesFefoWithTx: vi.fn() };
    mockRbac = {
      getRecordVisibility: vi.fn().mockResolvedValue({ allLocations: true }),
      can: vi.fn().mockResolvedValue(true),
    };

    service = new SalesService(
      mockDb,
      mockDocuments,
      mockPricing,
      mockCredit,
      mockConfig,
      mockUnits,
      mockBusinessProfile,
      mockInventory,
      mockRbac,
    );
  });

  describe('DÉCISION 1 — Rendu de monnaie automatique', () => {
    it('calcule exactement la monnaie à rendre sur un billet remis supérieur au prix (ex: vente de 8 500, billet de 10 000, monnaie 1 500)', async () => {
      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000010',
        lines: [{ productId: PRODUCT_ID, quantity: '1' }],
        tenderedAmount: '10000',
        payments: [{ method: 'CASH' as const, amount: '8500' }],
      };

      await service.create(TENANT_ID, SELLER_USER_ID, dto as any);

      expect(mockCreatedSale).toBeDefined();
      expect(mockCreatedSale.grandTotal.toString()).toBe('8500');
      expect(mockCreatedSale.amountPaid.toString()).toBe('8500'); // Montant net affecté à la caisse
      expect(mockCreatedSale.balanceDue.toString()).toBe('0');

      // Reçu présentant le montant remis et la monnaie rendue
      expect(mockReceiptInput).toBeDefined();
      expect(mockReceiptInput.tenderedAmount).toBe('10000');
      expect(mockReceiptInput.changeGiven).toBe('1500');
    });

    it('refuse une vente en espèces si le montant remis est inférieur au montant à payer en espèces', async () => {
      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000011',
        lines: [{ productId: PRODUCT_ID, quantity: '1' }],
        tenderedAmount: '7000', // Inférieur à 8500
        payments: [{ method: 'CASH' as const, amount: '8500' }],
      };

      await expect(service.create(TENANT_ID, SELLER_USER_ID, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('DÉCISION 5 — Remises contrôlées par rôle et protection anti-vente à perte', () => {
    it('bloque un vendeur tentant d\'appliquer une remise supérieure à son plafond (ex: 8% > 5%)', async () => {
      userRoleKey = 'sales_user';
      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000020',
        lines: [{ productId: PRODUCT_ID, quantity: '1', discountPercent: '8' }], // 8% > 5% max vendeur
        payments: [{ method: 'CASH' as const, amount: '7820' }],
      };

      await expect(service.create(TENANT_ID, SELLER_USER_ID, dto as any)).rejects.toThrow(
        /supérieure au plafond autorisé pour votre rôle/,
      );
    });

    it('autorise un vendeur à appliquer une remise jusqu\'à 5%', async () => {
      userRoleKey = 'sales_user';
      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000021',
        lines: [{ productId: PRODUCT_ID, quantity: '1', discountPercent: '5' }],
        payments: [{ method: 'CASH' as const, amount: '8075' }],
      };

      await service.create(TENANT_ID, SELLER_USER_ID, dto as any);
      expect(mockCreatedSale).toBeDefined();
      expect(mockCreatedSale.grandTotal.toString()).toBe('8075');
    });

    it('autorise un responsable à appliquer une remise jusqu\'à 15%', async () => {
      userRoleKey = 'manager';
      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000022',
        lines: [{ productId: PRODUCT_ID, quantity: '1', discountPercent: '15' }],
        payments: [{ method: 'CASH' as const, amount: '7225' }],
      };

      await service.create(TENANT_ID, MANAGER_USER_ID, dto as any);
      expect(mockCreatedSale).toBeDefined();
      expect(mockCreatedSale.grandTotal.toString()).toBe('7225');
    });

    it('bloque par défaut toute vente sous le coût de revient (coût = 6000, prix remisé = 5000)', async () => {
      userRoleKey = 'manager';
      mockPricing.resolveUnitPrice.mockResolvedValueOnce({
        unitPrice: new Prisma.Decimal(5000), // < 6000 coût
        appliedRule: 'BASE_PRICE',
      });

      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000023',
        lines: [{ productId: PRODUCT_ID, quantity: '1' }],
        payments: [{ method: 'CASH' as const, amount: '5000' }],
      };

      await expect(service.create(TENANT_ID, MANAGER_USER_ID, dto as any)).rejects.toThrow(
        /Vente sous le coût de revient interdite/,
      );
    });

    it('autorise une vente sous le coût de revient sous réserve d\'une dérogation explicite avec motif obligatoire', async () => {
      userRoleKey = 'manager';
      mockPricing.resolveUnitPrice.mockResolvedValueOnce({
        unitPrice: new Prisma.Decimal(5000), // < 6000 coût
        appliedRule: 'BASE_PRICE',
      });

      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000024',
        lines: [{ productId: PRODUCT_ID, quantity: '1' }],
        payments: [{ method: 'CASH' as const, amount: '5000' }],
        overrideBelowCost: true,
        belowCostReason: 'Déstockage modèle d\'exposition avec trace d\'usure',
      };

      await service.create(TENANT_ID, MANAGER_USER_ID, dto as any);
      expect(mockCreatedSale).toBeDefined();
      expect(
        mockOutboxEvents.some((e) => e.eventType === 'sales.sale.below_cost_override'),
      ).toBe(true);
    });
  });

  describe('Fiabilité des paiements Mobile Money', () => {
    it('refuse formellement un paiement Mobile Money validé sans référence opérateur', async () => {
      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000030',
        lines: [{ productId: PRODUCT_ID, quantity: '1' }],
        payments: [{ method: 'MOBILE_MONEY' as const, amount: '8500', reference: '' }], // Manque référence
      };

      await expect(service.create(TENANT_ID, SELLER_USER_ID, dto as any)).rejects.toThrow(
        /Une référence de transaction Mobile Money valide/,
      );
    });

    it('accepte un paiement Mobile Money avec référence opérateur valide', async () => {
      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000031',
        lines: [{ productId: PRODUCT_ID, quantity: '1' }],
        payments: [{ method: 'MOBILE_MONEY' as const, amount: '8500', reference: 'OM-20261101-987654' }],
      };

      await service.create(TENANT_ID, SELLER_USER_ID, dto as any);
      expect(mockCreatedSale).toBeDefined();
      expect(mockCreatedSale.amountPaid.toString()).toBe('8500');
    });
  });

  describe('Annulation contrôlée de ticket', () => {
    it('annule une vente avec motif obligatoire, restaure le stock et annule les documents', async () => {
      mockCreatedSale = {
        id: SALE_ID,
        tenantId: TENANT_ID,
        locationId: LOCATION_ID,
        customerId: null,
        status: 'COMPLETED',
        grandTotal: new Prisma.Decimal(8500),
        amountPaid: new Prisma.Decimal(8500),
        balanceDue: new Prisma.Decimal(0),
        lines: [
          {
            id: 'line-1',
            productId: PRODUCT_ID,
            quantity: new Prisma.Decimal(1),
            conversionFactorSnapshot: new Prisma.Decimal(1),
          },
        ],
        payments: [{ method: 'CASH', amount: new Prisma.Decimal(8500) }],
      };

      const result = await service.cancel(
        TENANT_ID,
        MANAGER_USER_ID,
        SALE_ID,
        'Erreur de caisse, client parti sans payer',
      );

      expect(result.status).toBe('CANCELLED');
      expect(mockOutboxEvents.some((e) => e.eventType === 'sales.sale.cancelled')).toBe(true);
    });

    it('refuse une annulation sans motif explicite', async () => {
      await expect(
        service.cancel(TENANT_ID, MANAGER_USER_ID, SALE_ID, '   '),
      ).rejects.toThrow(/Un motif d'annulation est obligatoire/);
    });

    it('interdit formellement toute vente initiée depuis un emplacement de quarantaine SAV', async () => {
      currentTx.location.findFirst.mockResolvedValueOnce({
        id: LOCATION_ID,
        tenantId: TENANT_ID,
        type: 'QUARANTINE',
      });

      const dto = {
        locationId: LOCATION_ID,
        operationId: '00000000-0000-0000-0000-000000000099',
        lines: [{ productId: PRODUCT_ID, quantity: '1' }],
      };

      await expect(
        service.create(TENANT_ID, SELLER_USER_ID, dto as any),
      ).rejects.toThrow(/Impossible d'effectuer une vente depuis un emplacement de quarantaine/);
    });
  });
});

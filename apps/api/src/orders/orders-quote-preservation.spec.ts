import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { OrdersService } from './orders.service.js';

describe('OrdersService (S1 Quote Price Preservation & Expiration)', () => {
  let service: OrdersService;
  let mockDb: any;
  let mockPricing: any;
  let mockUnits: any;
  let mockConfig: any;
  let mockSales: any;
  let mockInventory: any;
  let mockRbac: any;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const USER_ID = '00000000-0000-0000-0000-000000000002';
  const ORDER_ID = '00000000-0000-0000-0000-000000000003';
  const LOCATION_ID = '00000000-0000-0000-0000-000000000004';
  const CUSTOMER_ID = '00000000-0000-0000-0000-000000000005';
  const PRODUCT_ID = '00000000-0000-0000-0000-000000000006';

  beforeEach(() => {
    mockPricing = { resolveUnitPrice: vi.fn() };
    mockUnits = { resolveUnit: vi.fn() };
    mockConfig = {
      getWithTx: vi.fn().mockImplementation((_tx, _tenantId, key) => {
        if (key === 'documents.quoteValidityDays') return '15';
        return null;
      }),
    };
    mockSales = {
      create: vi.fn().mockResolvedValue({ id: 'sale-from-order-1' }),
    };
    mockInventory = {
      releaseStockReservationWithTx: vi.fn().mockResolvedValue(undefined),
    };
    mockRbac = {
      getRecordVisibility: vi.fn().mockResolvedValue({ allLocations: true }),
    };
  });

  it('Règle S1 : la conversion d\'une commande en vente préserve fidèlement le prix négocié initial du devis', async () => {
    const mockOrder = {
      id: ORDER_ID,
      tenantId: TENANT_ID,
      locationId: LOCATION_ID,
      customerId: CUSTOMER_ID,
      sellerUserId: USER_ID,
      status: 'CONFIRMED',
      currency: 'XOF',
      subtotal: new Prisma.Decimal(25000),
      depositPaid: new Prisma.Decimal(5000),
      depositMethod: 'CASH',
      createdAt: new Date(), // Tout juste créé (non expiré)
      lines: [
        {
          id: 'line-1',
          productId: PRODUCT_ID,
          productNameSnapshot: 'Ciment Sac 50kg',
          unitSnapshot: 'sac',
          quantity: new Prisma.Decimal(5),
          unitPriceSnapshot: new Prisma.Decimal(5000), // Prix négocié : 5 000 FCFA
          lineTotal: new Prisma.Decimal(25000),
          conversionFactorSnapshot: new Prisma.Decimal(1),
        },
      ],
    };

    const mockTx = {
      order: {
        findFirst: vi.fn().mockResolvedValue(mockOrder),
        update: vi.fn().mockResolvedValue({ ...mockOrder, status: 'COMPLETED' }),
      },
      orderLine: {
        findMany: vi.fn().mockResolvedValue(mockOrder.lines),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([{ id: PRODUCT_ID, isStocked: true }]),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'evt-order-comp' }),
      },
    };

    mockDb = {
      run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
    };

    service = new OrdersService(
      mockDb,
      mockPricing,
      mockUnits,
      mockConfig,
      mockSales,
      mockInventory,
      mockRbac,
    );

    await service.complete(TENANT_ID, USER_ID, ORDER_ID, [
      { method: 'CASH', amount: '20000' },
    ]);

    // Vérification cruciale : sales.create DOIT recevoir unitPriceOverride = 5000
    expect(mockSales.create).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      expect.objectContaining({
        locationId: LOCATION_ID,
        customerId: CUSTOMER_ID,
        lines: [
          expect.objectContaining({
            productId: PRODUCT_ID,
            quantity: '5',
            unit: 'sac',
            unitPriceOverride: '5000',
          }),
        ],
      }),
    );
  });

  it('Règle S1 : une tentative de finaliser un devis expiré (> 15 jours) est rejetée avec un message clair', async () => {
    const expiredDate = new Date(Date.now() - 20 * 24 * 3600 * 1000); // 20 jours en arrière
    const mockOrder = {
      id: ORDER_ID,
      tenantId: TENANT_ID,
      locationId: LOCATION_ID,
      customerId: CUSTOMER_ID,
      sellerUserId: USER_ID,
      status: 'CONFIRMED',
      currency: 'XOF',
      subtotal: new Prisma.Decimal(25000),
      depositPaid: new Prisma.Decimal(0),
      depositMethod: null,
      createdAt: expiredDate, // Expiré face aux 15 jours autorisés
      lines: [],
    };

    const mockTx = {
      order: {
        findFirst: vi.fn().mockResolvedValue(mockOrder),
      },
    };

    mockDb = {
      run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
    };

    service = new OrdersService(
      mockDb,
      mockPricing,
      mockUnits,
      mockConfig,
      mockSales,
      mockInventory,
      mockRbac,
    );

    await expect(service.complete(TENANT_ID, USER_ID, ORDER_ID)).rejects.toThrow(
      'Ce devis a expiré (validité de 15 jours dépassée)',
    );
    expect(mockSales.create).not.toHaveBeenCalled();
  });
});

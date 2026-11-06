import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { QuarantineService } from './quarantine.service.js';

describe('QuarantineService (DÉCISION 4 — Quarantaine virtuelle et opérations SAV)', () => {
  let service: QuarantineService;
  let mockDb: any;
  let mockInventory: any;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const ACTOR_USER_ID = '00000000-0000-0000-0000-000000000002';
  const QUARANTINE_LOC_ID = '00000000-0000-0000-0000-000000000003';
  const STORE_LOC_ID = '00000000-0000-0000-0000-000000000004';
  const PRODUCT_ID = '00000000-0000-0000-0000-000000000005';

  let mockOutboxEvents: any[] = [];
  let currentStockOnHand = new Prisma.Decimal(5);

  beforeEach(() => {
    mockOutboxEvents = [];
    currentStockOnHand = new Prisma.Decimal(5);

    const tx: any = {
      location: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: QUARANTINE_LOC_ID,
            tenantId: TENANT_ID,
            name: 'Quarantaine SAV (Boutique Principale)',
            type: 'QUARANTINE',
          },
        ]),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.id === QUARANTINE_LOC_ID) {
            return Promise.resolve({
              id: QUARANTINE_LOC_ID,
              tenantId: TENANT_ID,
              name: 'Quarantaine SAV (Boutique Principale)',
              type: 'QUARANTINE',
            });
          }
          if (where.id === STORE_LOC_ID) {
            return Promise.resolve({
              id: STORE_LOC_ID,
              tenantId: TENANT_ID,
              name: 'Boutique Principale',
              type: 'STORE',
            });
          }
          return Promise.resolve(null);
        }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: PRODUCT_ID,
            name: 'Écran LED 24 pouces',
            sku: 'ECR-24',
            unit: 'pièce',
            costPrice: new Prisma.Decimal(45000),
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({
          id: PRODUCT_ID,
          name: 'Écran LED 24 pouces',
          sku: 'ECR-24',
          unit: 'pièce',
          costPrice: new Prisma.Decimal(45000),
        }),
      },
      stockLevel: {
        findMany: vi.fn().mockImplementation(() =>
          Promise.resolve([
            {
              id: 'sl-quar-1',
              tenantId: TENANT_ID,
              locationId: QUARANTINE_LOC_ID,
              productId: PRODUCT_ID,
              quantityOnHand: currentStockOnHand,
              updatedAt: new Date(),
            },
          ]),
        ),
        update: vi.fn().mockImplementation(({ data }) => {
          if (data.quantityOnHand) currentStockOnHand = data.quantityOnHand;
          return Promise.resolve({ id: 'sl-quar-1', quantityOnHand: currentStockOnHand });
        }),
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
      $queryRaw: vi.fn().mockImplementation(() =>
        Promise.resolve([{ id: 'sl-quar-1', quantityOnHand: currentStockOnHand }]),
      ),
    };

    mockDb = {
      run: vi.fn().mockImplementation((_tenantId, callback) => callback(tx)),
    };

    mockInventory = {
      applyStockMovementWithTx: vi.fn().mockResolvedValue(undefined),
    };

    service = new QuarantineService(mockDb, mockInventory);
  });

  it('liste le stock présent en quarantaine sans le confondre avec le stock vendable', async () => {
    const stock = await service.listStock(TENANT_ID);
    expect(stock).toHaveLength(1);
    expect(stock[0].productName).toBe('Écran LED 24 pouces');
    expect(stock[0].quantityInQuarantine).toBe('5');
    expect(stock[0].locationName).toContain('Quarantaine');
  });

  it('exécute un diagnostic technique tracé dans l\'Outbox sans mouvement de stock', async () => {
    const result = await service.performOperation(TENANT_ID, ACTOR_USER_ID, {
      operation: 'DIAGNOSTIC',
      quarantineLocationId: QUARANTINE_LOC_ID,
      productId: PRODUCT_ID,
      quantity: '1',
      notes: 'Alimentation défectueuse, condensateur grillé',
    });

    expect(result.success).toBe(true);
    expect(currentStockOnHand.toString()).toBe('5'); // Inchangé
    expect(mockOutboxEvents.some((e) => e.eventType === 'inventory.quarantine.diagnostic')).toBe(true);
  });

  it('exécute une remise en stock validée après réparation (transfert vers le stock vendable de la boutique)', async () => {
    const result = await service.performOperation(TENANT_ID, ACTOR_USER_ID, {
      operation: 'RESTOCK',
      quarantineLocationId: QUARANTINE_LOC_ID,
      targetLocationId: STORE_LOC_ID,
      productId: PRODUCT_ID,
      quantity: '2',
      notes: 'Condensateur remplacé et testé 24h, prêt pour la vente',
    });

    expect(result.success).toBe(true);
    expect(currentStockOnHand.toString()).toBe('3'); // 5 - 2 = 3
    expect(mockInventory.applyStockMovementWithTx).toHaveBeenCalledWith(
      expect.anything(),
      TENANT_ID,
      STORE_LOC_ID,
      PRODUCT_ID,
      new Prisma.Decimal(2),
      'transfer_in',
      'quarantine_restock',
      expect.any(String),
    );
    expect(mockOutboxEvents.some((e) => e.eventType === 'inventory.quarantine.restock')).toBe(true);
  });

  it('exécute une mise au rebut avec justification obligatoire (décrémentation de la quarantaine)', async () => {
    const result = await service.performOperation(TENANT_ID, ACTOR_USER_ID, {
      operation: 'SCRAP',
      quarantineLocationId: QUARANTINE_LOC_ID,
      productId: PRODUCT_ID,
      quantity: '1',
      notes: 'Dalle fissurée irréparable, hors garantie constructeur',
    });

    expect(result.success).toBe(true);
    expect(currentStockOnHand.toString()).toBe('4'); // 5 - 1 = 4
    expect(mockOutboxEvents.some((e) => e.eventType === 'inventory.quarantine.scrap')).toBe(true);
  });

  it('refuse une sortie de quarantaine si la quantité demandée dépasse le disponible', async () => {
    await expect(
      service.performOperation(TENANT_ID, ACTOR_USER_ID, {
        operation: 'SCRAP',
        quarantineLocationId: QUARANTINE_LOC_ID,
        productId: PRODUCT_ID,
        quantity: '10', // 10 > 5
        notes: 'Mise au rebut',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse toute opération sans rapport technique ou justification', async () => {
    await expect(
      service.performOperation(TENANT_ID, ACTOR_USER_ID, {
        operation: 'DIAGNOSTIC',
        quarantineLocationId: QUARANTINE_LOC_ID,
        productId: PRODUCT_ID,
        quantity: '1',
        notes: '   ', // Vide
      }),
    ).rejects.toThrow(/justification obligatoire/);
  });
});

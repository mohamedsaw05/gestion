import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HeldCartsService } from './held-carts.service.js';
import { SalesService } from './sales.service.js';

describe('HeldCarts & Idempotency Concurrency (S1-01 & S1-02)', () => {
  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const USER_ID = '00000000-0000-0000-0000-000000000002';
  const LOCATION_ID = '00000000-0000-0000-0000-000000000004';
  const CART_ID = '00000000-0000-0000-0000-000000000010';
  const OP_ID = '00000000-0000-0000-0000-000000000099';

  describe('HeldCartsService (S1-02 Atomic Resume Lock)', () => {
    let heldCartsService: HeldCartsService;
    let mockDb: any;

    it('S1-02 : reprise réussie acquiert le verrou atomique conditionnel (count = 1)', async () => {
      const mockTx = {
        heldCart: {
          findFirst: vi.fn().mockResolvedValue({
            id: CART_ID,
            tenantId: TENANT_ID,
            locationId: LOCATION_ID,
            sellerUserId: USER_ID,
            label: 'Panier Client A',
            status: 'HELD',
            items: [],
            estimatedTotal: new Prisma.Decimal(15000),
            currency: 'XOF',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };

      mockDb = {
        run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
      };

      heldCartsService = new HeldCartsService(mockDb);

      const res = await heldCartsService.resume(TENANT_ID, CART_ID, USER_ID);
      expect(res.status).toBe('RESUMED');
      expect(mockTx.heldCart.updateMany).toHaveBeenCalledWith({
        where: { id: CART_ID, tenantId: TENANT_ID, status: 'HELD' },
        data: expect.objectContaining({ status: 'RESUMED' }),
      });
    });

    it('S1-02 : reprise concurrente échoue si un autre caissier a déjà repris le panier (count = 0)', async () => {
      const mockTx = {
        heldCart: {
          findFirst: vi.fn().mockResolvedValue({
            id: CART_ID,
            tenantId: TENANT_ID,
            locationId: LOCATION_ID,
            sellerUserId: USER_ID,
            label: 'Panier Client A',
            status: 'HELD', // lu juste avant
            items: [],
            estimatedTotal: new Prisma.Decimal(15000),
            currency: 'XOF',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }), // le verrou a été pris par l'autre caissier
        },
      };

      mockDb = {
        run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
      };

      heldCartsService = new HeldCartsService(mockDb);

      await expect(heldCartsService.resume(TENANT_ID, CART_ID, USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('S1-02 : refus strict si le panier est expiré', async () => {
      const mockTx = {
        heldCart: {
          findFirst: vi.fn().mockResolvedValue({
            id: CART_ID,
            tenantId: TENANT_ID,
            locationId: LOCATION_ID,
            sellerUserId: USER_ID,
            status: 'HELD',
            items: [],
            estimatedTotal: new Prisma.Decimal(15000),
            currency: 'XOF',
            createdAt: new Date(Date.now() - 1000000),
            expiresAt: new Date(Date.now() - 1000), // expiré
          }),
          updateMany: vi.fn(),
        },
      };

      mockDb = {
        run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
      };

      heldCartsService = new HeldCartsService(mockDb);

      await expect(heldCartsService.resume(TENANT_ID, CART_ID, USER_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(mockTx.heldCart.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('SalesService Idempotency Fingerprint (S1-01)', () => {
    let salesService: SalesService;
    let mockDb: any;

    beforeEach(() => {
      const mockTx = {
        sale: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.operationId === OP_ID) {
              return Promise.resolve({
                id: 'sale-existing-1',
                tenantId: TENANT_ID,
                locationId: LOCATION_ID,
                customerId: 'cust-1',
                operationId: OP_ID,
                grandTotal: new Prisma.Decimal(10000),
                lines: [
                  { productId: 'prod-1', quantity: new Prisma.Decimal(2) },
                ],
                payments: [],
                documents: [],
              });
            }
            return Promise.resolve(null);
          }),
        },
      };

      mockDb = {
        run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
      };

      salesService = new SalesService(
        mockDb,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('S1-01 : retry réseau avec même operationId et même payload retourne la vente existante sans re-traitement', async () => {
      const res = await salesService.create(TENANT_ID, USER_ID, {
        locationId: LOCATION_ID,
        customerId: 'cust-1',
        operationId: OP_ID,
        lines: [
          { productId: 'prod-1', quantity: '2' },
        ],
      } as any);

      expect(res.id).toBe('sale-existing-1');
    });

    it('S1-01 : réutilisation du même operationId avec un payload différent (autre client ou articles) est rejetée avec 409 Conflict', async () => {
      await expect(
        salesService.create(TENANT_ID, USER_ID, {
          locationId: LOCATION_ID,
          customerId: 'cust-AUTRE-CLIENT',
          operationId: OP_ID,
          lines: [
            { productId: 'prod-1', quantity: '2' },
          ],
        } as any),
      ).rejects.toThrow(ConflictException);

      await expect(
        salesService.create(TENANT_ID, USER_ID, {
          locationId: LOCATION_ID,
          customerId: 'cust-1',
          operationId: OP_ID,
          lines: [
            { productId: 'prod-DIFFERENT', quantity: '2' },
          ],
        } as any),
      ).rejects.toThrow(ConflictException);

      // Quantité différente
      await expect(
        salesService.create(TENANT_ID, USER_ID, {
          locationId: LOCATION_ID,
          customerId: 'cust-1',
          operationId: OP_ID,
          lines: [
            { productId: 'prod-1', quantity: '5' },
          ],
        } as any),
      ).rejects.toThrow(ConflictException);

      // Répartition de paiement différente
      await expect(
        salesService.create(TENANT_ID, USER_ID, {
          locationId: LOCATION_ID,
          customerId: 'cust-1',
          operationId: OP_ID,
          lines: [
            { productId: 'prod-1', quantity: '2' },
          ],
          payments: [
            { method: 'CASH', amount: '99999' },
          ],
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });
});

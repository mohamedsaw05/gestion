import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { AlertsService } from './alerts.service.js';
import type { PrismaTenantService } from '../common/prisma-tenant.service.js';

describe('AlertsService', () => {
  it('identifie correctement les ruptures, stocks faibles, péremptions et créances échues', async () => {
    const mockDb = {
      run: async (_tenantId: string, fn: (tx: any) => Promise<any>) => {
        const mockTx = {
          stockLevel: {
            findMany: async () => [
              {
                id: 'sl-1',
                productId: 'p-1',
                locationId: 'loc-1',
                quantityOnHand: new Prisma.Decimal(0),
                location: { id: 'loc-1', name: 'Magasin Central' },
              },
              {
                id: 'sl-2',
                productId: 'p-2',
                locationId: 'loc-1',
                quantityOnHand: new Prisma.Decimal(3),
                location: { id: 'loc-1', name: 'Magasin Central' },
              },
            ],
          },
          product: {
            findMany: async () => [
              { id: 'p-1', name: 'Riz 25kg', sku: 'RIZ-25' },
              { id: 'p-2', name: 'Huile 5L', sku: 'HUI-5L' },
            ],
          },
          location: {
            findMany: async () => [{ id: 'loc-1', name: 'Magasin Central' }],
          },
          customer: {
            findMany: async () => [{ id: 'c-1', name: 'Client Retardataire', phone: '70000000' }],
          },
          stockBatch: {
            findMany: async () => [
              {
                id: 'batch-1',
                productId: 'p-1',
                lotNumber: 'LOT-999',
                quantity: new Prisma.Decimal(10),
                expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // déjà périmé hier
              },
            ],
          },
          creditAccount: {
            findMany: async () => [
              {
                id: 'ca-1',
                customerId: 'c-1',
                balance: new Prisma.Decimal(25000),
              },
            ],
          },
          cashSession: {
            findMany: async () => [],
          },
        };
        return fn(mockTx);
      },
    } as unknown as PrismaTenantService;

    const service = new AlertsService(mockDb);
    const result = await service.getOperationalAlerts('tenant-123');

    expect(result.total).toBe(4);
    
    // Alerte 1 : rupture critique
    const ruptureAlert = result.alerts.find((a) => a.id === 'stock-sl-1');
    expect(ruptureAlert).toBeDefined();
    expect(ruptureAlert?.severity).toBe('CRITICAL');
    expect(ruptureAlert?.title).toContain('Rupture de stock : Riz 25kg');

    // Alerte 2 : stock faible warning
    const lowStockAlert = result.alerts.find((a) => a.id === 'stock-sl-2');
    expect(lowStockAlert).toBeDefined();
    expect(lowStockAlert?.severity).toBe('WARNING');
    expect(lowStockAlert?.message).toContain('Quantité restante: 3');

    // Alerte 3 : lot périmé critique
    const batchAlert = result.alerts.find((a) => a.id === 'batch-batch-1');
    expect(batchAlert).toBeDefined();
    expect(batchAlert?.severity).toBe('CRITICAL');
    expect(batchAlert?.title).toContain('Lot périmé : Riz 25kg');

    // Alerte 4 : créance échue
    const creditAlert = result.alerts.find((a) => a.id === 'credit-ca-1');
    expect(creditAlert).toBeDefined();
    expect(creditAlert?.severity).toBe('WARNING');
    expect(creditAlert?.message).toContain('Solde impayé de 25000 XOF');
  });
});

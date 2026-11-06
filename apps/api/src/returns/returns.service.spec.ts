import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { ReturnsService } from './returns.service.js';

describe('ReturnsService (S0 Financial Protection & Strict Debt/Cash Enforcement)', () => {
  let service: ReturnsService;
  let mockDb: any;
  let mockInventory: any;
  let mockDocuments: any;
  let mockRbac: any;
  let mockCredit: any;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const USER_ID = '00000000-0000-0000-0000-000000000002';
  const SALE_ID = '00000000-0000-0000-0000-000000000003';
  const LOCATION_ID = '00000000-0000-0000-0000-000000000004';
  const CUSTOMER_ID = '00000000-0000-0000-0000-000000000005';
  const PRODUCT_ID = '00000000-0000-0000-0000-000000000006';
  const SALE_LINE_ID = '00000000-0000-0000-0000-000000000007';

  beforeEach(() => {
    mockInventory = {
      applyStockMovementWithTx: vi.fn().mockResolvedValue(undefined),
    };
    mockDocuments = {
      createCreditNoteForReturnWithTx: vi.fn().mockResolvedValue({ id: 'doc-123' }),
    };
    mockRbac = {
      getRecordVisibility: vi.fn().mockResolvedValue({ allLocations: true }),
    };
    mockCredit = {
      reduceDebtWithTx: vi.fn().mockResolvedValue({ accountId: 'acc-1', debtReduced: new Prisma.Decimal(50000), newBalance: new Prisma.Decimal(0) }),
    };
  });

  it('Règle S0 : crédit impayé + demande CASH -> REFUS STRICT avec code VTM-RETURNS-CASH-REFUND-FORBIDDEN', async () => {
    const mockTx = {
      return: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'ret-1' }),
      },
      sale: {
        findFirst: vi.fn().mockResolvedValue({
          id: SALE_ID,
          status: 'COMPLETED',
          tenantId: TENANT_ID,
          locationId: LOCATION_ID,
          customerId: CUSTOMER_ID,
          currency: 'XOF',
          grandTotal: new Prisma.Decimal(50000),
          amountPaid: new Prisma.Decimal(0),
          balanceDue: new Prisma.Decimal(50000),
          lines: [
            {
              id: SALE_LINE_ID,
              productId: PRODUCT_ID,
              productNameSnapshot: 'TV Smart 43',
              unitSnapshot: 'piece',
              conversionFactorSnapshot: new Prisma.Decimal(1),
              quantity: new Prisma.Decimal(1),
              unitPriceSnapshot: new Prisma.Decimal(50000),
            },
          ],
        }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: PRODUCT_ID, name: 'TV Smart 43', isStocked: true, tracksSerialNumbers: false },
        ]),
      },
      returnLine: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: new Prisma.Decimal(0) } }),
        create: vi.fn().mockResolvedValue({ id: 'ret-line-1' }),
      },
      creditMovement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      cashSession: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session-open-1', status: 'OPEN' }),
      },
      cashMovement: {
        create: vi.fn(),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };

    mockDb = {
      run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
    };

    service = new ReturnsService(mockDb, mockInventory, mockDocuments, mockRbac, mockCredit);

    await expect(
      service.create(TENANT_ID, USER_ID, {
        saleId: SALE_ID,
        operationId: '00000000-0000-0000-0000-000000000099',
        reason: 'Article ne convient pas',
        refundMethod: 'CASH',
        lines: [
          {
            saleLineId: SALE_LINE_ID,
            quantity: '1',
            condition: 'GOOD',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    // Vérifier qu'aucun cash n'est sorti
    expect(mockTx.cashMovement.create).not.toHaveBeenCalled();
  });

  it('Règle S0 : crédit impayé + retour sans demande CASH -> créance annulée correctement, aucun cash créé', async () => {
    const mockTx = {
      return: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'ret-1' }),
      },
      sale: {
        findFirst: vi.fn().mockResolvedValue({
          id: SALE_ID,
          status: 'COMPLETED',
          tenantId: TENANT_ID,
          locationId: LOCATION_ID,
          customerId: CUSTOMER_ID,
          currency: 'XOF',
          grandTotal: new Prisma.Decimal(50000),
          amountPaid: new Prisma.Decimal(0),
          balanceDue: new Prisma.Decimal(50000),
          lines: [
            {
              id: SALE_LINE_ID,
              productId: PRODUCT_ID,
              productNameSnapshot: 'TV Smart 43',
              unitSnapshot: 'piece',
              conversionFactorSnapshot: new Prisma.Decimal(1),
              quantity: new Prisma.Decimal(1),
              unitPriceSnapshot: new Prisma.Decimal(50000),
            },
          ],
        }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: PRODUCT_ID, name: 'TV Smart 43', isStocked: true, tracksSerialNumbers: false },
        ]),
      },
      returnLine: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: new Prisma.Decimal(0) } }),
        create: vi.fn().mockResolvedValue({ id: 'ret-line-1' }),
      },
      creditMovement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      cashSession: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session-open-1', status: 'OPEN' }),
      },
      cashMovement: {
        create: vi.fn(),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };

    mockDb = {
      run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
    };

    service = new ReturnsService(mockDb, mockInventory, mockDocuments, mockRbac, mockCredit);

    await service.create(TENANT_ID, USER_ID, {
      saleId: SALE_ID,
      operationId: '00000000-0000-0000-0000-000000000099',
      reason: 'Article défectueux',
      lines: [
        {
          saleLineId: SALE_LINE_ID,
          quantity: '1',
          condition: 'GOOD',
        },
      ],
    });

    // 1. La dette doit être annulée en priorité
    expect(mockCredit.reduceDebtWithTx).toHaveBeenCalledWith(
      mockTx,
      TENANT_ID,
      CUSTOMER_ID,
      expect.objectContaining({ s: 1, e: 4, d: [50000] }),
      expect.any(String),
      expect.stringContaining('Annulation de créance'),
    );

    // 2. AUCUN mouvement de sortie d'espèces (CASH_OUT)
    expect(mockTx.cashMovement.create).not.toHaveBeenCalled();

    // 3. L'avoir officiel est émis pour formaliser l'opération
    expect(mockDocuments.createCreditNoteForReturnWithTx).toHaveBeenCalled();
  });

  it('Règle S0 : sur vente mixte (30k payés cash, 70k dette), un retour de 100k avec demande CASH rembourse 30k en espèces et annule 70k de dette', async () => {
    const mockTx = {
      return: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'ret-2' }),
      },
      sale: {
        findFirst: vi.fn().mockResolvedValue({
          id: SALE_ID,
          status: 'COMPLETED',
          tenantId: TENANT_ID,
          locationId: LOCATION_ID,
          customerId: CUSTOMER_ID,
          currency: 'XOF',
          grandTotal: new Prisma.Decimal(100000),
          amountPaid: new Prisma.Decimal(30000),
          balanceDue: new Prisma.Decimal(70000),
          lines: [
            {
              id: SALE_LINE_ID,
              productId: PRODUCT_ID,
              productNameSnapshot: 'Marchandise Pro',
              unitSnapshot: 'piece',
              conversionFactorSnapshot: new Prisma.Decimal(1),
              quantity: new Prisma.Decimal(2),
              unitPriceSnapshot: new Prisma.Decimal(50000),
            },
          ],
        }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: PRODUCT_ID, name: 'Marchandise Pro', isStocked: true, tracksSerialNumbers: false },
        ]),
      },
      returnLine: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: new Prisma.Decimal(0) } }),
        create: vi.fn().mockResolvedValue({ id: 'ret-line-2' }),
      },
      creditMovement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      payment: {
        findMany: vi.fn().mockResolvedValue([
          { amount: new Prisma.Decimal(30000), method: 'CASH' },
        ]),
      },
      cashSession: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session-open-1', status: 'OPEN' }),
      },
      cashMovement: {
        create: vi.fn().mockResolvedValue({ id: 'cash-out-1' }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'evt-2' }),
      },
    };

    mockDb = {
      run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
    };

    service = new ReturnsService(mockDb, mockInventory, mockDocuments, mockRbac, mockCredit);

    // Retour des deux pièces (100 000 FCFA total)
    await service.create(TENANT_ID, USER_ID, {
      saleId: SALE_ID,
      operationId: '00000000-0000-0000-0000-000000000088',
      reason: 'Retour complet vente mixte',
      refundMethod: 'CASH',
      lines: [
        {
          saleLineId: SALE_LINE_ID,
          quantity: '2',
          condition: 'GOOD',
        },
      ],
    });

    // 1. 70k de dette annulée
    expect(mockCredit.reduceDebtWithTx).toHaveBeenCalledWith(
      mockTx,
      TENANT_ID,
      CUSTOMER_ID,
      expect.objectContaining({ s: 1, e: 4, d: [70000] }),
      expect.any(String),
      expect.any(String),
    );

    // 2. 30k remboursés en CASH_OUT (car 30k avaient été payés en CASH)
    expect(mockTx.cashMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CASH_OUT',
          amount: expect.objectContaining({ s: 1, e: 4, d: [30000] }),
        }),
      }),
    );
  });

  it('Règle S0 : demande de remboursement CASH supérieure aux espèces encaissées -> REFUS VTM-RETURNS-REFUND-EXCEEDS-PAID', async () => {
    const mockTx = {
      return: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'ret-3' }),
      },
      sale: {
        findFirst: vi.fn().mockResolvedValue({
          id: SALE_ID,
          status: 'COMPLETED',
          tenantId: TENANT_ID,
          locationId: LOCATION_ID,
          customerId: CUSTOMER_ID,
          currency: 'XOF',
          grandTotal: new Prisma.Decimal(100000),
          amountPaid: new Prisma.Decimal(50000),
          balanceDue: new Prisma.Decimal(50000),
          lines: [
            {
              id: SALE_LINE_ID,
              productId: PRODUCT_ID,
              productNameSnapshot: 'Marchandise Pro',
              unitSnapshot: 'piece',
              conversionFactorSnapshot: new Prisma.Decimal(1),
              quantity: new Prisma.Decimal(2),
              unitPriceSnapshot: new Prisma.Decimal(50000),
            },
          ],
        }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: PRODUCT_ID, name: 'Marchandise Pro', isStocked: true, tracksSerialNumbers: false },
        ]),
      },
      returnLine: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: new Prisma.Decimal(0) } }),
        create: vi.fn(),
      },
      creditMovement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      payment: {
        findMany: vi.fn().mockResolvedValue([
          // Seulement 20 000 payés en CASH
          { amount: new Prisma.Decimal(20000), method: 'CASH' },
        ]),
      },
      cashSession: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session-open-1', status: 'OPEN' }),
      },
      cashMovement: {
        create: vi.fn(),
      },
      outboxEvent: {
        create: vi.fn(),
      },
    };

    mockDb = {
      run: vi.fn().mockImplementation((_tenantId, callback) => callback(mockTx)),
    };

    service = new ReturnsService(mockDb, mockInventory, mockDocuments, mockRbac, mockCredit);

    // Retour des 2 pièces (100k total) : 50k annule la dette, il reste 50k remboursable.
    // Mais seulement 20k ont été perçus en CASH ! Demander CASH doit être refusé.
    await expect(
      service.create(TENANT_ID, USER_ID, {
        saleId: SALE_ID,
        operationId: '00000000-0000-0000-0000-000000000077',
        reason: 'Retour avec excès cash',
        refundMethod: 'CASH',
        lines: [
          {
            saleLineId: SALE_LINE_ID,
            quantity: '2',
            condition: 'GOOD',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockTx.cashMovement.create).not.toHaveBeenCalled();
  });
});

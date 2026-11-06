import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppointmentsService } from './appointments.service.js';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let fakeTx: any;
  let fakeDb: PrismaTenantService;

  beforeEach(() => {
    fakeTx = {
      appointment: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      customer: {
        findFirst: vi.fn(),
      },
    };

    fakeDb = {
      run: vi.fn(async (_tenantId, fn) => fn(fakeTx)),
    } as unknown as PrismaTenantService;

    service = new AppointmentsService(fakeDb);
  });

  it('devrait créer un rendez-vous avec succès', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    fakeTx.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'Amadou Traoré',
      phone: '+22670000000',
      email: 'amadou@example.com',
    });

    fakeTx.appointment.create.mockImplementation(({ data }: any) => Promise.resolve(data));

    const result = await service.create(tenantId, {
      locationId: 'loc-1',
      customerId: 'cust-1',
      title: 'Consultation & Diagnostic',
      serviceName: 'Réparation',
      scheduledAt: '2026-10-30T10:00:00.000Z',
      durationMinutes: 45,
    });

    expect(result).toBeDefined();
    expect(result.title).toBe('Consultation & Diagnostic');
    expect(result.customerName).toBe('Amadou Traoré');
    expect(result.customerPhone).toBe('+22670000000');
    expect(result.durationMinutes).toBe(45);
    expect(result.status).toBe('CONFIRMED');
    expect(fakeTx.appointment.create).toHaveBeenCalled();
  });

  it('devrait lister les rendez-vous filtrés par statut', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    fakeTx.appointment.findMany.mockResolvedValue([
      { id: 'apt-1', title: 'RDV 1', status: 'CONFIRMED' },
    ]);

    const list = await service.list(tenantId, { status: 'CONFIRMED' });
    expect(list).toHaveLength(1);
    expect(fakeTx.appointment.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId, status: 'CONFIRMED' }),
      orderBy: { scheduledAt: 'asc' },
    });
  });

  it('devrait mettre à jour le statut du rendez-vous vers COMPLETED', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    fakeTx.appointment.findFirst.mockResolvedValue({
      id: 'apt-1',
      tenantId,
      status: 'CONFIRMED',
    });

    fakeTx.appointment.update.mockResolvedValue({
      id: 'apt-1',
      status: 'COMPLETED',
    });

    const updated = await service.update(tenantId, 'apt-1', { status: 'COMPLETED' });
    expect(updated.status).toBe('COMPLETED');
    expect(fakeTx.appointment.update).toHaveBeenCalledWith({
      where: { id: 'apt-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
  });

  it('devrait supprimer un rendez-vous', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    fakeTx.appointment.findFirst.mockResolvedValue({
      id: 'apt-1',
      tenantId,
    });
    fakeTx.appointment.delete.mockResolvedValue({ id: 'apt-1' });

    const res = await service.delete(tenantId, 'apt-1');
    expect(res.success).toBe(true);
    expect(fakeTx.appointment.delete).toHaveBeenCalledWith({ where: { id: 'apt-1' } });
  });
});

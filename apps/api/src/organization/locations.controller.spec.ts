import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { LocationsController } from './locations.controller.js';

describe('LocationsController global store-name uniqueness', () => {
  it('normalizes accents, case and repeated spaces before checking for duplicates', async () => {
    const tx = { location: { findFirst: vi.fn().mockResolvedValue({ id: 'existing', name: 'Café Centre' }) } };
    const db = { run: vi.fn((_tenantId: string, operation: (client: any) => unknown) => operation(tx)) };
    const controller = new LocationsController(db as any);

    await expect(controller.create({ tenantId: 'tenant-id' } as any, { name: '  CAFE   Centre ', type: 'STORE' }))
      .rejects.toThrow(BadRequestException);

    expect(tx.location.findFirst).toHaveBeenCalledWith({
      where: { type: 'STORE', deletedAt: null, normalizedName: 'cafe centre' },
      select: { id: true, name: true },
    });
  });

  it('returns a readable conflict instead of leaking a database unique-index error', async () => {
    const db = { run: vi.fn().mockRejectedValue({ code: 'P2002' }) };
    const controller = new LocationsController(db as any);
    await expect(controller.create({ tenantId: 'tenant-id' } as any, { name: 'Boutique 1', type: 'STORE' }))
      .rejects.toThrow('Choisissez un nom unique');
  });
});

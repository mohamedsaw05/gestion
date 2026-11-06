import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CommercialSettingsService } from './commercial-settings.service.js';

const { findUnique, upsert, invoiceCreate, subscriptionFind, historyCreate, historyList } = vi.hoisted(() => ({
  findUnique: vi.fn(), upsert: vi.fn(), invoiceCreate: vi.fn(), subscriptionFind: vi.fn(), historyCreate: vi.fn(), historyList: vi.fn(),
}));

function makeService() {
  const client: any = {
    platformConfig: { findUnique, upsert },
    platformTariffHistory: { findMany: historyList, create: historyCreate },
    platformSubscription: { findUnique: subscriptionFind },
    platformInvoice: { create: invoiceCreate },
  };
  return new CommercialSettingsService({ client } as any);
}

describe('CommercialSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
    subscriptionFind.mockResolvedValue({ id: 'sub-1', currentPeriodEnd: new Date('2027-01-31T00:00:00.000Z') });
    invoiceCreate.mockImplementation(async ({ data }: any) => data);
    historyCreate.mockResolvedValue({});
    historyList.mockResolvedValue([]);
  });

  it('publishes only 3, 6, 12 and 24 month formulas from the central monthly price', async () => {
    const value = await makeService().getPublicSettings();
    expect(value.monthlyReferencePrice).toBe(2500);
    expect(value.plans.map((plan) => [plan.months, plan.totalPrice])).toEqual([[3, 7500], [6, 15000], [12, 30000], [24, 60000]]);
  });

  it('uses a centrally updated price and retains a tariff history entry with its actor', async () => {
    let tariff = 2500;
    findUnique.mockImplementation(async ({ where }: any) => where.key === 'commercial.subscription-tariff' ? { value: tariff } : null);
    upsert.mockImplementation(async ({ where, update }: any) => { if (where.key === 'commercial.subscription-tariff') tariff = update.value; return {}; });
    const service = makeService();
    (service as any).platform.client.$transaction = async (fn: any) => fn((service as any).platform.client);
    const value = await service.updateMonthlyPrice(3000, { id: 'admin-1', email: 'admin@example.test' }, 'Révision annuelle');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: 'commercial.subscription-tariff' }, update: { value: 3000 } }));
    expect(historyCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ previousMonthlyPrice: 2500, monthlyPrice: 3000, actorEmail: 'admin@example.test', reason: 'Révision annuelle' }) }));
    expect(value.plans.map((plan) => plan.totalPrice)).toEqual([9000, 18000, 36000, 72000]);
  });

  it.each([1, 2, 5])('refuses a commercial invoice for %i months', async (months) => {
    await expect(makeService().createCommercialInvoice('tenant-1', months)).rejects.toBeInstanceOf(BadRequestException);
    expect(invoiceCreate).not.toHaveBeenCalled();
  });

  it.each([[3, 7500], [6, 15000], [12, 30000], [24, 60000]])('creates the %i month invoice at the server-computed amount', async (months, amount) => {
    const invoice = await makeService().createCommercialInvoice('tenant-1', months);
    expect(invoice).toEqual(expect.objectContaining({ amount, currency: 'XOF', periodStart: new Date('2027-01-31T00:00:00.000Z'), periodEnd: new Date(months === 3 ? '2027-04-30T00:00:00.000Z' : months === 6 ? '2027-07-31T00:00:00.000Z' : months === 12 ? '2028-01-31T00:00:00.000Z' : '2029-01-31T00:00:00.000Z') }));
  });
});

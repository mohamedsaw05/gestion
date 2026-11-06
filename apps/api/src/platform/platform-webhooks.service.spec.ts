import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'node:crypto';
import { PlatformWebhooksService } from './platform-webhooks.service.js';
import { PlatformSubscriptionsService } from './platform-subscriptions.service.js';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';

describe('PlatformWebhooksService (Unit - Stripe, Paystack, Wave & CinetPay)', () => {
  let service: PlatformWebhooksService;
  let mockSubscriptions: Partial<PlatformSubscriptionsService>;
  let mockPlatformPrisma: Partial<PlatformPrismaService>;
  const eventsInDb = new Map<string, any>();
  const TEST_SECRET = 'whsec_test_secret_1234567890abcdef';

  beforeEach(() => {
    eventsInDb.clear();
    mockSubscriptions = {
      recordInvoicePayment: vi.fn().mockResolvedValue({ message: 'OK', invoice: {} as any }),
    };
    mockPlatformPrisma = {
      client: {
        pspWebhookEvent: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            const key = `${where.provider_eventId.provider}:${where.provider_eventId.eventId}`;
            return Promise.resolve(eventsInDb.get(key) || null);
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const key = `${data.provider}:${data.eventId}`;
            if (eventsInDb.has(key)) {
              const err: any = new Error('Unique constraint failed');
              err.code = 'P2002';
              throw err;
            }
            eventsInDb.set(key, data);
            return Promise.resolve(data);
          }),
          update: vi.fn().mockImplementation(({ where, data }) => {
            return Promise.resolve({ ...data, id: where.id });
          }),
          deleteMany: vi.fn().mockImplementation(() => {
            eventsInDb.clear();
            return Promise.resolve({ count: 0 });
          }),
        } as any,
      } as any,
    };
    service = new PlatformWebhooksService(mockSubscriptions as any, mockPlatformPrisma as any);
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
    process.env.PAYSTACK_WEBHOOK_SECRET = TEST_SECRET;
    process.env.WAVE_WEBHOOK_SECRET = TEST_SECRET;
    process.env.CINETPAY_WEBHOOK_SECRET = TEST_SECRET;
  });

  function signPayload(payload: string, secret = TEST_SECRET): string {
    return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  }

  it('rejette un webhook avec signature invalide (401)', async () => {
    const payload = JSON.stringify({ id: 'evt_001', type: 'invoice.payment_succeeded' });
    const invalidSig = signPayload(payload, 'wrong_secret');

    await expect(
      service.handlePspWebhook('stripe', invalidSig, payload),
    ).rejects.toThrow('Signature cryptographique de webhook invalide');
  });

  it('traite avec succès un webhook Stripe authentique et appelle recordInvoicePayment', async () => {
    const payload = JSON.stringify({
      id: 'evt_stripe_valid_01',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          metadata: {
            invoiceId: '98d5c4b6-a849-43a9-a681-4fe65f6f69e6',
          },
        },
      },
    });
    const sig = signPayload(payload);

    const result = await service.handlePspWebhook('stripe', `t=12345,v1=${sig}`, payload);
    expect(result.status).toBe('processed');
    expect(result.event).toBe('invoice.payment_succeeded');
    expect(mockSubscriptions.recordInvoicePayment).toHaveBeenCalledWith(
      '98d5c4b6-a849-43a9-a681-4fe65f6f69e6',
      expect.objectContaining({
        paymentMethod: 'STRIPE_ONLINE',
        paymentReference: 'evt_stripe_valid_01',
      }),
    );
  });

  it('traite avec succès un webhook Wave authentique avec signature t=...,v1=...', async () => {
    const payload = JSON.stringify({
      id: 'wave_evt_1001',
      type: 'checkout.session.completed',
      data: {
        metadata: {
          invoiceId: 'inv-wave-999',
        },
      },
    });
    const timestamp = '1730455000';
    const waveSig = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${timestamp}${payload}`, 'utf8')
      .digest('hex');

    const result = await service.handlePspWebhook('wave', `t=${timestamp},v1=${waveSig}`, payload);
    expect(result.status).toBe('processed');
    expect(result.event).toBe('checkout.session.completed');
    expect(mockSubscriptions.recordInvoicePayment).toHaveBeenCalledWith(
      'inv-wave-999',
      expect.objectContaining({
        paymentMethod: 'WAVE_ONLINE',
        paymentReference: 'wave_evt_1001',
      }),
    );
  });

  it('traite avec succès un webhook CinetPay authentique avec signature x-token', async () => {
    const payload = JSON.stringify({
      cpm_trans_id: 'cinetpay_tx_777',
      cpm_trans_status: 'ACCEPTED',
      cpm_custom: 'inv-cinetpay-888',
    });
    const cinetpaySig = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    const result = await service.handlePspWebhook('cinetpay', cinetpaySig, payload);
    expect(result.status).toBe('processed');
    expect(mockSubscriptions.recordInvoicePayment).toHaveBeenCalledWith(
      'inv-cinetpay-888',
      expect.objectContaining({
        paymentMethod: 'CINETPAY_ONLINE',
        paymentReference: 'cinetpay_tx_777',
      }),
    );
  });

  it('ignore de façon idempotente une notification déjà reçue (replay attack protection)', async () => {
    const payload = JSON.stringify({
      id: 'evt_stripe_duplicate',
      type: 'invoice.payment_succeeded',
      data: { object: { metadata: { invoiceId: 'inv-123' } } },
    });
    const sig = signPayload(payload);

    // 1er appel -> traité
    const res1 = await service.handlePspWebhook('stripe', `v1=${sig}`, payload);
    expect(res1.status).toBe('processed');

    // 2e appel avec le même eventId -> ignoré pour éviter les doublons de paiement
    const res2 = await service.handlePspWebhook('stripe', `v1=${sig}`, payload);
    expect(res2.status).toBe('ignored');
    expect(res2.reason).toBe('duplicate_notification');
  });
});

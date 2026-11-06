import { describe, expect, it } from 'vitest';
import { SocialComplianceService } from './social-compliance.service.js';

describe('SocialComplianceService (Official Meta/TikTok/WhatsApp Policies)', () => {
  const createMockDb = (optInStatus: string | null = null) =>
    ({
      run: async (_tenantId: string, fn: any) =>
        fn({
          socialConsent: {
            findFirst: async () => (optInStatus ? { optInStatus } : null),
          },
        }),
    } as any);

  it('autorise une réponse manuelle dans la fenêtre conversationnelle de 24h', async () => {
    const service = new SocialComplianceService(createMockDb());
    const recentDate = new Date(Date.now() - 2 * 3600 * 1000); // 2h écoulées

    await expect(
      service.validateOutboundMessageOrThrow('tenant-1', 'FACEBOOK', 'fb-user-1', recentDate, false),
    ).resolves.not.toThrow();
  });

  it('bloque formellement une tentative de relance de dette/crédit sur WhatsApp conformément à la politique Meta', async () => {
    const service = new SocialComplianceService(createMockDb());
    const recentDate = new Date(Date.now() - 1 * 3600 * 1000);

    await expect(
      service.validateOutboundMessageOrThrow('tenant-1', 'WHATSAPP', '+22670000000', recentDate, true),
    ).rejects.toThrow(/Conformité Meta WhatsApp Business Messaging Policy/);
  });

  it('bloque un envoi si le contact a formulé une demande d’opt-out ou de désabonnement', async () => {
    const service = new SocialComplianceService(createMockDb('OPTED_OUT'));
    const recentDate = new Date(Date.now() - 1 * 3600 * 1000);

    await expect(
      service.validateOutboundMessageOrThrow('tenant-1', 'FACEBOOK', 'fb-user-1', recentDate, false),
    ).rejects.toThrow(/opt-out/);
  });

  it('bloque un message direct standard hors de la fenêtre conversationnelle de 24h', async () => {
    const service = new SocialComplianceService(createMockDb());
    const oldDate = new Date(Date.now() - 36 * 3600 * 1000); // 36h écoulées

    await expect(
      service.validateOutboundMessageOrThrow('tenant-1', 'INSTAGRAM', 'ig-user-1', oldDate, false),
    ).rejects.toThrow(/Fenêtre de messagerie Meta fermée/);
  });
});

import { BadRequestException, Injectable } from '@nestjs/common';
import { newTransactionalId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import type { SocialPlatform } from './social.interface.js';

@Injectable()
export class SocialComplianceService {
  constructor(private readonly db: PrismaTenantService) {}

  /**
   * Vérifie la conformité de l'envoi avant tout appel réseau aux APIs officielles :
   * 1. Vérification d'opt-out / désabonnement (liste de suppression)
   * 2. Fenêtre de messagerie 24h (Meta / Instagram)
   * 3. Interdiction formelle du recouvrement de dettes sur WhatsApp
   */
  async validateOutboundMessageOrThrow(
    tenantId: string,
    platform: SocialPlatform,
    recipientExternalId: string,
    lastCustomerMessageAt?: Date | null,
    isDebtReminder: boolean = false,
  ): Promise<void> {
    // Règle 1 : WhatsApp Debt Collection restriction (Section 11.6 & 12 du CDC)
    if (platform === 'WHATSAPP' && isDebtReminder) {
      throw new BadRequestException(
        'Conformité Meta WhatsApp Business Messaging Policy : Le recouvrement de créances / dettes est formellement restreint sur WhatsApp. Envoi bloqué.',
      );
    }

    // Règle 2 : Vérification du consentement et liste d'exclusion / opt-out
    await this.db.run(tenantId, async (tx) => {
      const consent = await tx.socialConsent.findFirst({
        where: {
          tenantId,
          channel: platform,
          recipient: recipientExternalId,
        },
      });

      if (consent) {
        if (consent.optInStatus === 'OPTED_OUT') {
          throw new BadRequestException(
            `Le destinataire a révoqué son consentement (opt-out) sur ${platform}. Envoi interdit conformément aux politiques de la plateforme.`,
          );
        }
      }

      // Règle 3 : Fenêtre de messagerie conversationnelle de 24h (Meta Graph & Instagram Direct)
      if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') {
        if (lastCustomerMessageAt) {
          const now = Date.now();
          const elapsedHours = (now - new Date(lastCustomerMessageAt).getTime()) / (1000 * 3600);
          if (elapsedHours > 24) {
            throw new BadRequestException(
              `Fenêtre de messagerie Meta fermée (${Math.round(elapsedHours)}h écoulées depuis le dernier message du client). Seules les réponses sous 24h ou les balises exceptionnelles autorisées (HUMAN_AGENT) sont permises.`,
            );
          }
        }
      }
    });
  }

  /**
   * Enregistre un opt-in ou un opt-out client pour un canal social.
   */
  async recordConsent(
    tenantId: string,
    platform: SocialPlatform,
    recipient: string,
    optedIn: boolean,
    source: string,
  ) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.socialConsent.findUnique({
        where: {
          tenantId_channel_recipient_category: {
            tenantId,
            channel: platform,
            recipient,
            category: 'MARKETING',
          },
        },
      });

      if (existing) {
        return tx.socialConsent.update({
          where: { id: existing.id },
          data: {
            optInStatus: optedIn ? 'OPTED_IN' : 'OPTED_OUT',
            source,
            optOutAt: optedIn ? null : new Date(),
          },
        });
      }

      return tx.socialConsent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          channel: platform,
          recipient,
          category: 'MARKETING',
          optInStatus: optedIn ? 'OPTED_IN' : 'OPTED_OUT',
          source,
          optInAt: new Date(),
          optOutAt: optedIn ? null : new Date(),
        },
      });
    });
  }
}

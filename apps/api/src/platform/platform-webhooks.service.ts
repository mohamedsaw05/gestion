import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { newTransactionalId } from '@gestionnaire/db';
import { PlatformSubscriptionsService } from './platform-subscriptions.service.js';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';

export interface WebhookResult {
  status: 'processed' | 'ignored';
  event: string;
  reason?: string;
  invoiceId?: string;
}

@Injectable()
export class PlatformWebhooksService {
  constructor(
    private readonly subscriptions: PlatformSubscriptionsService,
    private readonly platformPrisma: PlatformPrismaService,
  ) {}

  public async clearLedgerForTesting(): Promise<void> {
    try {
      await this.platformPrisma.client.pspWebhookEvent.deleteMany({});
    } catch {
      // Ignorer si table vide ou déjà purgée
    }
  }

  /**
   * Vérifie la signature cryptographique HMAC-SHA256 d'un webhook PSP et traite la notification de façon idempotente
   * avec persistance PostgreSQL et contrainte d'unicité stricte anti-replay.
   */
  async handlePspWebhook(
    provider: string,
    signatureHeader: string | undefined,
    rawPayload: string,
  ): Promise<WebhookResult> {
    const normalizedProvider = provider.toLowerCase();

    // 1. Récupération du secret de signature configuré pour ce fournisseur
    let webhookSecret: string | undefined;
    if (normalizedProvider === 'stripe') {
      webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    } else if (normalizedProvider === 'paystack') {
      webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
    } else if (normalizedProvider === 'wave') {
      webhookSecret = process.env.WAVE_WEBHOOK_SECRET;
    } else if (normalizedProvider === 'cinetpay') {
      webhookSecret = process.env.CINETPAY_WEBHOOK_SECRET;
    } else {
      throw new BadRequestException(`Fournisseur de paiement '${provider}' non supporté.`);
    }

    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        `La passerelle webhook pour '${provider}' n'est pas encore configurée (secret manquant).`,
      );
    }

    if (!signatureHeader) {
      throw new UnauthorizedException('En-tête de signature manquant.');
    }

    // 2. Vérification cryptographique de la signature HMAC-SHA256 selon les standards officiels
    let payloadToSign = rawPayload;
    let providedSig = signatureHeader.trim();

    // Pour Stripe : la signature est au format "t=...,v1=..."
    if (normalizedProvider === 'stripe' && signatureHeader.includes('v1=')) {
      const match = /v1=([a-f0-9]+)/.exec(signatureHeader);
      if (match) providedSig = match[1];
    }

    // Pour Wave (Documentation officielle Wave Checkout API) :
    // Format "t=<timestamp>,v1=<signature>" calculé sur "${timestamp}${rawPayload}"
    if (normalizedProvider === 'wave' && signatureHeader.includes('v1=')) {
      const tMatch = /t=([0-9]+)/.exec(signatureHeader);
      const v1Match = /v1=([a-f0-9]+)/.exec(signatureHeader);
      if (tMatch && v1Match) {
        payloadToSign = `${tMatch[1]}${rawPayload}`;
        providedSig = v1Match[1];
      }
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadToSign, 'utf8')
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    let providedBuffer: Buffer;
    try {
      providedBuffer = Buffer.from(providedSig, 'hex');
    } catch {
      throw new UnauthorizedException('Format de signature de webhook invalide.');
    }

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Signature cryptographique de webhook invalide.');
    }

    // 3. Analyse du payload
    let parsed: any;
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
      throw new BadRequestException('Corps de notification JSON invalide.');
    }

    const eventId = String(
      parsed.id ?? parsed.event_id ?? parsed.cpm_trans_id ?? parsed.transaction_id ?? '',
    );
    if (!eventId) {
      throw new BadRequestException("Identifiant d'événement absent du payload.");
    }

    // 4. Contrôle d'idempotence persistant dans PostgreSQL (Anti-Replay multi-instances et après redémarrage)
    const existingEvent = await this.platformPrisma.client.pspWebhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: normalizedProvider,
          eventId,
        },
      },
    });

    if (existingEvent) {
      return {
        status: 'ignored',
        event: String(parsed.type ?? parsed.event ?? 'unknown'),
        reason: 'duplicate_notification',
      };
    }

    // 5. Enregistrement transactionnel de l'événement avec absorption des courses concurrentes (P2002)
    let eventRecord: any;
    try {
      eventRecord = await this.platformPrisma.client.pspWebhookEvent.create({
        data: {
          id: newTransactionalId(),
          provider: normalizedProvider,
          eventId,
          signatureVerified: true,
          status: 'PENDING',
          payload: parsed,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return {
          status: 'ignored',
          event: String(parsed.type ?? parsed.event ?? 'unknown'),
          reason: 'duplicate_notification',
        };
      }
      throw err;
    }

    // 6. Traitement métier selon l'événement
    let eventType = String(parsed.type ?? parsed.event ?? '');
    if (normalizedProvider === 'cinetpay') {
      eventType = String(parsed.cpm_trans_status ?? parsed.status ?? eventType);
    }
    let resultInvoiceId: string | undefined;

    try {
      if (
        eventType === 'invoice.payment_succeeded' ||
        eventType === 'charge.success' ||
        eventType === 'payment_intent.succeeded' ||
        eventType === 'checkout.session.completed' ||
        eventType === 'ACCEPTED' ||
        eventType === 'payment.success'
      ) {
        const invoiceId =
          parsed.data?.object?.metadata?.invoiceId ??
          parsed.data?.metadata?.invoiceId ??
          parsed.data?.client_reference ??
          parsed.metadata?.invoiceId ??
          parsed.cpm_custom;
        if (invoiceId) {
          await this.subscriptions.recordInvoicePayment(invoiceId, {
            paymentMethod: `${normalizedProvider.toUpperCase()}_ONLINE`,
            paymentReference: eventId,
            notes: `Règlement automatisé reçu via webhook ${provider}`,
          });
          resultInvoiceId = invoiceId;
        }
      }

      // Marquer comme traité avec succès
      await this.platformPrisma.client.pspWebhookEvent.update({
        where: { id: eventRecord.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          result: { invoiceId: resultInvoiceId },
        },
      });
    } catch (err) {
      // Consigner l'erreur dans le registre persistant pour audit et rejeu contrôlé
      await this.platformPrisma.client.pspWebhookEvent.update({
        where: { id: eventRecord.id },
        data: {
          status: 'FAILED',
          lastError: err instanceof Error ? err.message : String(err),
          attempts: { increment: 1 },
        },
      });
      throw err;
    }

    return {
      status: 'processed',
      event: eventType,
      invoiceId: resultInvoiceId,
    };
  }
}

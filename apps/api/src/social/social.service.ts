import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId, newTransactionalId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { SocialComplianceService } from './social-compliance.service.js';
import type { ISocialPlatformAdapter, SocialPlatform } from './social.interface.js';
import { MetaGraphAdapter } from './adapters/meta-graph.adapter.js';
import { WhatsAppCloudAdapter } from './adapters/whatsapp-cloud.adapter.js';
import { TikTokBusinessAdapter } from './adapters/tiktok-business.adapter.js';

@Injectable()
export class SocialService {
  private readonly adapters = new Map<SocialPlatform, ISocialPlatformAdapter>();

  constructor(
    private readonly db: PrismaTenantService,
    private readonly compliance: SocialComplianceService,
  ) {
    this.adapters.set('FACEBOOK', new MetaGraphAdapter('FACEBOOK'));
    this.adapters.set('INSTAGRAM', new MetaGraphAdapter('INSTAGRAM'));
    this.adapters.set('WHATSAPP', new WhatsAppCloudAdapter());
    this.adapters.set('TIKTOK', new TikTokBusinessAdapter());
  }

  getAdapter(platform: SocialPlatform): ISocialPlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) throw new BadRequestException(`Plateforme sociale non supportée : ${platform}`);
    return adapter;
  }

  async listAccounts(tenantId: string) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.socialAccount.findMany({
        where: { tenantId },
        orderBy: { platform: 'asc' },
      });

      const platforms: SocialPlatform[] = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP'];
      const byPlatform = new Map(existing.map((a) => [a.platform as SocialPlatform, a]));

      return platforms.map((p) => {
        const found = byPlatform.get(p);
        const adapter = this.getAdapter(p);
        return {
          platform: p,
          status: found?.status ?? 'NOT_CONFIGURED',
          accountName: found?.accountName ?? null,
          externalId: found?.externalId ?? null,
          id: found?.id ?? null,
          updatedAt: found?.updatedAt ?? null,
          metadata: found?.metadata ?? null,
          hasToken: !!found?.encryptedToken,
          capabilities: adapter.getCapabilities(),
        };
      });
    });
  }

  async configureAccount(
    tenantId: string,
    platform: SocialPlatform,
    payload: {
      accountName: string;
      externalId?: string;
      accessToken: string;
      refreshToken?: string;
      metadata?: Record<string, any>;
    },
  ) {
    if (!payload.accessToken?.trim()) {
      throw new BadRequestException("Le jeton d'accès (Access Token) est obligatoire.");
    }

    const externalId = (
      payload.externalId?.trim() ||
      payload.metadata?.phoneNumberId ||
      payload.metadata?.pageId ||
      payload.metadata?.instagramBusinessId ||
      payload.metadata?.businessId ||
      `${platform.toLowerCase()}_default`
    ).trim();

    const accountName = payload.accountName?.trim() || `${platform} Pro Account`;

    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.socialAccount.findFirst({
        where: { tenantId, platform },
      });

      if (existing) {
        return tx.socialAccount.update({
          where: { id: existing.id },
          data: {
            externalId,
            accountName,
            encryptedToken: payload.accessToken.trim(),
            metadata: payload.metadata ?? {},
            status: 'CONNECTED',
          },
        });
      }

      return tx.socialAccount.create({
        data: {
          id: newId(),
          tenantId,
          platform,
          externalId,
          accountName,
          encryptedToken: payload.accessToken.trim(),
          metadata: payload.metadata ?? {},
          status: 'CONNECTED',
        },
      });
    });
  }

  async connectAccount(
    tenantId: string,
    platform: SocialPlatform,
    payload: {
      accountExternalId: string;
      accountName: string;
      accessToken: string;
      refreshToken?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.configureAccount(tenantId, platform, {
      accountName: payload.accountName,
      externalId: payload.accountExternalId,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      metadata: payload.metadata,
    });
  }

  async disconnectAccount(tenantId: string, accountId: string) {
    return this.db.run(tenantId, async (tx) => {
      const account = await tx.socialAccount.findFirst({
        where: { id: accountId, tenantId },
      });
      if (!account) throw new NotFoundException('Compte social introuvable');

      await tx.socialAccount.update({
        where: { id: accountId },
        data: { status: 'DISCONNECTED', encryptedToken: null },
      });

      return { success: true };
    });
  }

  async testConnection(
    tenantId: string,
    platform: SocialPlatform,
    payload: {
      accessToken: string;
      externalId?: string;
      metadata?: Record<string, any>;
    },
  ) {
    const adapter = this.getAdapter(platform);
    if (!adapter.testConnection) {
      return { success: true, accountName: 'Connexion opérationnelle' };
    }
    return adapter.testConnection({
      accessToken: payload.accessToken,
      externalId: payload.externalId,
      metadata: payload.metadata,
    });
  }

  async getWebhookConfig(tenantId: string, platform: SocialPlatform) {
    const account = await this.db.run(tenantId, async (tx) =>
      tx.socialAccount.findFirst({ where: { tenantId, platform } }),
    );

    const baseUrl = process.env.API_PUBLIC_URL || 'http://localhost:4000';
    const callbackUrl = `${baseUrl}/social/webhooks/${platform.toLowerCase()}?tenantId=${tenantId}`;
    const meta = (account?.metadata as any) || {};
    const verifyToken = meta.webhookVerifyToken || `gestionnaire_${tenantId.slice(0, 8)}_verify`;

    let requiredEvents: string[] = [];
    let instructions: string = '';

    if (platform === 'WHATSAPP') {
      requiredEvents = ['messages', 'message_template_status_update'];
      instructions =
        "Rendez-vous sur Meta for Developers > WhatsApp > Configuration. Collez l'URL de rappel et le jeton de vérification ci-dessous, puis abonnez-vous au champ 'messages'.";
    } else if (platform === 'FACEBOOK') {
      requiredEvents = ['messages', 'messaging_postbacks', 'feed'];
      instructions =
        "Sur Meta Developers > Messagerie Facebook / Webhooks > Page, collez l'URL et abonnez-vous à 'messages' et 'feed' pour les commentaires.";
    } else if (platform === 'INSTAGRAM') {
      requiredEvents = ['messages', 'messaging_postbacks', 'comments'];
      instructions =
        "Sur Meta Developers > Webhooks Instagram, abonnez-vous aux champs 'messages' et 'comments' pour synchroniser messages directs et commentaires.";
    } else if (platform === 'TIKTOK') {
      requiredEvents = ['business.message.receive', 'business.comment.receive'];
      instructions =
        "Sur TikTok for Business Developer Portal > Webhooks, renseignez l'URL de rappel et activez les événements de réception de messages et commentaires.";
    }

    return {
      platform,
      callbackUrl,
      verifyToken,
      requiredEvents,
      instructions,
    };
  }

  async simulateInboundMessageOrComment(
    tenantId: string,
    payload: {
      platform: SocialPlatform;
      type: 'DIRECT_MESSAGE' | 'COMMENT';
      contactName: string;
      contactIdentifier: string;
      content: string;
      postTitle?: string;
    },
  ) {
    return this.db.run(tenantId, async (tx) => {
      let account = await tx.socialAccount.findFirst({
        where: { tenantId, platform: payload.platform },
      });

      if (!account) {
        account = await tx.socialAccount.create({
          data: {
            id: newId(),
            tenantId,
            platform: payload.platform,
            externalId: `sim_${payload.platform.toLowerCase()}`,
            accountName: `${payload.platform} Démo Commerce`,
            status: 'CONNECTED',
            encryptedToken: `mock_${Date.now()}`,
          },
        });
      }

      const externalThreadId =
        payload.type === 'COMMENT'
          ? `comment_thread_${Date.now()}`
          : `dm_thread_${payload.contactIdentifier.replace(/[^a-zA-Z0-9_]/g, '')}`;

      const conversation = await tx.socialConversation.upsert({
        where: {
          tenantId_accountId_externalThreadId: {
            tenantId,
            accountId: account.id,
            externalThreadId,
          },
        },
        create: {
          id: newId(),
          tenantId,
          accountId: account.id,
          platform: payload.platform,
          externalThreadId,
          contactName: payload.contactName,
          contactIdentifier: payload.contactIdentifier,
          unreadCount: 1,
          lastMessageAt: new Date(),
          internalNotes:
            payload.type === 'COMMENT'
              ? `Commentaire public sur : "${payload.postTitle || 'Publication récente'}"`
              : null,
        },
        update: {
          contactName: payload.contactName,
          contactIdentifier: payload.contactIdentifier,
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
        },
      });

      const message = await tx.socialMessage.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          conversationId: conversation.id,
          direction: 'INBOUND',
          senderId: payload.contactIdentifier,
          senderName: payload.contactName,
          content: payload.content,
          deliveryStatus: 'DELIVERED',
          attachments: {
            messageType: payload.type,
            postTitle: payload.postTitle ?? null,
            commentId: payload.type === 'COMMENT' ? `comment_${Date.now()}` : null,
          },
        },
      });

      return { conversation, message };
    });
  }

  async emergencyKillSwitch(tenantId: string) {
    return this.db.run(tenantId, async (tx) => {
      await tx.socialAccount.updateMany({
        where: { tenantId },
        data: { status: 'DISCONNECTED' },
      });
      return { success: true, message: 'Toutes les intégrations sociales ont été déconnectées en urgence.' };
    });
  }

  async listConversations(
    tenantId: string,
    filter?: {
      platform?: SocialPlatform;
      unreadOnly?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.db.run(tenantId, async (tx) => {
      const where: Prisma.SocialConversationWhereInput = { tenantId };

      if (filter?.platform) {
        where.platform = filter.platform;
      }
      if (filter?.unreadOnly) {
        where.unreadCount = { gt: 0 };
      }
      if (filter?.search) {
        where.OR = [
          { contactName: { contains: filter.search, mode: 'insensitive' } },
          { contactIdentifier: { contains: filter.search, mode: 'insensitive' } },
        ];
      }

      const limit = Math.min(20, Math.max(1, filter?.limit ?? 20)); // Règle max 20 éléments (Section 3)
      const page = Math.max(1, filter?.page ?? 1);
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        tx.socialConversation.findMany({
          where,
          include: { account: { select: { accountName: true, platform: true } } },
          orderBy: { lastMessageAt: 'desc' },
          skip,
          take: limit,
        }),
        tx.socialConversation.count({ where }),
      ]);

      const customerIds = items.map((i) => i.customerId).filter(Boolean) as string[];
      const customers = customerIds.length > 0
        ? await tx.customer.findMany({ where: { tenantId, id: { in: customerIds } }, select: { id: true, name: true, phone: true } })
        : [];
      const customerMap = new Map(customers.map((c) => [c.id, c]));

      const populatedItems = items.map((conv) => ({
        ...conv,
        customer: conv.customerId ? customerMap.get(conv.customerId) ?? null : null,
      }));

      return {
        items: populatedItems,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }

  async getConversation(tenantId: string, conversationId: string) {
    return this.db.run(tenantId, async (tx) => {
      const conv = await tx.socialConversation.findFirst({
        where: { id: conversationId, tenantId },
        include: {
          account: true,
          messages: {
            orderBy: { sentAt: 'asc' },
          },
        },
      });
      if (!conv) throw new NotFoundException('Conversation introuvable');

      let customer: any = null;
      if (conv.customerId) {
        customer = await tx.customer.findUnique({
          where: { id: conv.customerId },
          select: { id: true, name: true, phone: true, email: true },
        });
      }

      if (conv.unreadCount > 0) {
        await tx.socialConversation.update({
          where: { id: conversationId },
          data: { unreadCount: 0 },
        });
      }

      return {
        ...conv,
        customer,
      };
    });
  }

  async sendMessage(
    tenantId: string,
    actorUserId: string,
    conversationId: string,
    content: string,
    isInternalNote: boolean = false,
  ) {
    const trimmed = content.trim();
    if (!trimmed) throw new BadRequestException('Le contenu du message ne peut pas être vide');

    return this.db.run(tenantId, async (tx) => {
      const conv = await tx.socialConversation.findFirst({
        where: { id: conversationId, tenantId },
      });
      if (!conv) throw new NotFoundException('Conversation introuvable');

      if (isInternalNote) {
        // Note interne d'équipe, non envoyée au client (Section 11.7)
        return tx.socialMessage.create({
          data: {
            id: newTransactionalId(),
            tenantId,
            conversationId,
            direction: 'INTERNAL_NOTE',
            senderId: actorUserId,
            senderName: 'Équipe Interne',
            content: trimmed,
            deliveryStatus: 'SENT',
          },
        });
      }

      const recipientId = conv.contactIdentifier || conv.externalThreadId;

      // Message client : conformité stricte avant envoi
      const isDebtReminder = /dette|créance|impayé|facture.*échue|solde.*dû|recouvrement|relance.*paiement/i.test(trimmed);
      await this.compliance.validateOutboundMessageOrThrow(
        tenantId,
        conv.platform as SocialPlatform,
        recipientId,
        conv.lastMessageAt,
        isDebtReminder,
      );

      const account = await tx.socialAccount.findFirst({
        where: { tenantId, platform: conv.platform, status: 'CONNECTED' },
      });
      if (!account || !account.encryptedToken) {
        throw new BadRequestException(
          `Compte ${conv.platform} non connecté ou autorisation expirée. Impossible d'envoyer le message.`,
        );
      }

      const lastInboundMsg = await tx.socialMessage.findFirst({
        where: { conversationId, direction: 'INBOUND' },
        orderBy: { sentAt: 'desc' },
      });
      const attachments = (lastInboundMsg?.attachments as any) || {};
      const isComment = attachments.messageType === 'COMMENT' || !!attachments.commentId;

      const adapter = this.getAdapter(conv.platform as SocialPlatform);
      const sendResult = await adapter.sendMessage(
        account.encryptedToken,
        {
          platform: conv.platform as SocialPlatform,
          recipientId,
          text: trimmed,
          isCommentReply: isComment,
          commentId: attachments.commentId,
        },
        account.metadata,
      );

      if (!sendResult.success) {
        throw new BadRequestException(`Échec envoi ${conv.platform} : ${sendResult.error}`);
      }

      const message = await tx.socialMessage.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          conversationId,
          direction: 'OUTBOUND',
          senderId: actorUserId,
          senderName: account.accountName,
          content: trimmed,
          deliveryStatus: 'SENT',
          externalMsgId: sendResult.platformMessageId ?? null,
          attachments: {
            replyToType: isComment ? 'COMMENT' : 'DIRECT_MESSAGE',
            commentId: attachments.commentId ?? null,
          },
        },
      });

      await tx.socialConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'social.message.sent',
          payload: {
            conversationId,
            messageId: message.id,
            platform: conv.platform,
            actorUserId,
          },
        },
      });

      return message;
    });
  }

  async linkCustomer(tenantId: string, conversationId: string, customerId: string) {
    return this.db.run(tenantId, async (tx) => {
      const [conv, customer] = await Promise.all([
        tx.socialConversation.findFirst({ where: { id: conversationId, tenantId } }),
        tx.customer.findFirst({ where: { id: customerId, tenantId, deletedAt: null } }),
      ]);

      if (!conv) throw new NotFoundException('Conversation introuvable');
      if (!customer) throw new NotFoundException('Client introuvable');

      const updated = await tx.socialConversation.update({
        where: { id: conversationId },
        data: { customerId },
      });

      return {
        ...updated,
        customer,
      };
    });
  }

  async handleWebhookChallenge(platform: string, query: Record<string, any>) {
    const mode = query['hub.mode'];
    const challenge = query['hub.challenge'];
    if (mode === 'subscribe' && challenge) {
      return challenge;
    }
    if (query['challenge']) {
      return query['challenge'];
    }
    return 'OK';
  }

  async handleWebhookPayload(
    platform: string,
    body: any,
    headers?: Record<string, any>,
    query?: Record<string, any>,
  ) {
    return { status: 'EVENT_RECEIVED', platform, timestamp: new Date().toISOString() };
  }
}

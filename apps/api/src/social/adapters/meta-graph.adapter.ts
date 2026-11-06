import crypto from 'node:crypto';
import type {
  ISocialPlatformAdapter,
  PlatformCapabilities,
  SendMessagePayload,
  SendMessageResult,
  SocialPlatform,
} from '../social.interface.js';

export class MetaGraphAdapter implements ISocialPlatformAdapter {
  constructor(public readonly platform: 'FACEBOOK' | 'INSTAGRAM') {}

  getCapabilities(): PlatformCapabilities {
    return {
      canReceiveDirectMessages: true,
      canSendDirectMessages: true,
      canReadComments: true,
      canReplyComments: true,
      requiresApprovedTemplates: false,
      messagingWindowHours: 24,
    };
  }

  async getAuthUrl(tenantId: string, state: string, redirectUri: string): Promise<string> {
    const appId = process.env.META_APP_ID || 'DEMO_META_APP_ID';
    const scopes =
      this.platform === 'FACEBOOK'
        ? 'pages_messaging,pages_read_engagement,pages_manage_metadata'
        : 'instagram_basic,instagram_manage_messages,instagram_manage_comments';

    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}&response_type=code`;
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    accountExternalId: string;
    accountName: string;
  }> {
    // Dans un environnement sans identifiants Meta configurés (mode démo / onboarding),
    // simule un flux préparé sans prétendre qu'un compte réel est connecté si les identifiants manquent.
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return {
        accessToken: `mock_meta_token_${Date.now()}`,
        expiresIn: 5184000,
        accountExternalId: `act_${this.platform.toLowerCase()}_demo`,
        accountName: `Page Pro Démo (${this.platform})`,
      };
    }

    const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&code=${code}`;

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Échec d'échange de code Meta : ${err}`);
    }
    const data = (await res.json()) as any;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      accountExternalId: data.page_id || 'meta_account',
      accountName: data.page_name || 'Compte Meta Pro',
    };
  }

  async sendMessage(
    accessToken: string,
    payload: SendMessagePayload,
    metadata?: any,
  ): Promise<SendMessageResult> {
    // Si pas de jeton Meta en production ou mode test local :
    if (accessToken.startsWith('mock_') || accessToken.startsWith('test_')) {
      return {
        success: true,
        messageId: `msg_${Date.now()}`,
        platformMessageId: `mid.meta.${Date.now()}`,
      };
    }

    try {
      if (payload.isCommentReply && payload.commentId) {
        // Réponse officielle à un commentaire public sur publication Facebook / Instagram
        const commentUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
          payload.commentId,
        )}/comments?access_token=${encodeURIComponent(accessToken)}`;

        const res = await fetch(commentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: payload.text }),
        });

        const resData = (await res.json()) as any;
        if (!res.ok) {
          return {
            success: false,
            messageId: `err_${Date.now()}`,
            error: resData?.error?.message ?? 'Échec de la réponse au commentaire Meta',
            errorCode: resData?.error?.code?.toString(),
          };
        }

        return {
          success: true,
          messageId: resData.id || `comment_reply_${Date.now()}`,
          platformMessageId: resData.id,
        };
      }

      // Message direct (Direct Message / Messenger)
      const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(
        accessToken,
      )}`;

      const body = {
        recipient: { id: payload.recipientId },
        message: { text: payload.text },
        messaging_type: 'RESPONSE',
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const resData = (await res.json()) as any;
      if (!res.ok) {
        return {
          success: false,
          messageId: `err_${Date.now()}`,
          error: resData?.error?.message ?? 'Erreur envoi Meta',
          errorCode: resData?.error?.code?.toString(),
        };
      }

      return {
        success: true,
        messageId: resData.message_id || `msg_${Date.now()}`,
        platformMessageId: resData.message_id,
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: `err_${Date.now()}`,
        error: err.message,
      };
    }
  }

  async testConnection(credentials: {
    accessToken: string;
    externalId?: string;
    metadata?: any;
  }): Promise<{ success: boolean; accountName?: string; externalId?: string; error?: string }> {
    const { accessToken, metadata, externalId } = credentials;

    if (!accessToken) {
      return { success: false, error: "Jeton d'accès (Page Access Token) manquant" };
    }

    if (accessToken.startsWith('mock_') || accessToken.startsWith('test_') || accessToken.startsWith('demo_')) {
      return {
        success: true,
        accountName: metadata?.accountName || (this.platform === 'FACEBOOK' ? 'Page Facebook Pro (Test)' : '@instagram_pro (Test)'),
        externalId: externalId || 'demo_meta_external_id',
      };
    }

    try {
      if (this.platform === 'FACEBOOK') {
        const url = `https://graph.facebook.com/v21.0/me?fields=id,name,link&access_token=${encodeURIComponent(
          accessToken,
        )}`;
        const res = await fetch(url);
        const data = (await res.json()) as any;
        if (!res.ok) {
          return {
            success: false,
            error: data?.error?.message || 'Jeton de Page Facebook invalide ou expiré',
          };
        }
        return {
          success: true,
          accountName: data.name || 'Page Facebook Vérifiée',
          externalId: data.id,
        };
      } else {
        // INSTAGRAM
        const igId = metadata?.instagramBusinessId || externalId;
        const target = igId ? encodeURIComponent(igId) : 'me';
        const url = `https://graph.facebook.com/v21.0/${target}?fields=id,username,name&access_token=${encodeURIComponent(
          accessToken,
        )}`;
        const res = await fetch(url);
        const data = (await res.json()) as any;
        if (!res.ok) {
          return {
            success: false,
            error: data?.error?.message || 'Identifiants Instagram Business invalides',
          };
        }
        return {
          success: true,
          accountName: data.username ? `@${data.username}` : data.name || 'Compte Instagram Pro Vérifié',
          externalId: data.id,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Impossible de contacter Meta Graph API : ${err.message}`,
      };
    }
  }

  verifyWebhookSignature(signature: string, rawBody: string, secret: string): boolean {
    if (!signature || !secret) return false;
    const parts = signature.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') return false;

    const expectedHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(parts[1], 'hex'), Buffer.from(expectedHash, 'hex'));
  }
}

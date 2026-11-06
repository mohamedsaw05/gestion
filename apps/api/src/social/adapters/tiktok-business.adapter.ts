import crypto from 'node:crypto';
import type {
  ISocialPlatformAdapter,
  PlatformCapabilities,
  SendMessagePayload,
  SendMessageResult,
} from '../social.interface.js';

export class TikTokBusinessAdapter implements ISocialPlatformAdapter {
  public readonly platform = 'TIKTOK';

  getCapabilities(): PlatformCapabilities {
    return {
      canReceiveDirectMessages: true,
      canSendDirectMessages: true,
      canReadComments: true,
      canReplyComments: true,
      requiresApprovedTemplates: false,
      messagingWindowHours: 48,
    };
  }

  async getAuthUrl(tenantId: string, state: string, redirectUri: string): Promise<string> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY || 'DEMO_TIKTOK_KEY';
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=user.info.basic,video.list,comment.list,comment.list.manage,business.message.send&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${encodeURIComponent(state)}`;
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
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      return {
        accessToken: `mock_tiktok_token_${Date.now()}`,
        expiresIn: 86400,
        accountExternalId: 'tt_account_demo',
        accountName: 'Compte TikTok Entreprise Démo',
      };
    }

    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const data = (await res.json()) as any;
    if (!res.ok || data.error_code) {
      throw new Error(`Échec d'échange de code TikTok : ${data.message || 'Erreur OAuth'}`);
    }

    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresIn: data.data.expires_in,
      accountExternalId: data.data.open_id || 'tiktok_account',
      accountName: 'Compte TikTok Business',
    };
  }

  async sendMessage(
    accessToken: string,
    payload: SendMessagePayload,
    metadata?: any,
  ): Promise<SendMessageResult> {
    if (accessToken.startsWith('mock_') || accessToken.startsWith('test_')) {
      return {
        success: true,
        messageId: `ttmsg_${Date.now()}`,
        platformMessageId: `ttmid.${Date.now()}`,
      };
    }

    try {
      if (payload.isCommentReply && payload.commentId) {
        // Réponse officielle à un commentaire TikTok Business
        const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/business/comment/reply/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Token': accessToken,
          },
          body: JSON.stringify({
            comment_id: payload.commentId,
            text: payload.text,
          }),
        });

        const resData = (await res.json()) as any;
        if (!res.ok || resData.code !== 0) {
          return {
            success: false,
            messageId: `err_${Date.now()}`,
            error: resData.message ?? 'Échec de la réponse au commentaire TikTok',
            errorCode: resData.code?.toString(),
          };
        }

        return {
          success: true,
          messageId: resData.data?.comment_id || `ttcomment_${Date.now()}`,
          platformMessageId: resData.data?.comment_id,
        };
      }

      // Message direct (Direct Message)
      const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/business/message/send/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': accessToken,
        },
        body: JSON.stringify({
          recipient_id: payload.recipientId,
          message_type: 'text',
          content: { text: payload.text },
        }),
      });

      const resData = (await res.json()) as any;
      if (!res.ok || resData.code !== 0) {
        return {
          success: false,
          messageId: `err_${Date.now()}`,
          error: resData.message ?? 'Erreur API TikTok',
          errorCode: resData.code?.toString(),
        };
      }

      return {
        success: true,
        messageId: resData.data?.message_id || `ttmsg_${Date.now()}`,
        platformMessageId: resData.data?.message_id,
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
      return { success: false, error: "Jeton d'accès (Access Token) manquant" };
    }

    if (accessToken.startsWith('mock_') || accessToken.startsWith('test_') || accessToken.startsWith('demo_')) {
      return {
        success: true,
        accountName: metadata?.accountName || 'Compte TikTok Business (Mode Test)',
        externalId: externalId || 'demo_tiktok_business_id',
      };
    }

    try {
      const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/business/get/', {
        headers: {
          'Access-Token': accessToken,
        },
      });

      const data = (await res.json()) as any;
      if (!res.ok || data.code !== 0) {
        return {
          success: false,
          error: data?.message || 'Jeton TikTok Business invalide ou expiré',
        };
      }

      return {
        success: true,
        accountName: data.data?.display_name || 'Compte TikTok Business Vérifié',
        externalId: data.data?.business_id || externalId || 'tiktok_business',
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Impossible de contacter TikTok Business API : ${err.message}`,
      };
    }
  }

  verifyWebhookSignature(signature: string, rawBody: string, secret: string): boolean {
    if (!signature || !secret) return false;
    const expectedHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return signature === expectedHash;
  }
}

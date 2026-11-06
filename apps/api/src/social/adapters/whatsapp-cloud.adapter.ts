import crypto from 'node:crypto';
import type {
  ISocialPlatformAdapter,
  PlatformCapabilities,
  SendMessagePayload,
  SendMessageResult,
} from '../social.interface.js';

export class WhatsAppCloudAdapter implements ISocialPlatformAdapter {
  public readonly platform = 'WHATSAPP';

  getCapabilities(): PlatformCapabilities {
    return {
      canReceiveDirectMessages: true,
      canSendDirectMessages: true,
      canReadComments: false,
      canReplyComments: false,
      requiresApprovedTemplates: true,
      messagingWindowHours: 24,
    };
  }

  async getAuthUrl(tenantId: string, state: string, redirectUri: string): Promise<string> {
    const appId = process.env.META_APP_ID || 'DEMO_META_APP_ID';
    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${encodeURIComponent(state)}&scope=whatsapp_business_messaging,whatsapp_business_management&response_type=code`;
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
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return {
        accessToken: `mock_wa_token_${Date.now()}`,
        expiresIn: 5184000,
        accountExternalId: 'wa_phone_demo',
        accountName: 'Numéro WhatsApp Business Démo',
      };
    }

    const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&code=${code}`;

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Échec d'échange de code WhatsApp : ${err}`);
    }
    const data = (await res.json()) as any;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      accountExternalId: data.waba_id || 'waba_account',
      accountName: data.phone_number || 'Numéro WhatsApp Business',
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
        messageId: `wamid_${Date.now()}`,
        platformMessageId: `wamid.HBgL.${Date.now()}`,
      };
    }

    try {
      const phoneNumberId = metadata?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || 'me';
      const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

      let messageBody: any;
      if (payload.isTemplate) {
        messageBody = {
          messaging_product: 'whatsapp',
          to: payload.recipientId,
          type: 'template',
          template: {
            name: payload.templateName,
            language: { code: payload.templateLanguage || 'fr' },
          },
        };
      } else {
        messageBody = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: payload.recipientId,
          type: 'text',
          text: { preview_url: false, body: payload.text },
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(messageBody),
      });

      const resData = (await res.json()) as any;
      if (!res.ok) {
        return {
          success: false,
          messageId: `err_${Date.now()}`,
          error: resData?.error?.message ?? 'Erreur Cloud API WhatsApp',
          errorCode: resData?.error?.code?.toString(),
        };
      }

      const wamid = resData?.messages?.[0]?.id || `wamid_${Date.now()}`;
      return {
        success: true,
        messageId: wamid,
        platformMessageId: wamid,
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
    const phoneNumberId = metadata?.phoneNumberId || externalId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken) {
      return { success: false, error: "Jeton d'accès (Access Token) manquant" };
    }
    if (!phoneNumberId) {
      return { success: false, error: "Identifiant du numéro de téléphone (Phone Number ID) manquant" };
    }

    if (accessToken.startsWith('mock_') || accessToken.startsWith('test_') || accessToken.startsWith('demo_')) {
      return {
        success: true,
        accountName: metadata?.accountName || 'Numéro WhatsApp Business (Mode Test)',
        externalId: phoneNumberId,
      };
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || 'Identifiants WhatsApp Cloud API invalides',
        };
      }

      return {
        success: true,
        accountName: data.verified_name || data.display_phone_number || 'Numéro WhatsApp vérifié',
        externalId: phoneNumberId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Impossible de joindre les serveurs Meta Graph : ${err.message}`,
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

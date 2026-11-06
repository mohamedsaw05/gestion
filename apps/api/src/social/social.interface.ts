export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'WHATSAPP';

export type SocialAccountStatus =
  | 'NOT_CONFIGURED'
  | 'CONFIG_REQUIRED'
  | 'PENDING_AUTH'
  | 'CONNECTED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'RATE_LIMITED'
  | 'ERROR'
  | 'DISCONNECTED';

export interface SendMessagePayload {
  platform: SocialPlatform;
  recipientId: string;
  text: string;
  isTemplate?: boolean;
  templateName?: string;
  templateLanguage?: string;
  isCommentReply?: boolean;
  commentId?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId: string;
  platformMessageId?: string;
  error?: string;
  errorCode?: string;
  retryAfterSeconds?: number;
}

export interface PlatformCapabilities {
  canReceiveDirectMessages: boolean;
  canSendDirectMessages: boolean;
  canReadComments: boolean;
  canReplyComments: boolean;
  requiresApprovedTemplates: boolean;
  messagingWindowHours: number; // 24h pour Meta/Instagram, 0 si illimité avec template
}

export interface ISocialPlatformAdapter {
  platform: SocialPlatform;
  getCapabilities(): PlatformCapabilities;
  getAuthUrl(tenantId: string, state: string, redirectUri: string): Promise<string>;
  exchangeCodeForToken(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number; accountExternalId: string; accountName: string }>;
  sendMessage(accessToken: string, payload: SendMessagePayload, metadata?: any): Promise<SendMessageResult>;
  testConnection?(credentials: { accessToken: string; externalId?: string; metadata?: any }): Promise<{ success: boolean; accountName?: string; externalId?: string; error?: string }>;
  verifyWebhookSignature(signature: string, rawBody: string, secret: string): boolean;
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { SocialService } from './social.service.js';
import { SocialComplianceService } from './social-compliance.service.js';
import type { SocialPlatform } from './social.interface.js';

import { Public } from '../common/decorators/public.decorator.js';

@Controller('social')
@RequireCapability(CAPABILITIES.SOCIAL_INBOX)
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly compliance: SocialComplianceService,
  ) {}

  @Get('accounts')
  @RequirePermission(PERMISSIONS.SOCIAL_READ)
  listAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.social.listAccounts(user.tenantId);
  }

  @Post('accounts/:platform/configure')
  @RequirePermission(PERMISSIONS.SOCIAL_MANAGE)
  configureAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: SocialPlatform,
    @Body()
    body: {
      accountName: string;
      externalId?: string;
      accessToken: string;
      refreshToken?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.social.configureAccount(user.tenantId, platform, body);
  }

  @Post('accounts/:platform/connect')
  @RequirePermission(PERMISSIONS.SOCIAL_MANAGE)
  connectAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: SocialPlatform,
    @Body()
    body: {
      accountExternalId: string;
      accountName: string;
      accessToken: string;
      refreshToken?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.social.connectAccount(user.tenantId, platform, body);
  }

  @Post('accounts/:platform/test')
  @RequirePermission(PERMISSIONS.SOCIAL_MANAGE)
  testConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: SocialPlatform,
    @Body()
    body: {
      accessToken: string;
      externalId?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.social.testConnection(user.tenantId, platform, body);
  }

  @Get('accounts/:platform/webhook-info')
  @RequirePermission(PERMISSIONS.SOCIAL_READ)
  getWebhookInfo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: SocialPlatform,
  ) {
    return this.social.getWebhookConfig(user.tenantId, platform);
  }

  @Post('accounts/:platform/simulate-inbound')
  @RequirePermission(PERMISSIONS.SOCIAL_MANAGE)
  simulateInbound(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: SocialPlatform,
    @Body()
    body: {
      type: 'DIRECT_MESSAGE' | 'COMMENT';
      contactName: string;
      contactIdentifier: string;
      content: string;
      postTitle?: string;
    },
  ) {
    return this.social.simulateInboundMessageOrComment(user.tenantId, {
      ...body,
      platform,
    });
  }

  @Delete('accounts/:id')
  @RequirePermission(PERMISSIONS.SOCIAL_MANAGE)
  disconnectAccount(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.social.disconnectAccount(user.tenantId, id);
  }

  @Post('kill-switch')
  @RequirePermission(PERMISSIONS.SOCIAL_MANAGE)
  emergencyKillSwitch(@CurrentUser() user: AuthenticatedUser) {
    return this.social.emergencyKillSwitch(user.tenantId);
  }

  @Post('oauth/:platform/start')
  @RequirePermission(PERMISSIONS.SOCIAL_MANAGE)
  async startOAuth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: SocialPlatform,
  ) {
    const adapter = this.social.getAdapter(platform);
    const redirectUri = `${process.env.APP_BASE_URL || 'http://localhost:5180'}/social/oauth-callback`;
    const state = `${user.tenantId}:${platform}:${Date.now()}`;
    const redirectUrl = await adapter.getAuthUrl(user.tenantId, state, redirectUri);
    return { redirectUrl };
  }

  @Public()
  @Get('webhooks/:platform')
  webhookChallenge(
    @Param('platform') platform: string,
    @Query() query: Record<string, any>,
  ) {
    return this.social.handleWebhookChallenge(platform, query);
  }

  @Public()
  @Post('webhooks/:platform')
  webhookPayload(
    @Param('platform') platform: string,
    @Body() body: any,
    @Query() query: Record<string, any>,
  ) {
    return this.social.handleWebhookPayload(platform, body, {}, query);
  }

  @Get('conversations')
  @RequirePermission(PERMISSIONS.SOCIAL_READ)
  listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('platform') platform?: SocialPlatform,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
  ) {
    return this.social.listConversations(user.tenantId, {
      platform,
      unreadOnly: unreadOnly === 'true',
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: 20, // Max 20 par page (Section 3)
    });
  }

  @Get('conversations/:id')
  @RequirePermission(PERMISSIONS.SOCIAL_READ)
  getConversation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.social.getConversation(user.tenantId, id);
  }

  @Get('conversations/:id/messages')
  @RequirePermission(PERMISSIONS.SOCIAL_READ)
  async getConversationMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const conv = await this.social.getConversation(user.tenantId, id);
    return conv.messages ?? [];
  }

  @Post('conversations/:id/messages')
  @RequirePermission(PERMISSIONS.SOCIAL_REPLY)
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { content: string; isInternalNote?: boolean },
  ) {
    return this.social.sendMessage(
      user.tenantId,
      user.userId,
      id,
      body.content,
      body.isInternalNote ?? false,
    );
  }

  @Post('conversations/:id/notes')
  @RequirePermission(PERMISSIONS.SOCIAL_REPLY)
  sendInternalNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.social.sendMessage(
      user.tenantId,
      user.userId,
      id,
      content,
      true,
    );
  }

  @Patch('conversations/:id/link-customer')
  @RequirePermission(PERMISSIONS.SOCIAL_REPLY)
  linkCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('customerId') customerId: string,
  ) {
    return this.social.linkCustomer(user.tenantId, id, customerId);
  }

  @Post('conversations/:id/link-customer')
  @RequirePermission(PERMISSIONS.SOCIAL_REPLY)
  linkCustomerPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('customerId') customerId: string,
  ) {
    return this.social.linkCustomer(user.tenantId, id, customerId);
  }

  @Post('consent')
  @RequirePermission(PERMISSIONS.SOCIAL_MANAGE)
  recordConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      platform: SocialPlatform;
      contactId: string;
      optedIn: boolean;
      source: string;
    },
  ) {
    return this.compliance.recordConsent(
      user.tenantId,
      body.platform,
      body.contactId,
      body.optedIn,
      body.source,
    );
  }
}

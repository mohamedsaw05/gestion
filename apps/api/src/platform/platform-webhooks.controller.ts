import {
  Controller,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { PlatformWebhooksService } from './platform-webhooks.service.js';

@Controller('platform')
@Public()
export class PlatformWebhooksController {
  constructor(private readonly webhooksService: PlatformWebhooksService) {}

  @Post('webhooks/psp/:provider')
  async handlePspWebhook(
    @Param('provider') provider: string,
    @Headers('stripe-signature') stripeSig: string | undefined,
    @Headers('x-paystack-signature') paystackSig: string | undefined,
    @Headers('x-webhook-signature') genericSig: string | undefined,
    @Req() req: Request,
  ) {
    const signature = stripeSig || paystackSig || genericSig;
    const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    return this.webhooksService.handlePspWebhook(provider, signature, rawPayload);
  }
}

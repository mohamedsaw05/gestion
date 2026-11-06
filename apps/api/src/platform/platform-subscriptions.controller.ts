import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { PlatformAdminGuard } from './guards/platform-admin.guard.js';
import { PlatformSubscriptionsService } from './platform-subscriptions.service.js';
import { ChangePlanDto } from './dto/change-plan.dto.js';
import { CreateSaasInvoiceDto } from './dto/create-saas-invoice.dto.js';
import { PaySaasInvoiceDto } from './dto/pay-saas-invoice.dto.js';

@Controller('platform')
@Public()
@UseGuards(PlatformAdminGuard)
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptions: PlatformSubscriptionsService) {}

  @Get('plans')
  listPlans() {
    return this.subscriptions.listPlans();
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.subscriptions.listSubscriptions();
  }

  @Post('subscriptions/:tenantId/change-plan')
  changePlan(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Body() dto: ChangePlanDto) {
    return this.subscriptions.changeTenantPlan(tenantId, dto.planKey, dto.durationMonths ?? 3);
  }

  @Get('invoices')
  listInvoices(@Query('tenantId') tenantId?: string) {
    return this.subscriptions.listInvoices(tenantId);
  }

  @Post('subscriptions/:tenantId/invoices')
  createInvoice(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Body() dto: CreateSaasInvoiceDto) {
    return this.subscriptions.createManualInvoice(tenantId, dto);
  }

  @Post('invoices/:id/pay')
  recordPayment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PaySaasInvoiceDto) {
    return this.subscriptions.recordInvoicePayment(id, dto);
  }

  @Post('invoices/:id/void')
  voidInvoice(@Param('id', ParseUUIDPipe) id: string, @Body() body?: { reason?: string }) {
    return this.subscriptions.voidInvoice(id, body?.reason);
  }

  @Post('invoices/:id/refund')
  refundInvoice(@Param('id', ParseUUIDPipe) id: string, @Body() body?: { reason?: string }) {
    return this.subscriptions.refundInvoice(id, body?.reason);
  }
}

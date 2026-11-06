import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { DocumentsService } from './documents.service.js';
import { IssueInvoiceDto } from './dto/issue-invoice.dto.js';
import { IssueQuoteDto } from './dto/issue-quote.dto.js';
import { streamReceiptPdf, streamDeliveryNotePdf, type ReceiptContent, type DeliveryNoteContent } from './receipt-pdf.js';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SALES_READ)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.documents.list(user.tenantId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.SALES_READ)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.getById(user.tenantId, id);
  }

  @Get(':id/pdf')
  @RequirePermission(PERMISSIONS.SALES_READ)
  async getPdf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    const doc = await this.documents.getById(user.tenantId, id);
    if (doc.type === 'DELIVERY_NOTE') {
      streamDeliveryNotePdf(doc.contentSnapshot as unknown as DeliveryNoteContent, res);
    } else {
      streamReceiptPdf(doc.contentSnapshot as unknown as ReceiptContent, res, doc.type);
    }
  }

  @Get('preview/:template')
  @RequirePermission(PERMISSIONS.SALES_READ)
  previewTemplate(@Param('template') template: string, @Res() res: Response) {
    const valid = ['STANDARD_PRO', 'COMPACT', 'DETAILED', 'ELEGANT', 'SERVICES'];
    const chosen = valid.includes(template.toUpperCase()) ? (template.toUpperCase() as any) : 'STANDARD_PRO';
    const sample = this.documents.getSampleReceiptContent(chosen);
    streamReceiptPdf(sample as unknown as ReceiptContent, res, 'INVOICE', chosen);
  }

  // ── Émission à la demande (Phase 14, capability "invoicing") ──

  @Post('invoices')
  @RequireCapability(CAPABILITIES.INVOICING)
  @RequirePermission(PERMISSIONS.DOCUMENTS_ISSUE)
  issueInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueInvoiceDto) {
    return this.documents.createInvoiceForSale(user.tenantId, user.userId, dto.saleId);
  }

  @Post('quotes')
  @RequireCapability(CAPABILITIES.INVOICING)
  @RequirePermission(PERMISSIONS.DOCUMENTS_ISSUE)
  issueQuote(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueQuoteDto) {
    return this.documents.createQuoteForOrder(user.tenantId, user.userId, dto.orderId);
  }
}

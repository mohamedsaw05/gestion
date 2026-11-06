import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';
import type { CreateSaasInvoiceDto } from './dto/create-saas-invoice.dto.js';
import type { PaySaasInvoiceDto } from './dto/pay-saas-invoice.dto.js';
import { CommercialSettingsService } from './commercial-settings.service.js';
import { addCalendarMonths } from './commercial-settings.service.js';

@Injectable()
export class PlatformSubscriptionsService {
  constructor(private readonly platform: PlatformPrismaService, private readonly commercial: CommercialSettingsService) {}

  async listPlans() {
    return this.platform.client.platformPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async listSubscriptions() {
    return this.platform.client.platformSubscription.findMany({
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async changeTenantPlan(tenantId: string, planKey: string, durationMonths = 3) {
    const plan = await this.platform.client.platformPlan.findUnique({
      where: { key: planKey },
    });
    if (!plan || !plan.isActive) {
      throw new BadRequestException(`Plan ${planKey} introuvable ou inactif`);
    }

    const sub = await this.platform.client.platformSubscription.findUnique({
      where: { tenantId },
    });
    if (!sub) {
      throw new NotFoundException(`Abonnement introuvable pour ce tenant`);
    }

    const now = new Date();
    const periodEnd = addCalendarMonths(now, durationMonths);

    const updated = await this.platform.client.platformSubscription.update({
      where: { tenantId },
      data: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });

    // Generate invoice if not free
    const invoice = Number(plan.priceMonthly) > 0
      ? await this.commercial.createCommercialInvoice(tenantId, durationMonths, now)
      : null;

    return {
      subscription: updated,
      invoice,
    };
  }

  async listInvoices(tenantId?: string) {
    return this.platform.client.platformInvoice.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createManualInvoice(tenantId: string, dto: CreateSaasInvoiceDto) {
    const invoice = await this.commercial.createCommercialInvoice(tenantId, dto.durationMonths);
    return this.platform.client.platformInvoice.update({
      where: { id: invoice.id },
      data: {
        paymentMethod: dto.paymentMethod ?? 'MANUAL_TRANSFER',
        notes: dto.notes ? `${invoice.notes ?? ''} — ${dto.notes}` : invoice.notes,
      },
    });
  }

  async recordInvoicePayment(invoiceId: string, dto: PaySaasInvoiceDto) {
    const invoice = await this.platform.client.platformInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Cette facture est déjà réglée');
    }
    if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
      throw new BadRequestException('Une facture annulée ne peut pas être réglée');
    }
    if (dto.paymentMethod === 'MANUAL_TRANSFER' && (!dto.paymentReference || !dto.paymentReference.trim())) {
      throw new BadRequestException('La référence de virement ou de transaction est obligatoire pour un règlement manuel');
    }

    const now = new Date();
    const updatedInvoice = await this.platform.client.$transaction(async (db) => {
      const paid = await db.platformInvoice.updateMany({
        where: { id: invoiceId, status: 'PENDING' },
        data: { status: 'PAID', paidAt: now, paymentMethod: dto.paymentMethod, paymentReference: dto.paymentReference, notes: dto.notes ?? invoice.notes },
      });
      if (paid.count !== 1) throw new BadRequestException('La facture a déjà été réglée ou n’est plus payable.');
      const sub = await db.platformSubscription.findUnique({ where: { tenantId: invoice.tenantId } });
      if (sub) {
        const periodIsLater = invoice.periodEnd > sub.currentPeriodEnd;
        await db.platformSubscription.update({ where: { id: sub.id }, data: {
          status: 'ACTIVE', suspendedAt: null,
          ...(periodIsLater ? { currentPeriodStart: invoice.periodStart, currentPeriodEnd: invoice.periodEnd } : {}),
        } });
      }
      await db.tenant.update({ where: { id: invoice.tenantId }, data: { status: 'ACTIVE' } });
      return db.platformInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    });

    return {
      message: 'Paiement enregistré et réconciliation effectuée',
      invoice: updatedInvoice,
    };
  }

  async voidInvoice(invoiceId: string, reason?: string) {
    const invoice = await this.platform.client.platformInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Une facture déjà réglée ne peut pas être annulée. Effectuez un remboursement.');
    }
    if (invoice.status === 'VOID') {
      throw new BadRequestException('Cette facture est déjà annulée');
    }

    const updated = await this.platform.client.platformInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'VOID',
        notes: reason ? `${invoice.notes ?? ''} [ANNULÉE : ${reason}]`.trim() : `${invoice.notes ?? ''} [ANNULÉE]`.trim(),
      },
    });

    return {
      message: 'Facture annulée avec succès',
      invoice: updated,
    };
  }

  async refundInvoice(invoiceId: string, reason?: string) {
    const invoice = await this.platform.client.platformInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    if (invoice.status !== 'PAID') {
      throw new BadRequestException('Seule une facture payée peut être remboursée');
    }

    const updated = await this.platform.client.platformInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'REFUNDED',
        notes: reason ? `${invoice.notes ?? ''} [REMBOURSÉE : ${reason}]`.trim() : `${invoice.notes ?? ''} [REMBOURSÉE]`.trim(),
      },
    });

    return {
      message: 'Remboursement enregistré avec succès',
      invoice: updated,
    };
  }
}


import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId, newTransactionalId, SETTINGS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { ConfigurationService } from '../config/config.service.js';

export interface ReceiptSnapshotInput {
  sale: {
    id: string;
    locationId: string;
    customerId: string | null;
    currency: string;
    subtotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
    amountPaid: Prisma.Decimal;
    balanceDue: Prisma.Decimal;
  };
  lines: {
    productNameSnapshot: string;
    unitSnapshot: string;
    quantity: Prisma.Decimal;
    unitPriceSnapshot: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }[];
  payments: { method: string; amount: Prisma.Decimal; reference?: string | null; verificationStatus?: string }[];
  tenderedAmount?: string | null;
  changeGiven?: string | null;
}

interface LineDocumentContent {
  documentType: string;
  template?: string;
  number: string;
  issuedAt: string;
  saleId?: string;
  orderId?: string;
  returnId?: string;
  tenderedAmount?: string | null;
  changeGiven?: string | null;
  locationId: string;
  customerId: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  showCustomerInfo?: boolean;
  currency: string;
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  lines: { product: string; unit: string; quantity: string; unitPrice: string; lineTotal: string }[];
  payments: { method: string; amount: string; reference?: string | null; verificationStatus?: string }[];
  footerText: string | null;
  headerText?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logoDataUri?: string | null;
}

/**
 * Document Engine (Phase 3 : RECEIPT seul ; Phase 14 : INVOICE/QUOTE/
 * CREDIT_NOTE/DELIVERY_NOTE). RECEIPT/CREDIT_NOTE sont générés
 * AUTOMATIQUEMENT (à la vente, au retour remboursé) — jamais une action
 * utilisateur distincte, comme depuis la Phase 3. INVOICE/QUOTE sont émis À
 * LA DEMANDE (capability "invoicing"), DELIVERY_NOTE automatique à la
 * livraison (cf DeliveriesService, capability "delivery"). 5 vrais modèles
 * documentaires distincts (STANDARD_PRO, COMPACT, DETAILED, ELEGANT, SERVICES).
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly config: ConfigurationService,
  ) {}

  private async getBrandingWithTx(tx: Prisma.TransactionClient, tenantId: string, locationId: string) {
    const [footerText, headerText, logoDataUri, legalName, taxId, phone, email, address, invoiceTemplate, showCustomer] = await Promise.all([
      this.config.getEffectiveWithTx<string>(tx, tenantId, locationId, SETTINGS.RECEIPT_FOOTER_TEXT),
      this.config.getWithTx<string>(tx, tenantId, SETTINGS.RECEIPT_HEADER_TEXT),
      this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_LOGO),
      this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_LEGAL_NAME),
      this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_TAX_ID),
      this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_PHONE),
      this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_EMAIL),
      this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_ADDRESS),
      this.config.getWithTx<string>(tx, tenantId, SETTINGS.INVOICE_TEMPLATE),
      this.config.getWithTx<boolean>(tx, tenantId, SETTINGS.SHOW_CUSTOMER_ON_RECEIPTS),
    ]);
    let finalLegalName = legalName ? String(legalName).trim() : null;
    if (!finalLegalName) {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      finalLegalName = tenant?.name || "Informations de l'entreprise à compléter";
    }

    return {
      template: invoiceTemplate || 'STANDARD_PRO',
      showCustomerInfo: showCustomer ?? true,
      footerText: footerText || null,
      headerText: headerText || null,
      logoDataUri: logoDataUri || null,
      legalName: finalLegalName,
      taxId: taxId || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
    };
  }

  /**
   * Génère le numéro suivant en verrouillant la ligne de séquence (même
   * principe que le verrouillage de stock, cf
   * docs/architecture/01-analyse-risques.md §4.3) — deux documents émis au
   * même instant sur le même emplacement ne peuvent jamais recevoir le même
   * numéro. DOIT être appelé à l'intérieur de la transaction du document
   * généré (ici, la transaction de la vente), jamais dans une transaction
   * séparée.
   */
  async nextDocumentNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    locationId: string,
    series: string,
  ): Promise<string> {
    const rows = await tx.$queryRaw<{ id: string; lastNumber: number }[]>`
      SELECT id, "lastNumber" FROM "DocumentSequence"
      WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${locationId}::uuid AND series = ${series}
      FOR UPDATE
    `;

    let nextNumber: number;
    if (rows.length === 0) {
      nextNumber = 1;
      await tx.documentSequence.create({
        data: { id: newId(), tenantId, locationId, series, lastNumber: nextNumber },
      });
    } else {
      nextNumber = rows[0].lastNumber + 1;
      await tx.documentSequence.update({ where: { id: rows[0].id }, data: { lastNumber: nextNumber } });
    }

    const locationCode = locationId.replace(/-/g, '').slice(-6).toUpperCase();
    return `${series}-${locationCode}-${String(nextNumber).padStart(6, '0')}`;
  }

  /** Snapshot immuable (cf docs/architecture/03-modele-donnees.md §3.3) — appelé DANS la transaction de la vente. */
  async createReceiptForSale(tx: Prisma.TransactionClient, tenantId: string, input: ReceiptSnapshotInput) {
    const number = await this.nextDocumentNumber(tx, tenantId, input.sale.locationId, 'RECEIPT');
    const branding = await this.getBrandingWithTx(tx, tenantId, input.sale.locationId);

    let customerInfo: { customerName?: string; customerPhone?: string; customerEmail?: string } = {};
    if (input.sale.customerId) {
      const cust = await tx.customer.findUnique({
        where: { id: input.sale.customerId },
        select: { name: true, phone: true, email: true },
      });
      if (cust) {
        customerInfo = {
          customerName: cust.name,
          customerPhone: cust.phone ?? undefined,
          customerEmail: cust.email ?? undefined,
        };
      }
    }

    const contentSnapshot: LineDocumentContent = {
      documentType: 'RECEIPT',
      number,
      issuedAt: new Date().toISOString(),
      saleId: input.sale.id,
      locationId: input.sale.locationId,
      customerId: input.sale.customerId,
      ...customerInfo,
      currency: input.sale.currency,
      subtotal: input.sale.subtotal.toString(),
      taxTotal: input.sale.taxTotal.toString(),
      discountTotal: input.sale.discountTotal.toString(),
      grandTotal: input.sale.grandTotal.toString(),
      amountPaid: input.sale.amountPaid.toString(),
      balanceDue: input.sale.balanceDue.toString(),
      lines: input.lines.map((l) => ({
        product: l.productNameSnapshot,
        unit: l.unitSnapshot,
        quantity: l.quantity.toString(),
        unitPrice: l.unitPriceSnapshot.toString(),
        lineTotal: l.lineTotal.toString(),
      })),
      payments: input.payments.map((p) => ({
        method: p.method,
        amount: p.amount.toString(),
        reference: p.reference ?? null,
        verificationStatus:
          p.verificationStatus ??
          (p.method === 'MOBILE_MONEY' ? 'DECLARED_MANUAL' : 'CONFIRMED_MANUAL'),
      })),
      tenderedAmount: input.tenderedAmount ?? undefined,
      changeGiven: input.changeGiven ?? undefined,
      ...branding,
    };

    return tx.document.create({
      data: {
        id: newTransactionalId(),
        tenantId,
        type: 'RECEIPT',
        number,
        saleId: input.sale.id,
        contentSnapshot: contentSnapshot as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Facture à la demande (Phase 14, capability "invoicing") — même contenu
   * qu'un reçu (structurellement identique), mais une action EXPLICITE de
   * l'utilisateur, sur une vente déjà COMPLETED, jamais générée
   * automatiquement (contrairement au reçu). Réémissible plusieurs fois pour
   * la même vente (chaque émission a son propre numéro dans la série
   * INVOICE) — ce n'est pas un problème : un tenant peut vouloir réimprimer
   * une facture, chaque impression n'a pas besoin d'un numéro figé unique
   * pour cette phase (PLANNED : réutiliser le même numéro sur réémission).
   */
  async createInvoiceForSale(tenantId: string, actorUserId: string, saleId: string) {
    return this.db.run(tenantId, async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, tenantId },
        include: { lines: true, payments: true },
      });
      if (!sale) throw new NotFoundException('Vente introuvable');
      if (sale.status !== 'COMPLETED') {
        throw new BadRequestException(`Impossible de facturer une vente ${sale.status}`);
      }

      const number = await this.nextDocumentNumber(tx, tenantId, sale.locationId, 'INVOICE');
      const branding = await this.getBrandingWithTx(tx, tenantId, sale.locationId);

      const contentSnapshot: LineDocumentContent = {
        documentType: 'INVOICE',
        number,
        issuedAt: new Date().toISOString(),
        saleId: sale.id,
        locationId: sale.locationId,
        customerId: sale.customerId,
        currency: sale.currency,
        subtotal: sale.subtotal.toString(),
        taxTotal: sale.taxTotal.toString(),
        discountTotal: sale.discountTotal.toString(),
        grandTotal: sale.grandTotal.toString(),
        amountPaid: sale.amountPaid.toString(),
        balanceDue: sale.balanceDue.toString(),
        lines: sale.lines.map((l) => ({
          product: l.productNameSnapshot,
          unit: l.unitSnapshot,
          quantity: l.quantity.toString(),
          unitPrice: l.unitPriceSnapshot.toString(),
          lineTotal: l.lineTotal.toString(),
        })),
        payments: sale.payments.map((p) => ({ method: p.method, amount: p.amount.toString() })),
        ...branding,
      };

      const document = await tx.document.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          type: 'INVOICE',
          number,
          saleId: sale.id,
          contentSnapshot: contentSnapshot as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'documents.invoice.issued',
          payload: { actorUserId, entityType: 'Document', entityId: document.id, saleId: sale.id, number },
        },
      });

      return document;
    });
  }

  /**
   * Devis à la demande (Phase 14, capability "invoicing") — snapshot des
   * lignes d'une COMMANDE (pas encore une vente : rien n'a de valeur
   * juridique tant que la commande n'est pas honorée), donc AUCUNE section
   * paiement dans le contenu ni le PDF rendu (cf receipt-pdf.ts). N'affecte
   * jamais le stock ni quoi que ce soit d'autre — un pur document
   * d'information pour le client.
   */
  async createQuoteForOrder(tenantId: string, actorUserId: string, orderId: string) {
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenantId }, include: { lines: true } });
      if (!order) throw new NotFoundException('Commande introuvable');
      if (order.status === 'CANCELLED') {
        throw new BadRequestException('Impossible de générer un devis pour une commande annulée');
      }

      const number = await this.nextDocumentNumber(tx, tenantId, order.locationId, 'QUOTE');
      const branding = await this.getBrandingWithTx(tx, tenantId, order.locationId);

      const contentSnapshot: LineDocumentContent = {
        documentType: 'QUOTE',
        number,
        issuedAt: new Date().toISOString(),
        orderId: order.id,
        locationId: order.locationId,
        customerId: order.customerId,
        currency: order.currency,
        subtotal: order.subtotal.toString(),
        taxTotal: '0',
        discountTotal: '0',
        grandTotal: order.subtotal.toString(),
        amountPaid: '0',
        balanceDue: order.subtotal.toString(),
        lines: order.lines.map((l) => ({
          product: l.productNameSnapshot,
          unit: l.unitSnapshot,
          quantity: l.quantity.toString(),
          unitPrice: l.unitPriceSnapshot.toString(),
          lineTotal: l.lineTotal.toString(),
        })),
        payments: [],
        ...branding,
      };

      const document = await tx.document.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          type: 'QUOTE',
          number,
          orderId: order.id,
          contentSnapshot: contentSnapshot as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'documents.quote.issued',
          payload: { actorUserId, entityType: 'Document', entityId: document.id, orderId: order.id, number },
        },
      });

      return document;
    });
  }

  /**
   * Avoir automatique (Phase 14) — appelé DANS la transaction de
   * ReturnsService.create() dès qu'un remboursement est traité
   * (`refundAmount > 0`), exactement comme le reçu est créé dans la
   * transaction de la vente. Jamais une action utilisateur séparée : un
   * remboursement sans son avoir serait un gap de conformité.
   */
  async createCreditNoteForReturnWithTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    input: {
      returnId: string;
      locationId: string;
      customerId: string | null;
      currency: string;
      refundAmount: Prisma.Decimal;
      refundMethod: string | null;
      lines: { productNameSnapshot: string; unitSnapshot: string; quantity: Prisma.Decimal; lineTotal: Prisma.Decimal }[];
    },
  ) {
    const number = await this.nextDocumentNumber(tx, tenantId, input.locationId, 'CREDIT_NOTE');
    const branding = await this.getBrandingWithTx(tx, tenantId, input.locationId);

    const contentSnapshot: LineDocumentContent = {
      documentType: 'CREDIT_NOTE',
      number,
      issuedAt: new Date().toISOString(),
      returnId: input.returnId,
      locationId: input.locationId,
      customerId: input.customerId,
      currency: input.currency,
      subtotal: input.refundAmount.toString(),
      taxTotal: '0',
      discountTotal: '0',
      grandTotal: input.refundAmount.toString(),
      amountPaid: input.refundAmount.toString(),
      balanceDue: '0',
      lines: input.lines.map((l) => ({
        product: l.productNameSnapshot,
        unit: l.unitSnapshot,
        quantity: l.quantity.toString(),
        unitPrice: l.quantity.isZero() ? '0' : l.lineTotal.dividedBy(l.quantity).toString(),
        lineTotal: l.lineTotal.toString(),
      })),
      payments: input.refundMethod ? [{ method: input.refundMethod, amount: input.refundAmount.toString() }] : [],
      ...branding,
    };

    return tx.document.create({
      data: {
        id: newTransactionalId(),
        tenantId,
        type: 'CREDIT_NOTE',
        number,
        returnId: input.returnId,
        contentSnapshot: contentSnapshot as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getById(tenantId: string, id: string) {
    const doc = await this.db.run(tenantId, (tx) => tx.document.findFirst({ where: { id, tenantId } }));
    if (!doc) throw new NotFoundException('Document introuvable');
    return doc;
  }

  async list(tenantId: string) {
    return this.db.run(tenantId, (tx) =>
      tx.document.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  getSampleReceiptContent(template: string = 'STANDARD_PRO'): LineDocumentContent {
    return {
      documentType: 'INVOICE',
      template,
      number: `INV-PREVIEW-${template.substring(0, 4)}`,
      issuedAt: new Date().toISOString(),
      locationId: 'loc-preview',
      customerId: 'cust-preview',
      customerName: 'Société Commerciale Exemple SARL',
      customerPhone: '+226 70 00 00 00',
      customerEmail: 'contact@exemple-client.com',
      customerAddress: 'Avenue de la Nation, Secteur 4',
      showCustomerInfo: true,
      currency: 'XOF',
      subtotal: '125000',
      taxTotal: '22500',
      discountTotal: '5000',
      grandTotal: '142500',
      amountPaid: '100000',
      balanceDue: '42500',
      lines: [
        {
          product: 'Installation & Paramétrage Logiciel',
          unit: 'forfait',
          quantity: '1',
          unitPrice: '75000',
          lineTotal: '75000',
        },
        {
          product: 'Formation Utilisateurs (Demi-journée)',
          unit: 'session',
          quantity: '2',
          unitPrice: '25000',
          lineTotal: '50000',
        },
      ],
      payments: [{ method: 'MOBILE_MONEY', amount: '100000' }],
      footerText: 'Règlement sous 15 jours. Merci de votre confiance.',
      headerText: 'Facture de démonstration pour validation du modèle',
      legalName: 'GESTIONNAIRE SAAS DEMO',
      taxId: 'BF-OUA-01-2026-B14-00123',
      phone: '+226 25 30 00 00',
      email: 'facturation@gestionnaire-demo.com',
      address: 'Ouagadougou, Burkina Faso',
    };
  }
}

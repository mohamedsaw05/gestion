import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newTransactionalId, SETTINGS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { ConfigurationService } from '../config/config.service.js';
import { SalesService } from '../sales/sales.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import type { CreateProgressivePurchaseDto } from './dto/create-progressive-purchase.dto.js';
import type { RecordProgressiveDepositDto } from './dto/record-progressive-deposit.dto.js';
import type { RefundProgressiveDto } from './dto/refund-progressive.dto.js';

@Injectable()
export class ProgressivePurchasesService {
  constructor(private readonly db: PrismaTenantService, private readonly config: ConfigurationService, private readonly sales: SalesService, private readonly pricing: PricingService) {}

  private async balance(tx: Prisma.TransactionClient, tenantId: string, caseId: string) {
    const rows = await tx.progressivePurchaseMovement.findMany({ where: { tenantId, caseId }, select: { kind: true, amount: true } });
    return rows.reduce((sum, row) => row.kind === 'DEPOSIT' ? sum.plus(row.amount) : sum.minus(row.amount), new Prisma.Decimal(0));
  }

  private async withBalance(tx: Prisma.TransactionClient, tenantId: string, purchase: any) {
    const movements = await tx.progressivePurchaseMovement.findMany({
      where: { tenantId, caseId: purchase.id }, orderBy: { createdAt: 'asc' },
      select: { id: true, kind: true, amount: true, currency: true, paymentMethod: true, paymentReference: true, receiptNumber: true, balanceBefore: true, balanceAfter: true, saleId: true, createdByUserId: true, createdAt: true },
    });
    const availableBalance = movements.reduce((sum, row) => row.kind === 'DEPOSIT' ? sum.plus(row.amount) : sum.minus(row.amount), new Prisma.Decimal(0));
    return { ...purchase, availableBalance: availableBalance.toString(), movements };
  }

  async list(tenantId: string, query = '') {
    return this.db.run(tenantId, async (tx) => {
      const term = query.trim();
      const [customers, receiptRows] = term ? await Promise.all([
        tx.customer.findMany({ where: { tenantId, deletedAt: null, OR: [
          { name: { contains: term, mode: 'insensitive' } }, { phone: { contains: term, mode: 'insensitive' } },
        ] }, select: { id: true } }),
        tx.progressivePurchaseMovement.findMany({ where: { tenantId, receiptNumber: { contains: term, mode: 'insensitive' } }, select: { caseId: true } }),
      ]) : [[], []];
      const matchingIds = [...new Set([...customers.map((customer) => customer.id), ...receiptRows.map((row) => row.caseId)])];
      const purchases = await tx.progressivePurchaseCase.findMany({
        where: { tenantId, ...(term ? { OR: [
          { reference: { contains: term, mode: 'insensitive' } },
          { productNameSnapshot: { contains: term, mode: 'insensitive' } },
          ...(matchingIds.length ? [{ customerId: { in: matchingIds } }] : []),
        ] } : {}) },
        orderBy: { createdAt: 'desc' }, take: 300,
      });
      const customerRows = await tx.customer.findMany({ where: { tenantId, id: { in: purchases.map((p) => p.customerId) } }, select: { id: true, name: true, phone: true } });
      const customersById = new Map(customerRows.map((customer) => [customer.id, customer]));
      return Promise.all(purchases.map(async (purchase) => ({ ...(await this.withBalance(tx, tenantId, purchase)), customer: customersById.get(purchase.customerId) ?? null })));
    });
  }

  async stats(tenantId: string, from?: Date, to?: Date) {
    return this.db.run(tenantId, async (tx) => {
      const where: any = { tenantId, ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) };
      const [cases, movements] = await Promise.all([
        tx.progressivePurchaseCase.findMany({ where, select: { id: true, status: true, customerId: true } }),
        tx.progressivePurchaseMovement.findMany({ where: { tenantId, ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) } }),
      ]);
      const deposits = movements.filter((m) => m.kind === 'DEPOSIT').reduce((s, m) => s.plus(m.amount), new Prisma.Decimal(0));
      const refunds = movements.filter((m) => m.kind === 'REFUND').reduce((s, m) => s.plus(m.amount), new Prisma.Decimal(0));
      const applied = movements.filter((m) => m.kind === 'APPLIED').reduce((s, m) => s.plus(m.amount), new Prisma.Decimal(0));
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const depositsToday = movements.filter((m) => m.kind === 'DEPOSIT' && m.createdAt >= today).reduce((s, m) => s.plus(m.amount), new Prisma.Decimal(0));
      const weeklyDeposits = Array.from({ length: 7 }, (_, offset) => {
        const day = new Date(); day.setUTCHours(0, 0, 0, 0); day.setUTCDate(day.getUTCDate() - (6 - offset));
        const next = new Date(day); next.setUTCDate(next.getUTCDate() + 1);
        const amount = movements.filter((m) => m.kind === 'DEPOSIT' && m.createdAt >= day && m.createdAt < next).reduce((s, m) => s.plus(m.amount), new Prisma.Decimal(0));
        return { date: day.toISOString().slice(0, 10), amount: amount.toString() };
      });
      return {
        openCases: cases.filter((c) => ['OPEN', 'PRODUCT_SELECTED', 'READY_FOR_PICKUP'].includes(c.status)).length,
        activeCustomers: new Set(cases.filter((c) => ['OPEN', 'PRODUCT_SELECTED', 'READY_FOR_PICKUP'].includes(c.status)).map((c) => c.customerId)).size,
        fundedCases: cases.filter((c) => c.status === 'READY_FOR_PICKUP').length,
        redeemedCases: cases.filter((c) => c.status === 'REDEEMED').length,
        cancelledCases: cases.filter((c) => c.status === 'CANCELLED').length,
        totalDeposits: deposits.toString(), totalRefunds: refunds.toString(), totalAppliedToSales: applied.toString(),
        depositsToday: depositsToday.toString(),
        availableBalance: deposits.minus(refunds).minus(applied).toString(),
        weeklyDeposits,
      };
    });
  }

  async getById(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const purchase = await tx.progressivePurchaseCase.findFirst({ where: { id, tenantId } });
      if (!purchase) throw new NotFoundException('Dossier de versements introuvable');
      const [full, customer] = await Promise.all([
        this.withBalance(tx, tenantId, purchase),
        tx.customer.findFirst({ where: { id: purchase.customerId, tenantId }, select: { id: true, name: true, phone: true } }),
      ]);
      return { ...full, customer };
    });
  }

  async create(tenantId: string, actorUserId: string, dto: CreateProgressivePurchaseDto) {
    return this.db.run(tenantId, async (tx) => {
      const [location, customer] = await Promise.all([
        tx.location.findFirst({ where: { id: dto.locationId, tenantId, deletedAt: null } }),
        tx.customer.findFirst({ where: { id: dto.customerId, tenantId, deletedAt: null } }),
      ]);
      if (!location || location.type === 'QUARANTINE') throw new BadRequestException('Boutique introuvable ou non commerciale');
      if (!customer) throw new BadRequestException('Client introuvable');
      const id = newTransactionalId();
      const purchase = await tx.progressivePurchaseCase.create({ data: {
        id, tenantId, locationId: location.id, customerId: customer.id,
        reference: `VPP-${id.replaceAll('-', '').slice(-10).toUpperCase()}`,
        currency: await this.config.getWithTx<string>(tx, tenantId, SETTINGS.DEFAULT_CURRENCY) || 'XOF',
        saleOperationId: newTransactionalId(), notes: dto.notes?.trim() || null,
        createdByUserId: actorUserId, responsibleUserId: dto.responsibleUserId || actorUserId,
      } });
      return { ...purchase, customer };
    });
  }

  async deposit(tenantId: string, actorUserId: string, caseId: string, dto: RecordProgressiveDepositDto) {
    const amount = new Prisma.Decimal(dto.amount);
    if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) throw new BadRequestException('Le versement doit être strictement positif');
    return this.db.run(tenantId, async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ProgressivePurchaseCase" WHERE id = ${caseId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('Dossier introuvable');
      const previousOperation = await tx.progressivePurchaseMovement.findFirst({ where: { tenantId, operationId: dto.operationId } });
      if (previousOperation) {
        if (previousOperation.caseId !== caseId || previousOperation.kind !== 'DEPOSIT' || !previousOperation.amount.equals(amount) || previousOperation.paymentMethod !== dto.method) throw new ConflictException('Cette clé d’opération a déjà été utilisée pour un autre versement');
        const same = await tx.progressivePurchaseCase.findFirst({ where: { id: caseId, tenantId } });
        return { movement: previousOperation, purchase: same ? await this.withBalance(tx, tenantId, same) : null };
      }
      const purchase = await tx.progressivePurchaseCase.findFirst({ where: { id: caseId, tenantId } });
      if (!purchase || ['CANCELLED', 'REFUNDED', 'REDEEMED'].includes(purchase.status)) throw new BadRequestException('Ce dossier ne peut plus recevoir de versement');
      const enabled = await this.config.getWithTx<string[]>(tx, tenantId, SETTINGS.ENABLED_PAYMENT_METHODS) ?? ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK'];
      if (!enabled.includes(dto.method)) throw new BadRequestException('Ce mode de paiement est désactivé');
      if (dto.method === 'MOBILE_MONEY' && !dto.reference?.trim()) throw new BadRequestException('La référence Mobile Money est obligatoire');
      const before = await this.balance(tx, tenantId, caseId);
      const after = before.plus(amount);
      const id = newTransactionalId();
      const receiptNumber = `VPM-${id.replaceAll('-', '').slice(-12).toUpperCase()}`;
      const [customer, location] = await Promise.all([
        tx.customer.findFirst({ where: { id: purchase.customerId, tenantId } }),
        tx.location.findFirst({ where: { id: purchase.locationId, tenantId } }),
      ]);
      const [legalName, phone, email, address, logoDataUri, footerText] = await Promise.all([
        this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_LEGAL_NAME),
        this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_PHONE),
        this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_EMAIL),
        this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_ADDRESS),
        this.config.getWithTx<string>(tx, tenantId, SETTINGS.ORGANIZATION_LOGO),
        this.config.getEffectiveWithTx<string>(tx, tenantId, purchase.locationId, SETTINGS.RECEIPT_FOOTER_TEXT),
      ]);
      const [tenant, actor] = await Promise.all([
        tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
        tx.user.findFirst({ where: { id: actorUserId, tenantId }, select: { fullName: true, email: true } }),
      ]);
      const issuedAt = new Date().toISOString();
      const remainingRaw = purchase.productPriceSnapshot ? new Prisma.Decimal(purchase.productPriceSnapshot).minus(after) : null;
      const remaining = remainingRaw ? Prisma.Decimal.max(remainingRaw, 0) : null;
      const receiptSnapshot = {
        number: receiptNumber, issuedAt, currency: purchase.currency,
        subtotal: amount.toString(), taxTotal: '0', discountTotal: '0', grandTotal: amount.toString(), amountPaid: amount.toString(), balanceDue: '0',
        lines: [{ product: `Versement progressif — dossier ${purchase.reference}`, unit: 'versement', quantity: '1', unitPrice: amount.toString(), lineTotal: amount.toString(), description: `Cumul avant : ${before.toString()} ${purchase.currency}; nouveau cumul : ${after.toString()} ${purchase.currency}${remaining ? `; reste objectif : ${remaining.toString()} ${purchase.currency}` : ''}` }],
        payments: [{ method: dto.method, amount: amount.toString(), reference: dto.reference || null }],
        legalName: legalName || tenant?.name || undefined, phone: phone || undefined, email: email || undefined, address: address || undefined,
        logoDataUri: logoDataUri || undefined,
        footerText: [footerText, `Total versé avant : ${before.toString()} ${purchase.currency}`, `Nouveau cumul : ${after.toString()} ${purchase.currency}`, remaining ? `Montant restant : ${remaining.toString()} ${purchase.currency}` : null, `Employé : ${actor?.fullName || actor?.email || actorUserId}`].filter(Boolean).join('\n'),
        customerName: customer?.name, customerPhone: customer?.phone, showCustomerInfo: true,
        headerText: `Boutique : ${location?.name || '—'} · Dossier ${purchase.reference}`,
      };
      const movement = await tx.progressivePurchaseMovement.create({ data: {
        id, tenantId, caseId, operationId: dto.operationId, kind: 'DEPOSIT', amount, currency: purchase.currency, paymentMethod: dto.method,
        paymentReference: dto.reference?.trim() || null, receiptNumber, balanceBefore: before, balanceAfter: after,
        createdByUserId: actorUserId, receiptSnapshot: receiptSnapshot as Prisma.InputJsonValue,
      } });
      const status = purchase.productPriceSnapshot && after.greaterThanOrEqualTo(purchase.productPriceSnapshot) ? 'READY_FOR_PICKUP' : purchase.productId ? 'PRODUCT_SELECTED' : 'OPEN';
      const updated = await tx.progressivePurchaseCase.update({ where: { id }, data: { status } });
      return { movement, purchase: await this.withBalance(tx, tenantId, updated) };
    });
  }

  async selectProduct(tenantId: string, caseId: string, productId: string) {
    return this.db.run(tenantId, async (tx) => {
      const [purchase, product] = await Promise.all([
        tx.progressivePurchaseCase.findFirst({ where: { id: caseId, tenantId } }),
        tx.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } }),
      ]);
      if (!purchase) throw new NotFoundException('Dossier introuvable');
      if (!product || product.type === 'SERVICE') throw new BadRequestException('Choisissez un produit physique existant');
      if (['REDEEMED', 'CANCELLED', 'REFUNDED'].includes(purchase.status)) throw new BadRequestException('Le dossier est clôturé');
      const price = (await this.pricing.resolveUnitPrice(tx, tenantId, product.id, purchase.customerId, new Prisma.Decimal(1), new Prisma.Decimal(product.basePrice))).unitPrice;
      if (product.isStocked) {
        const stock = await tx.stockLevel.findFirst({ where: { tenantId, locationId: purchase.locationId, productId: product.id } });
        if (!stock || new Prisma.Decimal(stock.quantityOnHand).lessThan(1)) throw new BadRequestException('Ce produit n’est pas disponible en stock dans cette boutique');
      }
      const balance = await this.balance(tx, tenantId, caseId);
      const updated = await tx.progressivePurchaseCase.update({ where: { id: caseId }, data: {
        productId, productNameSnapshot: product.name, productPriceSnapshot: price,
        status: balance.greaterThanOrEqualTo(price) ? 'READY_FOR_PICKUP' : 'PRODUCT_SELECTED',
      } });
      return this.withBalance(tx, tenantId, updated);
    });
  }

  async redeem(tenantId: string, actorUserId: string, caseId: string) {
    const purchase = await this.getById(tenantId, caseId);
    if (!purchase.productId || !purchase.productPriceSnapshot) throw new BadRequestException('Sélectionnez un produit avant son retrait');
    if (new Prisma.Decimal(purchase.availableBalance).lessThan(purchase.productPriceSnapshot)) throw new BadRequestException('Le solde du dossier ne couvre pas encore le prix du produit');
    if (['CANCELLED', 'REFUNDED'].includes(purchase.status)) throw new BadRequestException('Le dossier est clôturé');

    // SalesService validates and locks the ledger, creates exactly one real
    // sale, and decrements stock. The internal payment method does not attach
    // old cash deposits to today's till session a second time.
    const sale = await this.sales.create(tenantId, actorUserId, {
      locationId: purchase.locationId, customerId: purchase.customerId, operationId: purchase.saleOperationId,
      lines: [{ productId: purchase.productId, quantity: '1', unitPriceOverride: new Prisma.Decimal(purchase.productPriceSnapshot).toString() }],
    }, purchase.id);
    if (!sale) throw new ConflictException('La vente n’a pas pu être confirmée; le dossier reste disponible pour une nouvelle tentative');

    return this.db.run(tenantId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProgressivePurchaseCase" WHERE id = ${caseId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      const latest = await tx.progressivePurchaseCase.findFirst({ where: { id: caseId, tenantId } });
      if (!latest) throw new NotFoundException('Dossier introuvable');
      if (latest.saleId) return this.withBalance(tx, tenantId, latest);
      const before = await this.balance(tx, tenantId, caseId);
      const amount = new Prisma.Decimal(purchase.productPriceSnapshot);
      const movement = await tx.progressivePurchaseMovement.create({ data: {
        id: newTransactionalId(), tenantId, caseId, kind: 'APPLIED', amount, currency: purchase.currency,
        paymentMethod: 'PROGRESSIVE_BALANCE', paymentReference: null, receiptNumber: null,
        balanceBefore: before, balanceAfter: before.minus(amount), saleId: sale.id, createdByUserId: actorUserId,
        receiptSnapshot: Prisma.JsonNull,
      } });
      const updated = await tx.progressivePurchaseCase.update({ where: { id: caseId }, data: { status: 'REDEEMED', saleId: sale.id } });
      return { ...(await this.withBalance(tx, tenantId, updated)), redemption: movement, sale };
    });
  }

  async refund(tenantId: string, actorUserId: string, caseId: string, dto: RefundProgressiveDto) {
    const amount = new Prisma.Decimal(dto.amount);
    if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) throw new BadRequestException('Le remboursement doit être strictement positif');
    return this.db.run(tenantId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProgressivePurchaseCase" WHERE id = ${caseId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      const previousOperation = await tx.progressivePurchaseMovement.findFirst({ where: { tenantId, operationId: dto.operationId } });
      if (previousOperation) {
        if (previousOperation.caseId !== caseId || previousOperation.kind !== 'REFUND' || !previousOperation.amount.equals(amount) || previousOperation.paymentMethod !== dto.method) throw new ConflictException('Cette clé d’opération a déjà été utilisée pour un autre remboursement');
        const same = await tx.progressivePurchaseCase.findFirst({ where: { id: caseId, tenantId } });
        return { movement: previousOperation, purchase: same ? await this.withBalance(tx, tenantId, same) : null };
      }
      const purchase = await tx.progressivePurchaseCase.findFirst({ where: { id: caseId, tenantId } });
      if (!purchase) throw new NotFoundException('Dossier introuvable');
      const before = await this.balance(tx, tenantId, caseId);
      if (amount.greaterThan(before)) throw new BadRequestException('Le remboursement dépasse le solde disponible');
      const after = before.minus(amount);
      const receiptNumber = `VPR-${newTransactionalId().replaceAll('-', '').slice(-12).toUpperCase()}`;
      const movement = await tx.progressivePurchaseMovement.create({ data: {
        id: newTransactionalId(), tenantId, caseId, operationId: dto.operationId, kind: 'REFUND', amount, currency: purchase.currency,
        paymentMethod: dto.method, paymentReference: dto.reference?.trim() || null,
        receiptNumber,
        balanceBefore: before, balanceAfter: after, createdByUserId: actorUserId,
        receiptSnapshot: { number: receiptNumber, issuedAt: new Date().toISOString(), currency: purchase.currency, subtotal: amount.toString(), taxTotal: '0', discountTotal: '0', grandTotal: amount.toString(), amountPaid: amount.toString(), balanceDue: '0', lines: [{ product: `Remboursement dossier ${purchase.reference}`, unit: 'remboursement', quantity: '1', unitPrice: amount.toString(), lineTotal: amount.toString() }], payments: [{ method: dto.method, amount: amount.toString() }] },
      } });
      const updated = await tx.progressivePurchaseCase.update({ where: { id: caseId }, data: { status: after.isZero() ? 'REFUNDED' : purchase.status } });
      return { movement, purchase: await this.withBalance(tx, tenantId, updated) };
    });
  }

  async cancel(tenantId: string, caseId: string) {
    return this.db.run(tenantId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProgressivePurchaseCase" WHERE id = ${caseId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      const purchase = await tx.progressivePurchaseCase.findFirst({ where: { id: caseId, tenantId } });
      if (!purchase) throw new NotFoundException('Dossier introuvable');
      if (purchase.saleId || ['REDEEMED', 'REFUNDED'].includes(purchase.status)) throw new BadRequestException('Un achat remis ou remboursé ne peut pas être annulé');
      const balance = await this.balance(tx, tenantId, caseId);
      if (!balance.isZero()) throw new BadRequestException('Remboursez d’abord le solde disponible avant d’annuler le dossier');
      const updated = await tx.progressivePurchaseCase.update({ where: { id: caseId }, data: { status: 'CANCELLED' } });
      return this.withBalance(tx, tenantId, updated);
    });
  }

  async getMovementReceipt(tenantId: string, movementId: string) {
    const movement = await this.db.run(tenantId, (tx) => tx.progressivePurchaseMovement.findFirst({ where: { id: movementId, tenantId } }));
    if (!movement || !movement.receiptNumber) throw new NotFoundException('Reçu de versement introuvable');
    return movement.receiptSnapshot;
  }
}

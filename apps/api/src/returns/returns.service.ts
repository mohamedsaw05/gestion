import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newTransactionalId, PERMISSIONS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { CreditService } from '../credit/credit.service.js';
import type { CreateReturnDto } from './dto/create-return.dto.js';

/**
 * Returns / Refunds Engine (Phase 11). Un retour est un acte ATOMIQUE et
 * IMMUABLE une fois créé — pas de cycle de statuts, pas d'annulation (comme
 * une vente : une erreur se corrige par un nouveau mouvement, jamais en
 * réécrivant l'historique). Réintègre le stock EN UNITÉ DE RÉFÉRENCE via
 * InventoryService.applyStockMovementWithTx — jamais de duplication de la
 * logique de verrouillage déjà éprouvée (Sales/Purchase l'utilisent aussi).
 *
 * Règle financière stricte (Correction S0) :
 * Sur une vente avec solde dû (crédit impayé), tout retour annule d'abord
 * la créance client. Seules les sommes effectivement perçues en argent
 * peuvent faire l'objet d'un remboursement d'espèces ou d'un avoir.
 */
@Injectable()
export class ReturnsService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly inventory: InventoryService,
    private readonly documents: DocumentsService,
    private readonly rbac: RbacService,
    private readonly credit: CreditService,
  ) {}

  private async buildVisibilityWhere(tenantId: string, userId: string): Promise<Prisma.ReturnWhereInput> {
    const visibility = await this.rbac.getRecordVisibility(tenantId, userId, PERMISSIONS.RETURNS_READ);
    if (visibility.allLocations) return {};

    const or: Prisma.ReturnWhereInput[] = [];
    if (visibility.locationIds.length > 0) or.push({ locationId: { in: visibility.locationIds } });
    if (visibility.ownRecordsOnly) or.push({ processedByUserId: userId });
    if (visibility.teamLocationIds.length > 0) {
      const teamUserIds = await this.rbac.resolveTeamMemberUserIds(tenantId, visibility.teamLocationIds);
      if (teamUserIds.length > 0) or.push({ processedByUserId: { in: teamUserIds } });
    }
    return or.length > 0 ? { OR: or } : { id: '__none__' };
  }

  async list(tenantId: string, userId: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    return this.db.run(tenantId, (tx) =>
      tx.return.findMany({ where: { tenantId, ...visibilityWhere }, include: { lines: true }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async getById(tenantId: string, userId: string, id: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    const ret = await this.db.run(tenantId, (tx) =>
      tx.return.findFirst({ where: { id, tenantId, ...visibilityWhere }, include: { lines: true } }),
    );
    if (!ret) throw new NotFoundException('Retour introuvable');
    return ret;
  }

  /** Lignes de la vente avec leur quantité déjà retournée et le reliquat retournable — pour l'écran de saisie. */
  async getEligibleLines(tenantId: string, saleId: string) {
    return this.db.run(tenantId, async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id: saleId, tenantId }, include: { lines: true } });
      if (!sale) throw new NotFoundException('Vente introuvable');

      const returnLines = await tx.returnLine.findMany({
        where: { tenantId, saleLineId: { in: sale.lines.map((l) => l.id) } },
      });
      const returnedByLine = new Map<string, Prisma.Decimal>();
      for (const rl of returnLines) {
        returnedByLine.set(rl.saleLineId, (returnedByLine.get(rl.saleLineId) ?? new Prisma.Decimal(0)).plus(rl.quantity));
      }

      return {
        sale,
        lines: sale.lines.map((l) => {
          const returned = returnedByLine.get(l.id) ?? new Prisma.Decimal(0);
          return {
            saleLineId: l.id,
            productId: l.productId,
            productNameSnapshot: l.productNameSnapshot,
            unitSnapshot: l.unitSnapshot,
            quantitySold: l.quantity,
            alreadyReturned: returned,
            remaining: l.quantity.minus(returned),
          };
        }),
      };
    });
  }

  async create(tenantId: string, actorUserId: string, dto: CreateReturnDto) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.return.findFirst({ where: { tenantId, operationId: dto.operationId }, include: { lines: true } });
      if (existing) return existing;

      const sale = await tx.sale.findFirst({ where: { id: dto.saleId, tenantId }, include: { lines: true } });
      if (!sale) throw new BadRequestException('Vente introuvable');
      if (sale.status !== 'COMPLETED') {
        throw new BadRequestException(`Impossible de retourner une vente ${sale.status}`);
      }

      const saleLineById = new Map(sale.lines.map((l) => [l.id, l]));
      const productIds = [...new Set(dto.lines.map((l) => saleLineById.get(l.saleLineId)?.productId).filter(Boolean))] as string[];
      const products = await tx.product.findMany({ where: { tenantId, id: { in: productIds } } });
      const productById = new Map(products.map((p) => [p.id, p]));

      const returnId = newTransactionalId();
      let refundAmount = new Prisma.Decimal(0);
      const lineInputs: {
        saleLineId: string;
        productId: string;
        productNameSnapshot: string;
        unitSnapshot: string;
        conversionFactorSnapshot: Prisma.Decimal;
        quantity: Prisma.Decimal;
        unitPriceSnapshot: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        condition: string;
        restocked: boolean;
      }[] = [];

      for (const line of dto.lines) {
        const saleLine = saleLineById.get(line.saleLineId);
        if (!saleLine) {
          throw new BadRequestException(`Ligne de vente introuvable sur cette vente : ${line.saleLineId}`);
        }
        const quantity = new Prisma.Decimal(line.quantity);
        if (quantity.lessThanOrEqualTo(0)) {
          throw new BadRequestException('La quantité retournée doit être strictement positive');
        }

        const alreadyReturned = await tx.returnLine.aggregate({
          where: { tenantId, saleLineId: saleLine.id },
          _sum: { quantity: true },
        });
        const returnedSoFar = alreadyReturned._sum.quantity ?? new Prisma.Decimal(0);
        const remaining = saleLine.quantity.minus(returnedSoFar);
        if (quantity.greaterThan(remaining)) {
          throw new BadRequestException(
            `Quantité retournée (${quantity.toString()}) supérieure au reliquat retournable pour "${saleLine.productNameSnapshot}" (${remaining.toString()})`,
          );
        }

        const lineTotal = quantity.times(saleLine.unitPriceSnapshot);
        refundAmount = refundAmount.plus(lineTotal);

        const product = productById.get(saleLine.productId);
        // Réintégré au stock vendable seulement si l'état est BON et que ce
        // produit est réellement stocké. Si l'état est DÉFECTUEUX, le stock
        // est routé vers l'emplacement virtuel de quarantaine de la boutique
        // (comptabilisé dans l'inventaire mais exclu du stock disponible à la vente).
        if (Boolean(product?.isStocked)) {
          const referenceQuantity = quantity.times(saleLine.conversionFactorSnapshot);
          if (line.condition === 'GOOD') {
            await this.inventory.applyStockMovementWithTx(
              tx,
              tenantId,
              sale.locationId,
              saleLine.productId,
              referenceQuantity,
              'return',
              'return',
              returnId,
            );
          } else if (line.condition === 'DEFECTIVE') {
            // Emplacement virtuel de quarantaine rattaché à cette boutique
            const storeLoc = await tx.location.findUnique({ where: { id: sale.locationId } });
            const quarantineName = `Quarantaine SAV (${storeLoc?.name ?? 'Boutique'})`;
            let quarantineLoc = await tx.location.findFirst({
              where: { tenantId, name: quarantineName, type: 'QUARANTINE' },
            });
            if (!quarantineLoc) {
              quarantineLoc = await tx.location.create({
                data: {
                  id: newTransactionalId(),
                  tenantId,
                  name: quarantineName,
                  type: 'QUARANTINE',
                },
              });
            }
            await this.inventory.applyStockMovementWithTx(
              tx,
              tenantId,
              quarantineLoc.id,
              saleLine.productId,
              referenceQuantity,
              'return',
              'quarantine_return',
              returnId,
            );
          }
        }

        // Numéros de série (Phase 12) : identifie QUELLE unité précise revient
        // — doit avoir été réellement vendue SUR CETTE ligne (impossible de
        // "retourner" un numéro vendu sur une autre vente). GOOD la remet
        // disponible (redevient vendable à cet emplacement) ; DEFECTIVE la
        // marque définitivement non vendable (jamais réintégrée).
        if (product?.tracksSerialNumbers) {
          const provided = line.serialNumbers ?? [];
          if (!quantity.equals(provided.length)) {
            throw new BadRequestException(
              `"${saleLine.productNameSnapshot}" suit les numéros de série : ${provided.length} numéro(s) fourni(s) pour une quantité retournée de ${quantity.toString()}`,
            );
          }
          const rows = await tx.serialNumber.findMany({
            where: { tenantId, productId: saleLine.productId, serial: { in: provided } },
          });
          const rowBySerial = new Map(rows.map((r) => [r.serial, r]));
          for (const serial of provided) {
            const row = rowBySerial.get(serial);
            if (!row || row.saleLineId !== saleLine.id || row.status !== 'SOLD') {
              throw new BadRequestException(
                `Numéro de série non vendu sur cette ligne de vente : ${serial}`,
              );
            }
          }
          await tx.serialNumber.updateMany({
            where: { tenantId, productId: saleLine.productId, serial: { in: provided } },
            data:
              line.condition === 'GOOD'
                ? { status: 'AVAILABLE', locationId: sale.locationId }
                : { status: 'DEFECTIVE' },
          });
        }

        lineInputs.push({
          saleLineId: saleLine.id,
          productId: saleLine.productId,
          productNameSnapshot: saleLine.productNameSnapshot,
          unitSnapshot: saleLine.unitSnapshot,
          conversionFactorSnapshot: saleLine.conversionFactorSnapshot,
          quantity,
          unitPriceSnapshot: saleLine.unitPriceSnapshot,
          lineTotal,
          condition: line.condition,
          restocked: line.condition === 'GOOD' && Boolean(product?.isStocked),
        });
      }

      await tx.return.create({
        data: {
          id: returnId,
          tenantId,
          saleId: sale.id,
          locationId: sale.locationId,
          customerId: sale.customerId,
          processedByUserId: actorUserId,
          reason: dto.reason,
          refundMethod: dto.refundMethod,
          refundAmount,
          operationId: dto.operationId,
        },
      });
      for (const line of lineInputs) {
        await tx.returnLine.create({ data: { id: newTransactionalId(), tenantId, returnId, ...line } });
      }

      // RÈGLE MÉTIER CRITIQUE (Correction S0) :
      // 1. Déterminer la part de dette annulée et la part effectivement remboursable en argent
      let debtCancelled = new Prisma.Decimal(0);
      let moneyRefundable = refundAmount;

      if (sale.customerId && sale.balanceDue.greaterThan(0)) {
        const previousReturns = await tx.return.findMany({
          where: { tenantId, saleId: sale.id, id: { not: returnId } },
          select: { id: true, refundAmount: true },
        });
        const previousReturnIds = previousReturns.map((r) => r.id);
        const previousCreditMoves = previousReturnIds.length > 0
          ? await tx.creditMovement.findMany({
              where: {
                tenantId,
                referenceType: 'return',
                referenceId: { in: previousReturnIds },
                movementType: 'CREDIT',
              },
              select: { amount: true },
            })
          : [];
        const previousDebtCancelled = previousCreditMoves.reduce(
          (sum, m) => sum.plus(m.amount),
          new Prisma.Decimal(0),
        );
        const remainingSaleDebt = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          sale.balanceDue.minus(previousDebtCancelled),
        );

        if (remainingSaleDebt.greaterThan(0)) {
          debtCancelled = Prisma.Decimal.min(remainingSaleDebt, refundAmount);
          moneyRefundable = refundAmount.minus(debtCancelled);

          await this.credit.reduceDebtWithTx(
            tx,
            tenantId,
            sale.customerId,
            debtCancelled,
            returnId,
            `Annulation de créance suite à retour marchandise sur vente ${sale.id.slice(0, 8)}`,
          );
        }
      }

      // 2. Plafonnement et contrôle strict : les remboursements en argent/espèces ne peuvent JAMAIS dépasser
      // les montants effectivement perçus lors de la vente originale
      if (dto.refundMethod === 'CASH') {
        if (sale.amountPaid.isZero() || moneyRefundable.isZero()) {
          throw new BadRequestException(
            `VTM-RETURNS-CASH-REFUND-FORBIDDEN: Impossible d'effectuer un remboursement en espèces sur une vente à crédit non payée ou dont le retour est absorbé par l'annulation de créance. Le retour doit être validé sans méthode de remboursement espèces (la créance client a été réduite de ${debtCancelled.toString()}).`,
          );
        }

        const saleCashPayments = await tx.payment.findMany({
          where: { tenantId, saleId: sale.id, method: 'CASH' },
          select: { amount: true },
        });
        const totalCashPaidOnSale = saleCashPayments.reduce(
          (sum, p) => sum.plus(p.amount),
          new Prisma.Decimal(0),
        );

        const previousCashReturns = await tx.return.findMany({
          where: { tenantId, saleId: sale.id, refundMethod: 'CASH', id: { not: returnId } },
          select: { refundAmount: true },
        });
        const previousCashRefunded = previousCashReturns.reduce(
          (sum, r) => sum.plus(r.refundAmount),
          new Prisma.Decimal(0),
        );
        const remainingCashAvailable = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          totalCashPaidOnSale.minus(previousCashRefunded),
        );

        if (moneyRefundable.greaterThan(remainingCashAvailable)) {
          throw new BadRequestException(
            `VTM-RETURNS-REFUND-EXCEEDS-PAID: Le montant du remboursement en espèces demandé (${moneyRefundable.toString()}) dépasse le montant net perçu en espèces disponible sur cette vente (${remainingCashAvailable.toString()}).`,
          );
        }
      } else if (dto.refundMethod) {
        if (sale.amountPaid.isZero() || moneyRefundable.isZero()) {
          throw new BadRequestException(
            `VTM-RETURNS-REFUND-FORBIDDEN: Impossible d'effectuer un remboursement direct sur une vente à crédit non payée ou dont le retour est absorbé par la créance.`,
          );
        }
        if (moneyRefundable.greaterThan(sale.amountPaid)) {
          throw new BadRequestException(
            `VTM-RETURNS-REFUND-EXCEEDS-PAID: Le montant de remboursement demandé dépasse le montant net perçu sur cette vente.`,
          );
        }
      }

      // Avoir automatique (Phase 14)
      if (refundAmount.greaterThan(0)) {
        await this.documents.createCreditNoteForReturnWithTx(tx, tenantId, {
          returnId,
          locationId: sale.locationId,
          customerId: sale.customerId,
          currency: sale.currency,
          refundAmount,
          refundMethod: dto.refundMethod ?? null,
          lines: lineInputs.map((l) => ({
            productNameSnapshot: l.productNameSnapshot,
            unitSnapshot: l.unitSnapshot,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
          })),
        });
      }

      // Sortie de caisse espèces STRICTEMENT limitée aux sommes effectivement remboursables en argent
      if (dto.refundMethod === 'CASH' && moneyRefundable.greaterThan(0)) {
        const openSession = await tx.cashSession.findFirst({
          where: { tenantId, locationId: sale.locationId, status: 'OPEN' },
        });
        if (openSession) {
          await tx.cashMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              sessionId: openSession.id,
              type: 'CASH_OUT',
              amount: moneyRefundable,
              reason: `Remboursement retour (vente ${sale.id.slice(0, 8)})`,
              createdByUserId: actorUserId,
            },
          });
        }
      }

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'returns.return.created',
          payload: {
            actorUserId,
            entityType: 'Return',
            entityId: returnId,
            saleId: sale.id,
            refundAmount: refundAmount.toString(),
            refundMethod: dto.refundMethod ?? null,
          },
        },
      });

      return tx.return.findFirst({ where: { id: returnId }, include: { lines: true } });
    });
  }
}

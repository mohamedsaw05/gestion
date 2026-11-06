import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId, newTransactionalId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import type { CreateSupplierDto } from './dto/create-supplier.dto.js';
import type { UpdateSupplierDto } from './dto/update-supplier.dto.js';

/**
 * Fournisseurs + dette fournisseur (Phase 10). Symétrique du Credit Engine
 * côté achats : SupplierAccount.balance > 0 = LE TENANT doit de l'argent AU
 * FOURNISSEUR (sens inversé de CreditAccount). Le solde reste toujours
 * recalculable depuis le journal append-only SupplierMovement, jamais
 * modifié directement.
 */
@Injectable()
export class SuppliersService {
  constructor(private readonly db: PrismaTenantService) {}

  async list(tenantId: string) {
    return this.db.run(tenantId, async (tx) => {
      const suppliers = await tx.supplier.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } });
      const accounts = await tx.supplierAccount.findMany({ where: { tenantId } });
      const balanceBySupplier = new Map(accounts.map((a) => [a.supplierId, a.balance]));
      return suppliers.map((s) => ({ ...s, balance: (balanceBySupplier.get(s.id) ?? new Prisma.Decimal(0)).toString() }));
    });
  }

  async create(tenantId: string, dto: CreateSupplierDto) {
    return this.db.run(tenantId, (tx) =>
      tx.supplier.create({
        data: { id: newId(), tenantId, name: dto.name, phone: dto.phone, email: dto.email, address: dto.address, notes: dto.notes },
      }),
    );
  }

  async getById(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const supplier = await tx.supplier.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!supplier) throw new NotFoundException('Fournisseur introuvable');
      const account = await tx.supplierAccount.findFirst({ where: { tenantId, supplierId: id } });
      const movements = account
        ? await tx.supplierMovement.findMany({
            where: { tenantId, accountId: account.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : [];
      return { supplier, account, movements };
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.supplier.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) throw new NotFoundException('Fournisseur introuvable');
      return tx.supplier.update({ where: { id }, data: dto });
    });
  }

  /**
   * DOIT être appelé DANS la transaction de réception d'achat (comme
   * CreditService.recordSaleDebt pour les ventes) — la dette et la réception
   * qui l'a créée sont une seule opération atomique.
   */
  async recordPurchaseDebtWithTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    supplierId: string,
    amount: Prisma.Decimal,
    purchaseOrderId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>`
      SELECT id, balance FROM "SupplierAccount"
      WHERE "tenantId" = ${tenantId}::uuid AND "supplierId" = ${supplierId}::uuid
      FOR UPDATE
    `;

    let accountId: string;
    let newBalance: Prisma.Decimal;
    if (rows.length === 0) {
      newBalance = amount;
      const created = await tx.supplierAccount.create({
        data: { id: newId(), tenantId, supplierId, balance: newBalance },
      });
      accountId = created.id;
    } else {
      accountId = rows[0].id;
      newBalance = rows[0].balance.plus(amount);
      await tx.supplierAccount.update({ where: { id: accountId }, data: { balance: newBalance } });
    }

    await tx.supplierMovement.create({
      data: {
        id: newTransactionalId(),
        tenantId,
        accountId,
        movementType: 'DEBIT',
        amount,
        referenceType: 'purchase_receipt',
        referenceId: purchaseOrderId,
      },
    });
  }

  async recordPayment(tenantId: string, supplierId: string, amount: Prisma.Decimal, method: string) {
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Le montant du paiement doit être strictement positif');
    }
    return this.db.run(tenantId, async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>`
        SELECT id, balance FROM "SupplierAccount"
        WHERE "tenantId" = ${tenantId}::uuid AND "supplierId" = ${supplierId}::uuid
        FOR UPDATE
      `;
      if (rows.length === 0) {
        throw new NotFoundException('Aucune dette envers ce fournisseur');
      }
      const newBalance = rows[0].balance.minus(amount);
      if (newBalance.isNegative()) {
        throw new BadRequestException(
          `Le paiement (${amount.toString()}) dépasse la dette due (${rows[0].balance.toString()})`,
        );
      }

      await tx.supplierAccount.update({ where: { id: rows[0].id }, data: { balance: newBalance } });
      await tx.supplierMovement.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          accountId: rows[0].id,
          movementType: 'CREDIT',
          amount,
          method,
          referenceType: 'payment',
          referenceId: newId(),
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'suppliers.balance.updated',
          payload: {
            entityType: 'SupplierAccount',
            entityId: rows[0].id,
            supplierId,
            delta: amount.negated().toString(),
            newBalance: newBalance.toString(),
          },
        },
      });

      return tx.supplierAccount.findFirst({ where: { id: rows[0].id } });
    });
  }
}

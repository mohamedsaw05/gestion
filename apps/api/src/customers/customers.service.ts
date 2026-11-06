import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SETTINGS, newId, newTransactionalId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

@Injectable()
export class CustomersService {
  constructor(private readonly db: PrismaTenantService) {}

  async list(tenantId: string) {
    return this.db.run(tenantId, async (tx) => {
      const customers = await tx.customer.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      if (customers.length === 0) return [];

      const customerIds = customers.map((c) => c.id);
      const accounts = await tx.creditAccount.findMany({
        where: { tenantId, customerId: { in: customerIds } },
      });
      const accountMap = new Map(accounts.map((a) => [a.customerId, a]));

      return customers.map((c) => ({
        ...c,
        creditAccount: accountMap.get(c.id) ? { balance: accountMap.get(c.id)!.balance } : null,
      }));
    });
  }

  async getById(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!customer) throw new NotFoundException('Client introuvable');

      const creditAccount = await tx.creditAccount.findUnique({
        where: { tenantId_customerId: { tenantId, customerId: id } },
      });

      let movements: any[] = [];
      if (creditAccount) {
        movements = await tx.creditMovement.findMany({
          where: { tenantId, accountId: creditAccount.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      }

      const sales = await tx.sale.findMany({
        where: { tenantId, customerId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          lines: true,
          payments: true,
          documents: { select: { id: true, number: true, type: true } },
        },
      });

      return {
        ...customer,
        creditAccount: creditAccount
          ? {
              ...creditAccount,
              movements,
            }
          : null,
        sales,
      };
    });
  }

  async getStatement(tenantId: string, customerId: string, from?: string, to?: string) {
    return this.db.run(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, tenantId, deletedAt: null },
      });
      if (!customer) throw new NotFoundException('Client introuvable');

      const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const toDate = to ? new Date(to) : new Date();

      const [sales, creditAccount, organizationSetting] = await Promise.all([
        tx.sale.findMany({
          where: {
            tenantId,
            customerId,
            deletedAt: null,
            createdAt: { gte: fromDate, lte: toDate },
          },
          include: { lines: true, payments: true, documents: true },
          orderBy: { createdAt: 'asc' },
        }),
        tx.creditAccount.findUnique({
          where: { tenantId_customerId: { tenantId, customerId } },
        }),
        tx.tenantSetting.findFirst({
          where: { tenantId, key: SETTINGS.ORGANIZATION_LEGAL_NAME },
        }),
      ]);

      let movements: any[] = [];
      if (creditAccount) {
        movements = await tx.creditMovement.findMany({
          where: {
            tenantId,
            accountId: creditAccount.id,
            createdAt: { gte: fromDate, lte: toDate },
          },
          orderBy: { createdAt: 'asc' },
        });
      }

      const totalPurchases = sales.reduce((acc: number, s: any) => acc + Number(s.grandTotal), 0);
      const totalPayments = sales.reduce((acc: number, s: any) => acc + Number(s.amountPaid), 0);
      const totalBalanceDue = sales.reduce((acc: number, s: any) => acc + Number(s.balanceDue), 0);

      let orgName = 'GESTIONNAIRE SAAS';
      if (organizationSetting?.value) {
        if (typeof organizationSetting.value === 'string') {
          orgName = organizationSetting.value;
        } else {
          orgName = String(organizationSetting.value);
        }
      }

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          creditLimit: customer.creditLimit ? customer.creditLimit.toString() : null,
        },
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        summary: {
          totalPurchases,
          totalPayments,
          totalBalanceDue,
          currentOutstandingDebt: creditAccount ? Number(creditAccount.balance) : 0,
        },
        sales,
        movements,
        organizationName: orgName,
      };
    });
  }

  async create(tenantId: string, name: string, phone?: string, email?: string) {
    const trimmed = name?.trim();
    if (!trimmed) throw new BadRequestException('Le nom du client est obligatoire');
    return this.db.run(tenantId, (tx) =>
      tx.customer.create({ data: { id: newId(), tenantId, name: trimmed, phone: phone?.trim() || null, email: email?.trim() || null } }),
    );
  }

  async update(tenantId: string, id: string, name?: string, phone?: string, email?: string) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.customer.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) throw new NotFoundException('Client introuvable');

      const data: Prisma.CustomerUpdateInput = {};
      if (name !== undefined) {
        const trimmed = name.trim();
        if (!trimmed) throw new BadRequestException('Le nom du client ne peut pas être vide');
        data.name = trimmed;
      }
      if (phone !== undefined) data.phone = phone.trim() || null;
      if (email !== undefined) data.email = email.trim() || null;

      return tx.customer.update({ where: { id }, data });
    });
  }

  async archive(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!customer) throw new NotFoundException('Client introuvable');

      // Vérifier s'il a un solde débiteur non nul
      const credit = await tx.creditAccount.findUnique({
        where: { tenantId_customerId: { tenantId, customerId: id } },
      });
      if (credit && !credit.balance.isZero()) {
        throw new BadRequestException(
          `Impossible d'archiver un client avec un solde de crédit en cours (${credit.balance.toString()})`,
        );
      }

      return tx.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  async merge(tenantId: string, actorUserId: string, sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      throw new BadRequestException('Le client source et le client cible doivent être différents');
    }

    return this.db.run(tenantId, async (tx) => {
      const [source, target] = await Promise.all([
        tx.customer.findFirst({ where: { id: sourceId, tenantId, deletedAt: null } }),
        tx.customer.findFirst({ where: { id: targetId, tenantId, deletedAt: null } }),
      ]);
      if (!source) throw new NotFoundException('Client source introuvable');
      if (!target) throw new NotFoundException('Client cible introuvable');

      // 1. Réassigner toutes les ventes de source vers target
      await tx.sale.updateMany({
        where: { tenantId, customerId: sourceId },
        data: { customerId: targetId },
      });

      // 2. Fusionner le compte de crédit si le client source a un solde ou un compte
      const sourceCredit = await tx.creditAccount.findUnique({
        where: { tenantId_customerId: { tenantId, customerId: sourceId } },
      });
      if (sourceCredit) {
        let targetCredit = await tx.creditAccount.findUnique({
          where: { tenantId_customerId: { tenantId, customerId: targetId } },
        });
        if (!targetCredit) {
          targetCredit = await tx.creditAccount.create({
            data: {
              id: newId(),
              tenantId,
              customerId: targetId,
              balance: new Prisma.Decimal(0),
            },
          });
        }

        if (!sourceCredit.balance.isZero()) {
          const newTargetBalance = targetCredit.balance.plus(sourceCredit.balance);
          await tx.creditAccount.update({
            where: { id: targetCredit.id },
            data: { balance: newTargetBalance },
          });

          // Créer un mouvement d'audit du transfert de solde
          await tx.creditMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              accountId: targetCredit.id,
              movementType: 'DEBIT',
              amount: sourceCredit.balance,
              referenceType: 'customer_merge',
              referenceId: newId(),
            },
          });
        }

        // Mettre à 0 le solde source avant archivage
        await tx.creditAccount.update({
          where: { id: sourceCredit.id },
          data: { balance: new Prisma.Decimal(0) },
        });
      }

      // 3. Soft-delete le contact source
      await tx.customer.update({
        where: { id: sourceId },
        data: { deletedAt: new Date() },
      });

      // 4. Émettre un événement d'audit outbox
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'customer.merged',
          payload: {
            actorUserId,
            sourceCustomerId: sourceId,
            sourceCustomerName: source.name,
            targetCustomerId: targetId,
            targetCustomerName: target.name,
          },
        },
      });

      return {
        success: true,
        sourceCustomerId: sourceId,
        targetCustomerId: targetId,
        targetCustomerName: target.name,
      };
    });
  }

  /**
   * Importation CSV robuste avec parsing, validation ligne par ligne et mode prévisualisation (dryRun)
   */
  async importCsv(tenantId: string, csvContent: string, dryRun = false) {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new BadRequestException('Le fichier CSV doit contenir un en-tête et au moins une ligne de données');
    }

    const header = lines[0].toLowerCase().split(/[,;]/).map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const nameIdx = header.findIndex((h) => h.includes('nom') || h === 'name');
    const phoneIdx = header.findIndex((h) => h.includes('tel') || h.includes('phone'));
    const emailIdx = header.findIndex((h) => h.includes('email') || h.includes('courriel'));

    if (nameIdx === -1) {
      throw new BadRequestException('Colonne "nom" ou "name" obligatoire dans l\'en-tête CSV');
    }

    const errors: { row: number; reason: string; raw: string }[] = [];
    const validRows: { name: string; phone?: string; email?: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const name = cols[nameIdx]?.trim();
      const phone = phoneIdx !== -1 ? cols[phoneIdx]?.trim() || undefined : undefined;
      const email = emailIdx !== -1 ? cols[emailIdx]?.trim() || undefined : undefined;

      if (!name) {
        errors.push({ row: i + 1, reason: 'Nom manquant ou vide', raw: line });
        continue;
      }

      if (email && !email.includes('@')) {
        errors.push({ row: i + 1, reason: `Adresse email invalide: "${email}"`, raw: line });
        continue;
      }

      validRows.push({ name, phone, email });
    }

    if (dryRun) {
      return {
        dryRun: true,
        totalRows: lines.length - 1,
        validCount: validRows.length,
        errorCount: errors.length,
        errors,
        preview: validRows.slice(0, 5),
      };
    }

    return this.db.run(tenantId, async (tx) => {
      let createdCount = 0;
      for (const row of validRows) {
        await tx.customer.create({
          data: {
            id: newId(),
            tenantId,
            name: row.name,
            phone: row.phone ?? null,
            email: row.email ?? null,
          },
        });
        createdCount++;
      }

      return {
        dryRun: false,
        totalRows: lines.length - 1,
        createdCount,
        errorCount: errors.length,
        errors,
      };
    });
  }
}

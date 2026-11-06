import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId, newTransactionalId, SETTINGS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { ConfigurationService } from '../config/config.service.js';

/**
 * Credit / Debt Engine (cf docs/architecture/02-moteurs.md §14). Solde
 * toujours recalculable depuis le journal append-only CreditMovement (même
 * principe que le stock, cf docs/architecture/03-modele-donnees.md §3.2).
 */
@Injectable()
export class CreditService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly config: ConfigurationService,
  ) {}

  /**
   * DOIT être appelé DANS la transaction de la vente (cf SalesService) —
   * l'écriture de la dette et la vente qui l'a créée sont une seule opération
   * atomique, jamais deux écritures séparées qui pourraient diverger.
   */
  async recordSaleDebt(
    tx: Prisma.TransactionClient,
    tenantId: string,
    customerId: string,
    amount: Prisma.Decimal,
    saleId: string,
  ): Promise<{ accountId: string; newBalance: Prisma.Decimal }> {
    const customer = await tx.customer.findFirst({ where: { id: customerId, tenantId, deletedAt: null } });
    if (!customer) {
      throw new BadRequestException('Client introuvable pour la vente à crédit');
    }

    // Verrouillage pessimiste (même principe que le stock et la numérotation de
    // documents, cf docs/architecture/01-analyse-risques.md §4.3) : deux ventes
    // à crédit concurrentes sur le même client ne peuvent pas toutes les deux
    // dépasser la limite sans que l'une des deux le détecte.
    const rows = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>`
      SELECT id, balance FROM "CreditAccount"
      WHERE "tenantId" = ${tenantId}::uuid AND "customerId" = ${customerId}::uuid
      FOR UPDATE
    `;

    let accountId: string;
    let newBalance: Prisma.Decimal;
    if (rows.length === 0) {
      newBalance = amount;
      const created = await tx.creditAccount.create({
        data: { id: newId(), tenantId, customerId, balance: newBalance },
      });
      accountId = created.id;
    } else {
      accountId = rows[0].id;
      newBalance = rows[0].balance.plus(amount);
      await tx.creditAccount.update({ where: { id: accountId }, data: { balance: newBalance } });
    }

    if (customer.creditLimit && newBalance.greaterThan(customer.creditLimit)) {
      throw new BadRequestException(
        `Limite de crédit dépassée pour ${customer.name} : solde après vente ${newBalance.toString()}, limite autorisée ${customer.creditLimit.toString()}`,
      );
    }

    // Protection financière globale : Taux d'endettement maximal autorisé par le commerce
    if (!customer.creditLimit) {
      const maxDebtRatioSetting = await this.config.getWithTx<string>(tx, tenantId, SETTINGS.CREDIT_MAX_DEBT_RATIO_PERCENT);
      const maxRatio = maxDebtRatioSetting ? Number(maxDebtRatioSetting) : 0;
      if (maxRatio > 0) {
        const salesAgg = await tx.sale.aggregate({
          where: { tenantId, customerId, status: 'COMPLETED' },
          _sum: { grandTotal: true },
        });
        const totalPurchases = salesAgg._sum.grandTotal ? Number(salesAgg._sum.grandTotal) : 0;
        if (totalPurchases > 0) {
          const maxAllowedDebt = (totalPurchases * maxRatio) / 100;
          if (newBalance.greaterThan(maxAllowedDebt)) {
            throw new BadRequestException(
              `Plafond d'endettement dépassé (${maxRatio}% des achats historiques) pour ${customer.name} : solde après vente ${newBalance.toString()}, plafond calculé ${Math.round(maxAllowedDebt)}`,
            );
          }
        }
      }
    }

    await tx.creditMovement.create({
      data: {
        id: newTransactionalId(),
        tenantId,
        accountId,
        movementType: 'DEBIT',
        amount,
        referenceType: 'sale',
        referenceId: saleId,
      },
    });

    await tx.outboxEvent.create({
      data: {
        id: newTransactionalId(),
        tenantId,
        eventType: 'credit.balance.updated',
        payload: {
          entityType: 'CreditAccount',
          entityId: accountId,
          customerId,
          delta: amount.toString(),
          newBalance: newBalance.toString(),
        },
      },
    });

    return { accountId, newBalance };
  }

  async recordRepayment(tenantId: string, customerId: string, amount: Prisma.Decimal, method: string) {
    return this.db.run(tenantId, async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>`
        SELECT id, balance FROM "CreditAccount"
        WHERE "tenantId" = ${tenantId}::uuid AND "customerId" = ${customerId}::uuid
        FOR UPDATE
      `;
      if (rows.length === 0) {
        throw new NotFoundException('Aucun compte de crédit pour ce client');
      }
      const newBalance = rows[0].balance.minus(amount);
      if (newBalance.isNegative()) {
        throw new BadRequestException(
          `Le remboursement (${amount.toString()}) dépasse le solde dû (${rows[0].balance.toString()})`,
        );
      }

      await tx.creditAccount.update({ where: { id: rows[0].id }, data: { balance: newBalance } });
      await tx.creditMovement.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          accountId: rows[0].id,
          movementType: 'CREDIT',
          amount,
          method,
          referenceType: 'repayment',
          referenceId: newId(),
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'credit.balance.updated',
          payload: {
            entityType: 'CreditAccount',
            entityId: rows[0].id,
            customerId,
            delta: amount.negated().toString(),
            newBalance: newBalance.toString(),
          },
        },
      });

      return tx.creditAccount.findFirst({ where: { id: rows[0].id } });
    });
  }

  /**
   * Réduit la créance d'un client dans le cadre d'un retour de marchandise (dette annulée).
   * DOIT être exécuté au sein de la transaction interactive du retour.
   */
  async reduceDebtWithTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    customerId: string,
    amount: Prisma.Decimal,
    returnId: string,
    reason?: string,
  ): Promise<{ accountId: string; debtReduced: Prisma.Decimal; newBalance: Prisma.Decimal }> {
    const rows = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>`
      SELECT id, balance FROM "CreditAccount"
      WHERE "tenantId" = ${tenantId}::uuid AND "customerId" = ${customerId}::uuid
      FOR UPDATE
    `;
    if (rows.length === 0) {
      return { accountId: '', debtReduced: new Prisma.Decimal(0), newBalance: new Prisma.Decimal(0) };
    }
    const currentBalance = rows[0].balance;
    const debtReduced = Prisma.Decimal.min(currentBalance, amount);
    if (debtReduced.lessThanOrEqualTo(0)) {
      return { accountId: rows[0].id, debtReduced: new Prisma.Decimal(0), newBalance: currentBalance };
    }
    const newBalance = currentBalance.minus(debtReduced);

    await tx.creditAccount.update({ where: { id: rows[0].id }, data: { balance: newBalance } });
    await tx.creditMovement.create({
      data: {
        id: newTransactionalId(),
        tenantId,
        accountId: rows[0].id,
        movementType: 'CREDIT',
        amount: debtReduced,
        method: 'DEBT_CANCELLATION',
        referenceType: 'return',
        referenceId: returnId,
      },
    });

    await tx.outboxEvent.create({
      data: {
        id: newTransactionalId(),
        tenantId,
        eventType: 'credit.balance.updated',
        payload: {
          entityType: 'CreditAccount',
          entityId: rows[0].id,
          customerId,
          delta: debtReduced.negated().toString(),
          newBalance: newBalance.toString(),
          reason: reason ?? 'Annulation de créance suite à retour marchandise',
        },
      },
    });

    return { accountId: rows[0].id, debtReduced, newBalance };
  }


  async getAccount(tenantId: string, customerId: string) {
    return this.db.run(tenantId, async (tx) => {
      const account = await tx.creditAccount.findFirst({ where: { tenantId, customerId } });
      const movements = account
        ? await tx.creditMovement.findMany({
            where: { tenantId, accountId: account.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : [];
      return { account, movements };
    });
  }

  async listAccounts(tenantId: string) {
    return this.db.run(tenantId, async (tx) => {
      const accounts = await tx.creditAccount.findMany({
        where: { tenantId, balance: { gt: 0 } },
        orderBy: { balance: 'desc' },
      });
      const customerIds = accounts.map((a) => a.customerId);
      const customers = await tx.customer.findMany({ where: { tenantId, id: { in: customerIds } } });
      const byId = new Map(customers.map((c) => [c.id, c]));
      return accounts.map((a) => ({ ...a, customer: byId.get(a.customerId) ?? null }));
    });
  }

  async sendReminder(
    tenantId: string,
    actorUserId: string,
    customerId: string,
    channel: 'INTERNAL' | 'EMAIL' | 'WHATSAPP' = 'INTERNAL',
  ) {
    return this.db.run(tenantId, async (tx) => {
      const [account, customer] = await Promise.all([
        tx.creditAccount.findUnique({
          where: { tenantId_customerId: { tenantId, customerId } },
        }),
        tx.customer.findFirst({
          where: { id: customerId, tenantId, deletedAt: null },
        }),
      ]);

      if (!customer) throw new NotFoundException('Client introuvable');
      if (!account || account.balance.lessThanOrEqualTo(0)) {
        throw new BadRequestException('Aucune dette en cours pour ce client (créance déjà soldée ou nulle)');
      }

      // Règle de conformité stricte WhatsApp (Section 11.6 et 12 du CDC) :
      // La politique WhatsApp Business Messaging restreint formellement le recouvrement de dettes ("debt collection").
      if (channel === 'WHATSAPP') {
        const allowed = await this.config.getWithTx<boolean>(
          tx,
          tenantId,
          SETTINGS.WHATSAPP_CREDIT_REMINDERS_ENABLED,
        );
        if (!allowed) {
          throw new BadRequestException(
            'Conformité Meta WhatsApp Business Messaging Policy : Le recouvrement et les rappels de créances sont formellement restreints sur WhatsApp. Canal WhatsApp bloqué préventivement. Veuillez utiliser le canal Email ou une relance interne.',
          );
        }
      }

      const reminderId = newTransactionalId();
      await tx.outboxEvent.create({
        data: {
          id: reminderId,
          tenantId,
          eventType: 'credit.reminder.dispatched',
          payload: {
            customerId,
            customerName: customer.name,
            balance: account.balance.toString(),
            channel,
            actorUserId,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        reminderId,
        customerId,
        customerName: customer.name,
        balanceDue: account.balance.toString(),
        channel,
        sentAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Système de Scoring et Risque Client (solvabilité, taux d'endettement, historique, pénalités)
   */
  async getCustomerScoring(tenantId: string, customerId: string) {
    return this.db.run(tenantId, async (tx) => {
      const [customer, account, movements, sales] = await Promise.all([
        tx.customer.findFirst({ where: { id: customerId, tenantId, deletedAt: null } }),
        tx.creditAccount.findUnique({ where: { tenantId_customerId: { tenantId, customerId } } }),
        tx.creditMovement.findMany({
          where: { tenantId, account: { customerId } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        tx.sale.findMany({
          where: { tenantId, customerId, status: 'COMPLETED' },
          select: { grandTotal: true, createdAt: true },
        }),
      ]);

      if (!customer) throw new NotFoundException('Client introuvable');

      const balance = account ? Number(account.balance) : 0;
      const totalPurchases = sales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
      const totalRepayments = movements
        .filter((m) => m.movementType === 'CREDIT')
        .reduce((sum, m) => sum + Number(m.amount), 0);

      // Paramètres centraux
      const defaultTermDays = Number(await this.config.getWithTx<string>(tx, tenantId, SETTINGS.DEFAULT_CREDIT_TERM_DAYS)) || 30;
      const maxDebtRatio = Number(await this.config.getWithTx<string>(tx, tenantId, SETTINGS.CREDIT_MAX_DEBT_RATIO_PERCENT)) || 30;
      const latePenaltyDailyRate = Number(await this.config.getWithTx<string>(tx, tenantId, SETTINGS.CREDIT_LATE_PENALTY_DAILY_RATE)) || 0.1;

      // Calcul des retards
      let daysOverdue = 0;
      if (balance > 0) {
        const debits = movements.filter((m) => m.movementType === 'DEBIT');
        if (debits.length > 0) {
          const oldestDebit = debits[debits.length - 1];
          const diffDays = Math.floor((Date.now() - oldestDebit.createdAt.getTime()) / (1000 * 60 * 60 * 24));
          daysOverdue = Math.max(0, diffDays - defaultTermDays);
        }
      }

      // Pénalités de retard accumulées
      const accruedLatePenalty = daysOverdue > 0 ? balance * (latePenaltyDailyRate / 100) * daysOverdue : 0;

      // Taux d'endettement effectif
      const effectiveDebtRatio = totalPurchases > 0 ? (balance / totalPurchases) * 100 : (balance > 0 ? 100 : 0);

      // Calcul du Score (A, B, C, D)
      let score: 'A' | 'B' | 'C' | 'D' = 'A';
      let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
      let recommendation: 'APPROVE' | 'WARN' | 'SUSPEND' = 'APPROVE';

      if (daysOverdue > 30 || effectiveDebtRatio > maxDebtRatio * 2) {
        score = 'D';
        riskLevel = 'CRITICAL';
        recommendation = 'SUSPEND';
      } else if (daysOverdue > 7 || effectiveDebtRatio > maxDebtRatio) {
        score = 'C';
        riskLevel = 'HIGH';
        recommendation = 'WARN';
      } else if (daysOverdue > 0 || effectiveDebtRatio > maxDebtRatio * 0.7) {
        score = 'B';
        riskLevel = 'MODERATE';
        recommendation = 'APPROVE';
      } else {
        score = 'A';
        riskLevel = 'LOW';
        recommendation = 'APPROVE';
      }

      return {
        customerId,
        customerName: customer.name,
        creditLimit: customer.creditLimit ? customer.creditLimit.toString() : null,
        currentBalance: balance,
        totalPurchases,
        totalRepayments,
        effectiveDebtRatio: Math.round(effectiveDebtRatio * 10) / 10,
        maxAllowedDebtRatio: maxDebtRatio,
        defaultTermDays,
        daysOverdue,
        accruedLatePenalty: Math.round(accruedLatePenalty),
        latePenaltyDailyRate,
        score,
        riskLevel,
        recommendation,
      };
    });
  }

  /**
   * Moteur d'Amortissement Dynamique (Annuités constantes, Capital fixe, Échéances libres)
   */
  simulateSchedule(params: {
    principal: number;
    rate: number;
    periods: number;
    method?: 'CONSTANT_ANNUITY' | 'CONSTANT_CAPITAL' | 'FREE_SCHEDULE';
  }) {
    const P = Math.max(1, params.principal);
    const n = Math.max(1, params.periods);
    const r = Math.max(0, params.rate) / 100;
    const method = params.method ?? 'CONSTANT_ANNUITY';

    const rows: Array<{
      period: number;
      dueDate: string;
      principal: number;
      interest: number;
      total: number;
      balance: number;
    }> = [];

    let remaining = P;
    const now = new Date();

    if (method === 'CONSTANT_CAPITAL') {
      const fixedPrincipal = P / n;
      for (let i = 1; i <= n; i++) {
        const interest = remaining * r;
        const total = fixedPrincipal + interest;
        remaining = Math.max(0, remaining - fixedPrincipal);
        const d = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
        rows.push({
          period: i,
          dueDate: d.toISOString().split('T')[0],
          principal: Math.round(fixedPrincipal),
          interest: Math.round(interest),
          total: Math.round(total),
          balance: Math.round(remaining),
        });
      }
    } else if (method === 'CONSTANT_ANNUITY') {
      const annuity = r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
      for (let i = 1; i <= n; i++) {
        const interest = remaining * r;
        const principalPart = annuity - interest;
        remaining = Math.max(0, remaining - principalPart);
        const d = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
        rows.push({
          period: i,
          dueDate: d.toISOString().split('T')[0],
          principal: Math.round(principalPart),
          interest: Math.round(interest),
          total: Math.round(annuity),
          balance: Math.round(remaining),
        });
      }
    } else {
      const part = P / n;
      for (let i = 1; i <= n; i++) {
        remaining = Math.max(0, remaining - part);
        const d = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
        rows.push({
          period: i,
          dueDate: d.toISOString().split('T')[0],
          principal: Math.round(part),
          interest: 0,
          total: Math.round(part),
          balance: Math.round(remaining),
        });
      }
    }

    return {
      principal: P,
      rate: params.rate,
      periods: n,
      method,
      totalInterest: rows.reduce((s, r) => s + r.interest, 0),
      totalDue: rows.reduce((s, r) => s + r.total, 0),
      schedule: rows,
    };
  }
}


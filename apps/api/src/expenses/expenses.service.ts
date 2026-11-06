import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { CreateExpenseDto, ExpenseFilterDto } from './dto/expense.dto.js';

@Injectable()
export class ExpensesService {
  constructor(private readonly db: PrismaTenantService) {}

  async listExpenses(tenantId: string, query: ExpenseFilterDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      tenantId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: 'insensitive' } },
              { beneficiary: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.db.run(tenantId, async (tx) => {
      const [items, total, aggregate] = await Promise.all([
        tx.expense.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        tx.expense.count({ where }),
        tx.expense.aggregate({
          where,
          _sum: { amount: true },
        }),
      ]);

      return {
        data: items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalAmount: aggregate._sum.amount ? aggregate._sum.amount.toString() : '0',
      };
    });
  }

  async getExpenseDetail(tenantId: string, id: string) {
    const expense = await this.db.run(tenantId, (tx) =>
      tx.expense.findFirst({
        where: { id, tenantId },
      }),
    );
    if (!expense) throw new NotFoundException('Dépense introuvable');
    return expense;
  }

  async createExpense(tenantId: string, userId: string, dto: CreateExpenseDto) {
    const amountNum = parseFloat(dto.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Le montant de la dépense doit être strictement supérieur à 0');
    }

    const expenseId = newId();
    const paymentMethod = dto.paymentMethod || 'CASH';

    return this.db.run(tenantId, async (tx) => {
      let cashSessionId: string | null = null;

      // Réconciliation avec la caisse : si paiement en espèces et emplacement fourni,
      // rattacher à la session de caisse ouverte et créer le mouvement de sortie de caisse
      if (paymentMethod === 'CASH' && dto.locationId) {
        const openSession = await tx.cashSession.findFirst({
          where: {
            tenantId,
            locationId: dto.locationId,
            status: 'OPEN',
          },
        });

        if (openSession) {
          cashSessionId = openSession.id;
          await tx.cashMovement.create({
            data: {
              id: newId(),
              tenantId,
              sessionId: openSession.id,
              type: 'CASH_OUT',
              amount: new Prisma.Decimal(dto.amount),
              reason: `Dépense [${dto.category}]: ${dto.description}`,
              createdByUserId: userId,
            },
          });
        }
      }

      // Statut par défaut : APPROVED, ou PENDING_APPROVAL si montant élevé (> 500 000 XOF)
      const isHighAmount = amountNum >= 500000;
      const initialStatus = isHighAmount ? 'PENDING_APPROVAL' : 'APPROVED';

      const expense = await tx.expense.create({
        data: {
          id: expenseId,
          tenantId,
          locationId: dto.locationId || null,
          category: dto.category,
          amount: new Prisma.Decimal(dto.amount),
          currency: dto.currency || 'XOF',
          description: dto.description,
          beneficiary: dto.beneficiary || null,
          paymentMethod,
          cashSessionId,
          status: initialStatus,
          receiptUrl: dto.receiptUrl || null,
          attachmentId: dto.attachmentId || null,
          isRecurring: dto.isRecurring || false,
          recurrenceInterval: dto.recurrenceInterval || null,
          createdByUserId: userId,
          approvedByUserId: initialStatus === 'APPROVED' ? userId : null,
          paidAt: initialStatus === 'APPROVED' ? new Date() : null,
        },
      });

      return expense;
    });
  }

  async approveExpense(tenantId: string, userId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id, tenantId } });
      if (!expense) throw new NotFoundException('Dépense introuvable');
      if (expense.status === 'APPROVED') {
        throw new BadRequestException('Cette dépense est déjà approuvée');
      }

      return tx.expense.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedByUserId: userId,
          paidAt: expense.paidAt || new Date(),
        },
      });
    });
  }

  async rejectExpense(tenantId: string, userId: string, id: string, reason: string) {
    return this.db.run(tenantId, async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id, tenantId } });
      if (!expense) throw new NotFoundException('Dépense introuvable');

      return tx.expense.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedReason: reason,
        },
      });
    });
  }

  async deleteExpense(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id, tenantId } });
      if (!expense) throw new NotFoundException('Dépense introuvable');
      if (expense.status === 'APPROVED') {
        throw new BadRequestException(
          'Une dépense approuvée ne peut pas être supprimée silencieusement. Rejetez-la avec un motif pour conserver la traçabilité financière.',
        );
      }

      await tx.expense.delete({ where: { id } });
      return { success: true, message: 'Dépense supprimée' };
    });
  }

  async getExpenseSummary(tenantId: string, options?: { from?: string; to?: string }) {
    const where: Prisma.ExpenseWhereInput = {
      tenantId,
      status: 'APPROVED',
      ...(options?.from || options?.to
        ? {
            createdAt: {
              ...(options?.from ? { gte: new Date(options.from) } : {}),
              ...(options?.to ? { lte: new Date(options.to) } : {}),
            },
          }
        : {}),
    };

    return this.db.run(tenantId, async (tx) => {
      const [byCategory, totalAgg] = await Promise.all([
        tx.expense.groupBy({
          by: ['category'],
          where,
          _sum: { amount: true },
          _count: { id: true },
        }),
        tx.expense.aggregate({
          where,
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      return {
        totalAmount: totalAgg._sum.amount?.toString() || '0',
        totalCount: totalAgg._count.id || 0,
        categories: byCategory.map((cat) => ({
          category: cat.category,
          totalAmount: cat._sum.amount?.toString() || '0',
          count: cat._count.id,
        })),
      };
    });
  }
}

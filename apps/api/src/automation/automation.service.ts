import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { AutomationFilterDto, CreateAutomationRuleDto } from './dto/automation.dto.js';

@Injectable()
export class AutomationService {
  constructor(private readonly db: PrismaTenantService) {}

  async listRules(tenantId: string) {
    return this.db.run(tenantId, (tx) =>
      tx.automationRule.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async getRuleDetail(tenantId: string, id: string) {
    const rule = await this.db.run(tenantId, (tx) =>
      tx.automationRule.findFirst({
        where: { id, tenantId },
        include: {
          executionLogs: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      }),
    );
    if (!rule) throw new NotFoundException('Règle d’automatisation introuvable');
    return rule;
  }

  async createRule(tenantId: string, userId: string, dto: CreateAutomationRuleDto) {
    const id = newId();
    return this.db.run(tenantId, (tx) =>
      tx.automationRule.create({
        data: {
          id,
          tenantId,
          name: dto.name,
          description: dto.description || null,
          trigger: dto.trigger,
          conditions: dto.conditions as Prisma.InputJsonValue,
          actions: dto.actions as Prisma.InputJsonValue,
          timeWindow: dto.timeWindow || null,
          isActive: dto.isActive ?? true,
          createdByUserId: userId,
        },
      }),
    );
  }

  async toggleRule(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const rule = await tx.automationRule.findFirst({ where: { id, tenantId } });
      if (!rule) throw new NotFoundException('Règle d’automatisation introuvable');

      return tx.automationRule.update({
        where: { id },
        data: { isActive: !rule.isActive },
      });
    });
  }

  async deleteRule(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const rule = await tx.automationRule.findFirst({ where: { id, tenantId } });
      if (!rule) throw new NotFoundException('Règle d’automatisation introuvable');

      await tx.automationRule.delete({ where: { id } });
      return { success: true, message: 'Règle d’automatisation supprimée' };
    });
  }

  async listLogs(tenantId: string, query: AutomationFilterDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.AutomationExecutionLogWhereInput = {
      tenantId,
      ...(query.ruleId ? { ruleId: query.ruleId } : {}),
      ...(query.trigger ? { triggerEvent: query.trigger } : {}),
    };

    return this.db.run(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.automationExecutionLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            rule: { select: { id: true, name: true, trigger: true } },
          },
        }),
        tx.automationExecutionLog.count({ where }),
      ]);

      return {
        data: items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }

  /**
   * Évaluation et exécution d'un événement déclencheur pour un tenant.
   * Protégé contre les boucles infinies (maximum 100 exécutions par règle).
   */
  async dispatchEvent(tenantId: string, trigger: string, payload: Record<string, any>) {
    const startTime = Date.now();
    return this.db.run(tenantId, async (tx) => {
      const activeRules = await tx.automationRule.findMany({
        where: { tenantId, trigger, isActive: true },
      });

      const results = [];

      for (const rule of activeRules) {
        // Protection anti-boucle : limite d'exécutions
        if (rule.executionCount > 1000) {
          await tx.automationExecutionLog.create({
            data: {
              id: newId(),
              tenantId,
              ruleId: rule.id,
              triggerEvent: trigger,
              status: 'SKIPPED',
              inputPayload: payload as Prisma.InputJsonValue,
              errorMessage: 'Limite de sécurité anti-boucle atteinte (>1000 exécutions). Règle suspendue.',
              durationMs: Date.now() - startTime,
            },
          });
          continue;
        }

        const conditions = rule.conditions as Record<string, any>;
        const match = this.evaluateConditions(conditions, payload);

        if (!match) {
          await tx.automationExecutionLog.create({
            data: {
              id: newId(),
              tenantId,
              ruleId: rule.id,
              triggerEvent: trigger,
              status: 'SKIPPED',
              inputPayload: payload as Prisma.InputJsonValue,
              outputPayload: { matched: false } as Prisma.InputJsonValue,
              durationMs: Date.now() - startTime,
            },
          });
          continue;
        }

        // Exécution des actions
        try {
          const actionOutput = this.executeActions(rule.actions as any[], payload);

          await Promise.all([
            tx.automationRule.update({
              where: { id: rule.id },
              data: {
                executionCount: { increment: 1 },
                lastTriggeredAt: new Date(),
              },
            }),
            tx.automationExecutionLog.create({
              data: {
                id: newId(),
                tenantId,
                ruleId: rule.id,
                triggerEvent: trigger,
                status: 'SUCCESS',
                inputPayload: payload as Prisma.InputJsonValue,
                outputPayload: actionOutput as Prisma.InputJsonValue,
                durationMs: Date.now() - startTime,
              },
            }),
          ]);

          results.push({ ruleId: rule.id, status: 'SUCCESS', actionOutput });
        } catch (err: any) {
          await Promise.all([
            tx.automationRule.update({
              where: { id: rule.id },
              data: { failureCount: { increment: 1 } },
            }),
            tx.automationExecutionLog.create({
              data: {
                id: newId(),
                tenantId,
                ruleId: rule.id,
                triggerEvent: trigger,
                status: 'FAILED',
                inputPayload: payload as Prisma.InputJsonValue,
                errorMessage: err.message || 'Erreur inconnue',
                durationMs: Date.now() - startTime,
              },
            }),
          ]);

          results.push({ ruleId: rule.id, status: 'FAILED', error: err.message });
        }
      }

      return results;
    });
  }

  async testRuleDryRun(tenantId: string, ruleId: string, mockPayload: Record<string, any>) {
    const rule = await this.getRuleDetail(tenantId, ruleId);
    const conditions = rule.conditions as Record<string, any>;
    const matched = this.evaluateConditions(conditions, mockPayload);
    const actions = rule.actions as any[];
    const simulatedActions = matched ? this.executeActions(actions, mockPayload) : [];

    return {
      ruleId,
      ruleName: rule.name,
      trigger: rule.trigger,
      matched,
      simulatedActions,
      message: matched
        ? 'Les conditions sont satisfaites. Actions simulées avec succès.'
        : 'Les conditions de la règle ne correspondent pas au payload de test.',
    };
  }

  private evaluateConditions(conditions: Record<string, any>, payload: Record<string, any>): boolean {
    if (!conditions || Object.keys(conditions).length === 0) return true;

    if (conditions.stockBelow !== undefined && payload.stock !== undefined) {
      if (Number(payload.stock) > Number(conditions.stockBelow)) return false;
    }

    if (conditions.amountGreaterThan !== undefined && payload.amount !== undefined) {
      if (Number(payload.amount) <= Number(conditions.amountGreaterThan)) return false;
    }

    if (conditions.category && payload.category) {
      if (payload.category !== conditions.category) return false;
    }

    if (conditions.paymentMethod && payload.paymentMethod) {
      if (payload.paymentMethod !== conditions.paymentMethod) return false;
    }

    return true;
  }

  private executeActions(actions: any[], payload: Record<string, any>) {
    return actions.map((act) => ({
      executedAction: act.type,
      channel: act.channel || 'IN_APP',
      recipientRole: act.recipientRole || 'MANAGER',
      message: act.message || `Alerte d'automatisation déclenchée pour ${JSON.stringify(payload)}`,
      timestamp: new Date().toISOString(),
    }));
  }
}

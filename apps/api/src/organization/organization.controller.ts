import { BadRequestException, Body, Controller, Get, Post, Query, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import * as argon2 from 'argon2';
import { newTransactionalId, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { ResetTenantDto } from './dto/reset-tenant.dto.js';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly db: PrismaTenantService) {}

  @Get('export')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async exportTenantData(
    @CurrentUser() user: AuthenticatedUser,
    @Query('format') format: string = 'json',
    @Res() res: Response,
  ) {
    const data = await this.db.run(user.tenantId, async (tx) => {
      const [
        tenant,
        locations,
        modules,
        settings,
        products,
        barcodes,
        customers,
        creditAccounts,
        suppliers,
        stockLevels,
        expenses,
        automationRules,
        progressiveCases,
        progressiveMovements,
        warranties,
        salesCount,
      ] = await Promise.all([
        tx.tenant.findUnique({ where: { id: user.tenantId } }),
        tx.location.findMany({ where: { tenantId: user.tenantId, deletedAt: null } }),
        tx.tenantModule.findMany({ where: { tenantId: user.tenantId } }),
        tx.tenantSetting.findMany({ where: { tenantId: user.tenantId } }),
        tx.product.findMany({
          where: { tenantId: user.tenantId, deletedAt: null },
        }),
        tx.productBarcode.findMany({ where: { tenantId: user.tenantId } }),
        tx.customer.findMany({ where: { tenantId: user.tenantId, deletedAt: null } }),
        tx.creditAccount.findMany({ where: { tenantId: user.tenantId } }),
        tx.supplier.findMany({ where: { tenantId: user.tenantId, deletedAt: null } }),
        tx.stockLevel.findMany({ where: { tenantId: user.tenantId } }),
        tx.expense.findMany({ where: { tenantId: user.tenantId } }),
        tx.automationRule.findMany({ where: { tenantId: user.tenantId } }),
        tx.progressivePurchaseCase.findMany({ where: { tenantId: user.tenantId } }),
        tx.progressivePurchaseMovement.findMany({ where: { tenantId: user.tenantId } }),
        tx.warranty.findMany({ where: { tenantId: user.tenantId } }),
        tx.sale.count({ where: { tenantId: user.tenantId } }),
      ]);

      const barcodeMap = new Map<string, string[]>();
      for (const b of barcodes) {
        const list = barcodeMap.get(b.productId) ?? [];
        list.push(b.code);
        barcodeMap.set(b.productId, list);
      }

      const productsWithBarcodes = products.map((p) => ({
        ...p,
        barcodes: barcodeMap.get(p.id) ?? [],
      }));

      return {
        exportedAt: new Date().toISOString(),
        tenant: {
          id: tenant?.id,
          name: tenant?.name,
          status: tenant?.status,
          createdAt: tenant?.createdAt,
        },
        locations,
        modules,
        settings,
        catalog: {
          productCount: products.length,
          products: productsWithBarcodes,
        },
        customers: {
          customerCount: customers.length,
          customers,
          creditAccounts,
        },
        suppliers: {
          supplierCount: suppliers.length,
          suppliers,
        },
        inventory: {
          levelsCount: stockLevels.length,
          stockLevels,
        },
        finance: {
          expenseCount: expenses.length,
          expenses,
        },
        automation: {
          ruleCount: automationRules.length,
          rules: automationRules,
        },
        progressivePurchases: { cases: progressiveCases, movements: progressiveMovements },
        warranties,
        statistics: {
          totalSalesRecorded: salesCount,
        },
      };
    });

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format.toLowerCase() === 'sql') {
      const sqlStatements: string[] = [
        `-- =========================================================================`,
        `-- GESTIONNAIRE SAAS - EXPORT PORTABILITÉ CLIENT TENANT ISOLE`,
        `-- Tenant ID: ${user.tenantId}`,
        `-- Organisation: ${data.tenant.name}`,
        `-- Date d'export: ${data.exportedAt}`,
        `-- =========================================================================`,
        `BEGIN;`,
        ``,
        `-- 1. Configuration & Emplacements`,
      ];

      for (const loc of data.locations) {
        sqlStatements.push(
          `INSERT INTO "Location" ("id", "tenantId", "name", "type", "createdAt") VALUES ('${loc.id}', '${loc.tenantId}', '${loc.name.replace(/'/g, "''")}', '${loc.type}', '${loc.createdAt.toISOString()}');`,
        );
      }

      sqlStatements.push(`\n-- 2. Produits & Catalogue`);
      for (const prod of data.catalog.products) {
        sqlStatements.push(
          `INSERT INTO "Product" ("id", "tenantId", "name", "sku", "basePrice", "createdAt") VALUES ('${prod.id}', '${prod.tenantId}', '${prod.name.replace(/'/g, "''")}', '${prod.sku.replace(/'/g, "''")}', ${prod.basePrice}, '${prod.createdAt.toISOString()}');`,
        );
      }

      sqlStatements.push(`\n-- 3. Clients & Crédit`);
      for (const cust of data.customers.customers) {
        const phone = cust.phone ? `'${cust.phone.replace(/'/g, "''")}'` : 'NULL';
        sqlStatements.push(
          `INSERT INTO "Customer" ("id", "tenantId", "name", "phone", "createdAt") VALUES ('${cust.id}', '${cust.tenantId}', '${cust.name.replace(/'/g, "''")}', ${phone}, '${cust.createdAt.toISOString()}');`,
        );
      }

      sqlStatements.push(`\n-- 4. Dépenses Opérationnelles`);
      for (const exp of data.finance.expenses) {
        const loc = exp.locationId ? `'${exp.locationId}'` : 'NULL';
        const ben = exp.beneficiary ? `'${exp.beneficiary.replace(/'/g, "''")}'` : 'NULL';
        sqlStatements.push(
          `INSERT INTO "Expense" ("id", "tenantId", "locationId", "category", "amount", "currency", "description", "beneficiary", "paymentMethod", "status", "createdAt") VALUES ('${exp.id}', '${exp.tenantId}', ${loc}, '${exp.category}', ${exp.amount}, '${exp.currency}', '${exp.description.replace(/'/g, "''")}', ${ben}, '${exp.paymentMethod}', '${exp.status}', '${exp.createdAt.toISOString()}');`,
        );
      }

      sqlStatements.push(`\nCOMMIT;`);
      const sqlContent = sqlStatements.join('\n');
      const filename = `tenant-export-${user.tenantId}-${dateStr}.sql`;
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(sqlContent);
    }

    const filename = `tenant-export-${user.tenantId}-${dateStr}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(data, null, 2));
  }

  @Post('reset')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async resetTenantData(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResetTenantDto,
  ) {
    if (dto.confirmationPhrase.trim() !== 'REINITIALISER MON GESTIONNAIRE') {
      throw new BadRequestException(
        'Phrase de confirmation invalide. Vous devez taper exactement : REINITIALISER MON GESTIONNAIRE',
      );
    }

    return this.db.run(user.tenantId, async (tx) => {
      // 1. Vérifier le mot de passe du gestionnaire
      const currentUser = await tx.user.findFirst({
        where: { id: user.userId, tenantId: user.tenantId, deletedAt: null },
      });
      if (!currentUser) throw new UnauthorizedException('Utilisateur introuvable');

      const isPasswordValid = await argon2.verify(currentUser.passwordHash, dto.password);
      if (!isPasswordValid) {
        throw new BadRequestException('Mot de passe incorrect. La réinitialisation a été refusée.');
      }

      // 2. Supprimer toutes les données opérationnelles UNIQUEMENT pour ce tenant
      // Ventes, paiements et documents associés
      await tx.saleLine.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.progressivePurchaseMovement.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.progressivePurchaseCase.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.payment.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.document.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.sale.deleteMany({ where: { tenantId: user.tenantId } });

      // Crédit
      await tx.creditMovement.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.creditAccount.deleteMany({ where: { tenantId: user.tenantId } });

      // Stocks & mouvements
      await tx.stockMovement.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.stockBatch.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.stockTransferLine.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.stockTransfer.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.stockLevel.updateMany({
        where: { tenantId: user.tenantId },
        data: { quantityOnHand: 0, quantityReserved: 0 },
      });

      // Commandes
      await tx.orderLine.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.order.deleteMany({ where: { tenantId: user.tenantId } });

      // Dépenses & garanties
      await tx.expense.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.warranty.deleteMany({ where: { tenantId: user.tenantId } });

      // Rendez-vous & Réservations
      await tx.appointment.deleteMany({ where: { tenantId: user.tenantId } });

      // Prestations & Ordres de service
      await tx.serviceOrderItem.deleteMany({ where: { tenantId: user.tenantId } });
      await tx.serviceOrder.deleteMany({ where: { tenantId: user.tenantId } });

      // Clients
      await tx.customer.deleteMany({ where: { tenantId: user.tenantId } });

      // Événements outbox
      await tx.outboxEvent.deleteMany({ where: { tenantId: user.tenantId } });

      // Log d'audit immuable
      await tx.auditLog.create({
        data: {
          id: newTransactionalId(),
          tenantId: user.tenantId,
          actorUserId: user.userId,
          actorType: 'USER',
          eventType: 'TENANT_RESET',
          entityType: 'Tenant',
          entityId: user.tenantId,
          payload: {
            resetAt: new Date().toISOString(),
            actorEmail: currentUser.email,
          },
        },
      });

      return {
        success: true,
        message: 'Votre gestionnaire a été réinitialisé avec succès. Toutes vos données ont été remises à zéro.',
        resetAt: new Date().toISOString(),
      };
    });
  }
}

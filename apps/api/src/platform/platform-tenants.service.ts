import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { DEFAULT_COMMERCIAL_MONTHLY_PRICE, newId, ROLE_TEMPLATES } from '@gestionnaire/db';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';
import type { CreateTenantDto } from './dto/create-tenant.dto.js';
import type { UpdateTenantDto } from './dto/update-tenant.dto.js';
import type { ResetTenantPlatformDto } from './dto/reset-tenant-platform.dto.js';
import { VTM_ERROR_CATALOG, type VtmErrorDefinition } from './error-catalog.data.js';

function normalizeLocationName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}

@Injectable()
export class PlatformTenantsService {
  constructor(private readonly platform: PlatformPrismaService) {}

  async listTenants() {
    const tariffConfig = await this.platform.client.platformConfig.findUnique({ where: { key: 'commercial.subscription-tariff' }, select: { value: true } });
    const monthlyReferencePrice = tariffConfig ? Number(tariffConfig.value) : DEFAULT_COMMERCIAL_MONTHLY_PRICE;
    const tenants = await this.platform.client.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const subscriptions = await this.platform.client.platformSubscription.findMany({
      include: { plan: true },
    });
    const subMap = new Map(subscriptions.map((s) => [s.tenantId, s]));

    const usersCount = await this.platform.client.user.groupBy({
      by: ['tenantId'],
      where: { deletedAt: null, status: 'ACTIVE' },
      _count: { id: true },
    });
    const usersMap = new Map(usersCount.map((u) => [u.tenantId, u._count.id]));

    const locationsCount = await this.platform.client.location.groupBy({
      by: ['tenantId'],
      where: { deletedAt: null },
      _count: { id: true },
    });
    const locationsMap = new Map(locationsCount.map((l) => [l.tenantId, l._count.id]));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const salesCount = await this.platform.client.sale.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: startOfMonth } },
      _count: { id: true },
    });
    const salesMap = new Map(salesCount.map((s) => [s.tenantId, s._count.id]));

    // Récupérer logos et noms légaux synchronisés depuis TenantSetting
    const tenantSettings = await this.platform.client.tenantSetting.findMany({
      where: {
        key: { in: ['documents.logoDataUri', 'organization.legalName', 'organization.phone', 'organization.email'] },
      },
    });

    const logoMap = new Map<string, string>();
    const legalNameMap = new Map<string, string>();
    const phoneMap = new Map<string, string>();
    const emailMap = new Map<string, string>();

    for (const s of tenantSettings) {
      const val = typeof s.value === 'string' ? s.value : String(s.value ?? '');
      if (s.key === 'documents.logoDataUri') logoMap.set(s.tenantId, val);
      if (s.key === 'organization.legalName') legalNameMap.set(s.tenantId, val);
      if (s.key === 'organization.phone') phoneMap.set(s.tenantId, val);
      if (s.key === 'organization.email') emailMap.set(s.tenantId, val);
    }

    return tenants.map((t) => {
      const sub = subMap.get(t.id);
      return {
        id: t.id,
        name: legalNameMap.get(t.id) || t.name,
        legalName: legalNameMap.get(t.id) || t.name,
        logoUrl: logoMap.get(t.id) || null,
        phone: phoneMap.get(t.id) || null,
        email: emailMap.get(t.id) || null,
        status: t.status,
        createdAt: t.createdAt,
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              planKey: sub.plan.key,
              planName: sub.plan.name,
              priceMonthly: monthlyReferencePrice,
              currency: 'XOF',
              currentPeriodEnd: sub.currentPeriodEnd,
              maxUsers: sub.plan.maxUsers,
              maxLocations: sub.plan.maxLocations,
              maxMonthlySales: sub.plan.maxMonthlySales,
            }
          : null,
        usage: {
          activeUsers: usersMap.get(t.id) ?? 0,
          locations: locationsMap.get(t.id) ?? 0,
          monthlySales: salesMap.get(t.id) ?? 0,
        },
      };
    });
  }

  async createTenant(dto: CreateTenantDto) {
    const planKey = dto.planKey ?? 'TRIAL';
    const plan = await this.platform.client.platformPlan.findUnique({
      where: { key: planKey },
    });
    if (!plan || !plan.isActive) {
      throw new BadRequestException(`Plan invalide ou inactif : ${planKey}`);
    }

    const tenantId = newId();
    const now = new Date();
    // Essai gratuit de 14 jours par défaut
    const trialDays = plan.trialDays > 0 ? plan.trialDays : 14;
    const periodEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
    const subStatus = plan.trialDays > 0 || planKey === 'TRIAL' ? 'TRIALING' : 'ACTIVE';

    if (!dto.ownerPassword || dto.ownerPassword.trim().length < 6) {
      throw new BadRequestException('Un mot de passe initial de 6 caractères minimum doit être défini pour le directeur principal.');
    }
    const rawPassword = dto.ownerPassword;
    const passwordHash = await argon2.hash(rawPassword);

    // Bootstrap complet transactionnel et idempotent
    return this.platform.client.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: dto.name.trim(),
          status: 'ACTIVE',
        },
      });

      // 2. Create Platform Subscription (14 jours d'essai)
      const subscription = await tx.platformSubscription.create({
        data: {
          id: newId(),
          tenantId: tenant.id,
          planId: plan.id,
          status: subStatus,
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      // 3. Create Business Profile
      await tx.businessProfile.create({
        data: {
          id: newId(),
          tenantId: tenant.id,
          businessType: dto.businessType ?? 'BOUTIQUE',
          onboardedAt: null,
        },
      });

      // 4. Create Initial Store Location (Boutique de vente)
      const initialStoreName = dto.initialStoreName?.trim().replace(/\s+/g, ' ');
      if (!initialStoreName) throw new BadRequestException('Le nom de la boutique principale est obligatoire.');
      const normalizedStoreName = normalizeLocationName(initialStoreName);
      const duplicateStore = await tx.location.findFirst({
        where: { type: 'STORE', deletedAt: null, normalizedName: normalizedStoreName },
        select: { name: true },
      });
      if (duplicateStore) {
        throw new BadRequestException(`Le nom de boutique « ${initialStoreName} » est déjà utilisé par « ${duplicateStore.name} ». Choisissez un nom unique.`);
      }
      const storeLocation = await tx.location.create({
        data: {
          id: newId(),
          tenantId: tenant.id,
          name: initialStoreName,
          normalizedName: normalizedStoreName,
          type: 'STORE',
        },
      });

      // 5. Create Default Warehouse Location (Dépôt Principal de stockage)
      const warehouseLocation = await tx.location.create({
        data: {
          id: newId(),
          tenantId: tenant.id,
          name: 'Dépôt Principal',
          normalizedName: normalizeLocationName('Dépôt Principal'),
          type: 'WAREHOUSE',
        },
      });

      // 6. Create Owner User
      const owner = await tx.user.create({
        data: {
          id: newId(),
          tenantId: tenant.id,
          email: dto.ownerEmail.toLowerCase().trim(),
          fullName: dto.ownerName,
          passwordHash,
          status: 'ACTIVE',
        },
      });

      // 7. Find Owner Role Template and Assign
      const ownerRole = await tx.role.findFirst({
        where: { tenantId: null, key: ROLE_TEMPLATES.TENANT_OWNER.key },
      });
      if (ownerRole) {
        await tx.userRole.create({
          data: {
            id: newId(),
            tenantId: tenant.id,
            userId: owner.id,
            roleId: ownerRole.id,
            scopeType: 'ALL_LOCATIONS',
            scopeLocationIds: [],
          },
        });
      }

      // 8. Provision Default Document Sequences (reçus, factures, devis, avoirs, bons de livraison)
      const seriesList = ['RECEIPT', 'INVOICE', 'QUOTE', 'CREDIT_NOTE', 'DELIVERY_NOTE'];
      for (const loc of [storeLocation, warehouseLocation]) {
        for (const series of seriesList) {
          await tx.documentSequence.create({
            data: {
              id: newId(),
              tenantId: tenant.id,
              locationId: loc.id,
              series,
              lastNumber: 0,
            },
          });
        }
      }

      // 9. Provision Default Settings (Burkina Faso / Régional XOF / Modèles de facture)
      const defaultSettings = [
        { key: 'organization.legalName', value: dto.name.trim() },
        { key: 'commerce.defaultCurrency', value: 'XOF' },
        { key: 'organization.countryCode', value: 'BF' },
        { key: 'organization.phone', value: '' },
        { key: 'organization.email', value: dto.ownerEmail.toLowerCase().trim() },
        { key: 'organization.address', value: '' },
        { key: 'documents.invoiceTemplate', value: 'STANDARD_PRO' },
        { key: 'documents.receiptFormat', value: '80mm' },
        { key: 'documents.receiptFooterText', value: 'Merci de votre confiance ! Les articles vendus ne sont ni repris ni échangés.' },
        { key: 'sales.requireCustomerForCreditSales', value: true },
        { key: 'inventory.allowNegativeStock', value: false },
        { key: 'inventory.lowStockThreshold', value: '5' },
        { key: 'documents.quoteValidityDays', value: '30' },
        { key: 'payments.enabledMethods', value: ['CASH', 'MOBILE_MONEY', 'CARD', 'TRANSFER'] },
        { key: 'onboarding.dismissed', value: false },
      ];

      for (const s of defaultSettings) {
        await tx.tenantSetting.create({
          data: {
            id: newId(),
            tenantId: tenant.id,
            key: s.key,
            value: s.value,
          },
        });
      }

      // 10. Provision Default Modules
      const defaultModules = [
        'sell',
        'sales',
        'catalog',
        'customers',
        'settings',
        'users',
        'inventory',
        'cash',
        'reports',
        'credit',
        'invoices',
        'orders',
      ];
      for (const modKey of defaultModules) {
        await tx.tenantModule.create({
          data: {
            id: newId(),
            tenantId: tenant.id,
            key: modKey,
            enabled: true,
          },
        });
      }

      // 11. Initial SaaS Invoice if plan is paid and trialDays is 0
      let initialInvoice = null;
      if (Number(plan.priceMonthly) > 0 && plan.trialDays === 0) {
        initialInvoice = await tx.platformInvoice.create({
          data: {
            id: newId(),
            tenantId: tenant.id,
            subscriptionId: subscription.id,
            invoiceNumber: `SAAS-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
            amount: plan.priceMonthly,
            currency: plan.currency,
            status: 'PENDING',
            periodStart: now,
            periodEnd: periodEnd,
            notes: `Facture initiale souscription plan ${plan.name}`,
          },
        });
      }

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: tenant.status,
        },
        owner: {
          id: owner.id,
          email: owner.email,
          fullName: owner.fullName,
        },
        locations: [
          { id: storeLocation.id, name: storeLocation.name, type: storeLocation.type },
          { id: warehouseLocation.id, name: warehouseLocation.name, type: warehouseLocation.type },
        ],
        subscription: {
          status: subscription.status,
          plan: plan.name,
          trialDays,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        initialInvoice,
      };
    });
  }

  async suspendTenant(tenantId: string, reason?: string) {
    const tenant = await this.platform.client.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Organisation introuvable');

    const now = new Date();
    await this.platform.client.tenant.update({
      where: { id: tenantId },
      data: { status: 'SUSPENDED' },
    });

    await this.platform.client.platformSubscription.updateMany({
      where: { tenantId },
      data: { status: 'SUSPENDED', suspendedAt: now },
    });

    return { message: 'Organisation suspendue avec succès', tenantId, status: 'SUSPENDED', reason };
  }

  async reactivateTenant(tenantId: string) {
    const tenant = await this.platform.client.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Organisation introuvable');

    await this.platform.client.tenant.update({
      where: { id: tenantId },
      data: { status: 'ACTIVE' },
    });

    await this.platform.client.platformSubscription.updateMany({
      where: { tenantId },
      data: { status: 'ACTIVE', suspendedAt: null },
    });

    return { message: 'Organisation réactivée avec succès', tenantId, status: 'ACTIVE' };
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
    const tenant = await this.platform.client.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Organisation introuvable');

    const effectiveName = dto.legalName?.trim() || dto.name?.trim();

    return this.platform.client.$transaction(async (tx) => {
      // 1. Update Tenant model
      const updateData: any = {};
      if (effectiveName) updateData.name = effectiveName;
      if (dto.status) updateData.status = dto.status;

      if (Object.keys(updateData).length > 0) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: updateData,
        });
      }

      // 2. Synchronize TenantSettings
      const settingsToUpsert: Array<{ key: string; value: string }> = [];
      if (effectiveName) {
        settingsToUpsert.push({ key: 'organization.legalName', value: effectiveName });
      }
      if (dto.phone !== undefined) {
        settingsToUpsert.push({ key: 'organization.phone', value: dto.phone.trim() });
      }
      if (dto.email !== undefined) {
        settingsToUpsert.push({ key: 'organization.email', value: dto.email.trim().toLowerCase() });
      }
      if (dto.logoUrl !== undefined) {
        settingsToUpsert.push({ key: 'documents.logoDataUri', value: dto.logoUrl.trim() });
      }

      for (const item of settingsToUpsert) {
        const existing = await tx.tenantSetting.findFirst({
          where: { tenantId, key: item.key },
        });
        if (existing) {
          await tx.tenantSetting.update({
            where: { id: existing.id },
            data: { value: item.value },
          });
        } else {
          await tx.tenantSetting.create({
            data: {
              id: newId(),
              tenantId,
              key: item.key,
              value: item.value,
            },
          });
        }
      }

      return {
        success: true,
        message: `Organisation « ${effectiveName || tenant.name} » mise à jour avec succès.`,
        tenantId,
      };
    });
  }

  async getPlatformStats() {
    const totalTenants = await this.platform.client.tenant.count({ where: { deletedAt: null } });
    const activeTenants = await this.platform.client.tenant.count({ where: { deletedAt: null, status: 'ACTIVE' } });
    const suspendedTenants = await this.platform.client.tenant.count({ where: { deletedAt: null, status: 'SUSPENDED' } });

    const subscriptions = await this.platform.client.platformSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });
    const tariffConfig = await this.platform.client.platformConfig.findUnique({ where: { key: 'commercial.subscription-tariff' }, select: { value: true } });
    const monthlyReferencePrice = tariffConfig ? Number(tariffConfig.value) : DEFAULT_COMMERCIAL_MONTHLY_PRICE;
    const totalMRR = subscriptions.length * monthlyReferencePrice;

    const trialingCount = await this.platform.client.platformSubscription.count({ where: { status: 'TRIALING' } });

    const pendingInvoices = await this.platform.client.platformInvoice.count({ where: { status: 'PENDING' } });
    const paidInvoices = await this.platform.client.platformInvoice.count({ where: { status: 'PAID' } });

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        suspended: suspendedTenants,
      },
      subscriptions: {
        active: subscriptions.length,
        trialing: trialingCount,
        mrr: totalMRR,
        currency: 'XOF',
      },
      invoices: {
        pending: pendingInvoices,
        paid: paidInvoices,
      },
    };
  }

  /**
   * Aperçu détaillé sans suppression pour une organisation ciblée
   */
  async getTenantResetPreview(tenantId: string) {
    const tenant = await this.platform.client.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Organisation introuvable');

    const [
      productsCount,
      stockLevelsCount,
      stockMovementsCount,
      customersCount,
      creditAccountsCount,
      creditMovementsCount,
      suppliersCount,
      salesCount,
      saleLinesCount,
      paymentsCount,
      documentsCount,
      ordersCount,
      cashSessionsCount,
      expensesCount,
      serviceOrdersCount,
      appointmentsCount,
      storedFilesCount,
      automationRulesCount,
      activeModules,
      users,
      invitationsCount,
      devicesCount,
      customRolesCount,
    ] = await Promise.all([
      this.platform.client.product.count({ where: { tenantId } }),
      this.platform.client.stockLevel.count({ where: { tenantId } }),
      this.platform.client.stockMovement.count({ where: { tenantId } }),
      this.platform.client.customer.count({ where: { tenantId } }),
      this.platform.client.creditAccount.count({ where: { tenantId } }),
      this.platform.client.creditMovement.count({ where: { tenantId } }),
      this.platform.client.supplier.count({ where: { tenantId } }),
      this.platform.client.sale.count({ where: { tenantId } }),
      this.platform.client.saleLine.count({ where: { tenantId } }),
      this.platform.client.payment.count({ where: { tenantId } }),
      this.platform.client.document.count({ where: { tenantId } }),
      this.platform.client.order.count({ where: { tenantId } }),
      this.platform.client.cashSession.count({ where: { tenantId } }),
      this.platform.client.expense.count({ where: { tenantId } }),
      this.platform.client.serviceOrder.count({ where: { tenantId } }),
      this.platform.client.appointment.count({ where: { tenantId } }),
      this.platform.client.storedFile.count({ where: { tenantId } }),
      this.platform.client.automationRule.count({ where: { tenantId } }),
      this.platform.client.tenantModule.findMany({ where: { tenantId, enabled: true }, select: { key: true } }),
      this.platform.client.user.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, email: true, fullName: true, status: true, createdAt: true, userRoles: { select: { role: { select: { key: true } } } } },
      }),
      this.platform.client.invitation.count({ where: { tenantId } }),
      this.platform.client.device.count({ where: { tenantId } }),
      this.platform.client.role.count({ where: { tenantId } }),
    ]);

    const principalDirector = users.find((user) => user.userRoles.some((assignment) => assignment.role.key === ROLE_TEMPLATES.TENANT_OWNER.key)) ?? null;

    const byCategory = {
      catalog: productsCount,
      inventory: stockLevelsCount + stockMovementsCount,
      customersAndCredit: customersCount + creditAccountsCount + creditMovementsCount,
      suppliersAndPurchases: suppliersCount,
      salesAndBilling: salesCount + saleLinesCount + paymentsCount + documentsCount + ordersCount,
      cashRegisters: cashSessionsCount,
      expenses: expensesCount,
      servicesAndWorkshop: serviceOrdersCount + appointmentsCount,
      filesAndAttachments: storedFilesCount,
      automationsAndEvents: automationRulesCount,
      secondaryAccountsAndAccess: Math.max(0, users.length - (principalDirector ? 1 : 0)) + invitationsCount + devicesCount + customRolesCount,
    };

    const totalRecords = Object.values(byCategory).reduce((a, b) => a + b, 0);

    const tableCounts = {
      products: productsCount,
      stockLevels: stockLevelsCount,
      stockMovements: stockMovementsCount,
      customers: customersCount,
      creditAccounts: creditAccountsCount,
      creditMovements: creditMovementsCount,
      suppliers: suppliersCount,
      sales: salesCount,
      saleLines: saleLinesCount,
      payments: paymentsCount,
      documents: documentsCount,
      orders: ordersCount,
      cashSessions: cashSessionsCount,
      expenses: expensesCount,
      serviceOrders: serviceOrdersCount,
      appointments: appointmentsCount,
      storedFiles: storedFilesCount,
      automationRules: automationRulesCount,
      secondaryAccounts: Math.max(0, users.length - (principalDirector ? 1 : 0)),
      invitations: invitationsCount,
      devices: devicesCount,
      customRoles: customRolesCount,
    };

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      status: tenant.status,
      principalDirector: principalDirector ? {
        id: principalDirector.id,
        fullName: principalDirector.fullName,
        email: principalDirector.email,
        status: principalDirector.status,
        createdAt: principalDirector.createdAt,
      } : null,
      activeUserCount: users.length,
      activeModules: activeModules.map((m) => m.key),
      totalRecords,
      totalOperationalRecords: totalRecords,
      byCategory,
      tableCounts,
      dryRunCounts: tableCounts,
      preservedScope: [
        'Tenant & identifiant organisation',
        'Directeur principal identifié par le rôle tenant_owner : compte, mot de passe, statut, profil et association conservés (sessions révoquées)',
        'Comptes secondaires, invitations, appareils, rôles et permissions métier personnalisés supprimés',
        'Paramètres & configurations de fonctionnement (TenantSetting, LocationSetting)',
        'Nom, coordonnées, devise et logo officiel (BusinessProfile, TenantSetting)',
        'Boutiques physiques & Dépôts de stockage (Location)',
        'Abonnement SaaS et historique de facturation plateforme (PlatformSubscription, PlatformInvoice)',
        'Modèles de documents & formats d\'impression',
        'Trace d\'audit renforcée de l\'opération de réinitialisation (AuditLog)',
      ],
    };
  }

  /** Export snapshot of every public table with a tenantId column, in one repeatable database snapshot. */
  async exportTenantBackup(tenantId: string) {
    const snapshot = await this.platform.client.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException('Organisation introuvable');
      const tables = await tx.$queryRaw<{ tableName: string }[]>`
        SELECT DISTINCT c.table_name AS "tableName"
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = current_schema()
          AND c.column_name = 'tenantId'
          AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name
      `;
      const data: Record<string, unknown[]> = {};
      for (const { tableName } of tables) {
        const safeTableName = tableName.replace(/"/g, '""');
        const rows = await tx.$queryRawUnsafe<{ record: unknown }[]>(
          `SELECT to_jsonb(t) AS record FROM "${safeTableName}" t WHERE t."tenantId" = $1::uuid`,
          tenantId,
        );
        data[tableName] = rows.map((row) => row.record);
      }
      return { tenant, data };
    }, { isolationLevel: 'RepeatableRead' });

    const tableCounts = Object.fromEntries(Object.entries(snapshot.data).map(([name, rows]) => [name, rows.length]));
    const snapshotSha256 = createHash('sha256').update(JSON.stringify(snapshot.data)).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(snapshotSha256)) throw new BadRequestException('Vérification SHA-256 de la sauvegarde échouée.');

    // Enregistrement inaltérable de la sauvegarde exportée dans le journal d'audit
    try {
      await this.platform.client.auditLog.create({
        data: {
          id: newId(),
          tenantId,
          actorUserId: null,
          actorType: 'SYSTEM',
          eventType: 'TENANT_BACKUP_EXPORTED',
          entityType: 'TENANT',
          entityId: tenantId,
          payload: {
            exportedAt: new Date().toISOString(),
            tenantName: snapshot.tenant.name,
            tableCounts,
            snapshotSha256,
          },
        },
      });
    } catch {
      // Tolérance si table auditLog indisponible temporairement
    }

    return {
      exportedAt: new Date().toISOString(),
      tenant: { id: snapshot.tenant.id, name: snapshot.tenant.name, status: snapshot.tenant.status },
      metadata: {
        tableCounts,
        tableCount: Object.keys(tableCounts).length,
        recordCount: Object.values(tableCounts).reduce((sum, count) => sum + count, 0),
      },
      integrity: { algorithm: 'SHA-256', snapshotSha256 },
      data: snapshot.data,
    };
  }

  /**
   * Réinitialisation opérationnelle complète d'UNE organisation ciblée
   * avec réauthentification Super Admin, confirmation exacte et traçabilité.
   */
  async resetSingleTenantOperationalData(adminId: string, tenantId: string, dto: ResetTenantPlatformDto) {
    const admin = await this.platform.client.platformAdminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte Super Admin introuvable ou inactif');
    }

    const isPasswordValid = await argon2.verify(admin.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Mot de passe Super Admin incorrect. La réinitialisation a été refusée.');
    }

    const tenant = await this.platform.client.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException(`Organisation cible introuvable : ${tenantId}`);
    }

    const expectedPhrase1 = `CONFIRMER REINITIALISATION ${tenant.name}`.toUpperCase().trim();
    const expectedPhrase2 = `REINITIALISER ${tenant.name}`.toUpperCase().trim();
    const expectedPhrase3 = tenant.name.toUpperCase().trim();
    const cleanProvided = dto.confirmationPhrase.toUpperCase().trim();

    if (cleanProvided !== expectedPhrase1 && cleanProvided !== expectedPhrase2 && cleanProvided !== expectedPhrase3) {
      throw new BadRequestException(
        `Phrase de confirmation incorrecte. Vous devez saisir exactement : CONFIRMER REINITIALISATION ${tenant.name}`,
      );
    }

    // Contrôle serveur strict : la confirmation explicite de sauvegarde est obligatoire
    if (dto.backupConfirmed !== true) {
      throw new BadRequestException(
        'VTM-RESET-BACKUP-REQUIRED: La confirmation explicite de sauvegarde préalable (backupConfirmed=true) est obligatoire côté serveur avant toute réinitialisation.',
      );
    }

    // Chaque réinitialisation exige une nouvelle sauvegarde contrôlable de ce tenant.
    // Une ancienne ligne d'audit ne prouve pas que les données actuelles sont sauvegardées.
    const backup = await this.exportTenantBackup(tenantId);
    const verifiedBackupHash = createHash('sha256').update(JSON.stringify(backup.data)).digest('hex');
    if (verifiedBackupHash !== backup.integrity.snapshotSha256) {
      throw new BadRequestException('VTM-RESET-BACKUP-INTEGRITY: La sauvegarde a échoué à la vérification SHA-256 ; aucune donnée n’a été supprimée.');
    }

    const principalRoles = await this.platform.client.userRole.findMany({
      where: { tenantId, role: { key: ROLE_TEMPLATES.TENANT_OWNER.key } },
      select: { userId: true, roleId: true },
    });
    const principalUserIds = [...new Set(principalRoles.map((row) => row.userId))];
    if (principalUserIds.length !== 1) {
      throw new BadRequestException(
        `Réinitialisation refusée : une seule personne doit être identifiée comme directeur principal (trouvée : ${principalUserIds.length}). Corrigez les rôles propriétaires avant de réessayer.`,
      );
    }
    const principalUserId = principalUserIds[0];

    const before = await this.getTenantResetPreview(tenantId);

    // Exécution transactionnelle complète dans l'ordre strict des contraintes d'intégrité
    const result = await this.platform.client.$transaction(async (tx) => {
      // 1. Ventes, livraisons, retours et paiements
      const heldCarts = await tx.heldCart.deleteMany({ where: { tenantId } });
      const deliveries = await tx.delivery.deleteMany({ where: { tenantId } });
      const returnLines = await tx.returnLine.deleteMany({ where: { tenantId } });
      const returns = await tx.return.deleteMany({ where: { tenantId } });
      await tx.progressivePurchaseMovement.deleteMany({ where: { tenantId } });
      await tx.progressivePurchaseCase.deleteMany({ where: { tenantId } });
      const saleLines = await tx.saleLine.deleteMany({ where: { tenantId } });
      const payments = await tx.payment.deleteMany({ where: { tenantId } });
      const documents = await tx.document.deleteMany({ where: { tenantId } });
      const sales = await tx.sale.deleteMany({ where: { tenantId } });

      // 2. Commandes et achats
      const orderLines = await tx.orderLine.deleteMany({ where: { tenantId } });
      const orders = await tx.order.deleteMany({ where: { tenantId } });
      const purchaseOrderLines = await tx.purchaseOrderLine.deleteMany({ where: { tenantId } });
      const purchaseOrders = await tx.purchaseOrder.deleteMany({ where: { tenantId } });

      // 3. Fournisseurs
      const supplierMovements = await tx.supplierMovement.deleteMany({ where: { tenantId } });
      const supplierAccounts = await tx.supplierAccount.deleteMany({ where: { tenantId } });
      const suppliers = await tx.supplier.deleteMany({ where: { tenantId } });

      // 4. Crédit clients
      const creditMovements = await tx.creditMovement.deleteMany({ where: { tenantId } });
      const creditAccounts = await tx.creditAccount.deleteMany({ where: { tenantId } });

      // 5. Stocks, transferts et lots
      const stockMovements = await tx.stockMovement.deleteMany({ where: { tenantId } });
      const stockBatches = await tx.stockBatch.deleteMany({ where: { tenantId } });
      const stockTransferLines = await tx.stockTransferLine.deleteMany({ where: { tenantId } });
      const stockTransfers = await tx.stockTransfer.deleteMany({ where: { tenantId } });
      await tx.stockLevel.deleteMany({ where: { tenantId } });

      // 6. Catalogue, variantes, codes-barres
      await tx.bundleComponent.deleteMany({ where: { tenantId } });
      await tx.productBarcode.deleteMany({ where: { tenantId } });
      await tx.productAlias.deleteMany({ where: { tenantId } });
      await tx.quantityPriceTier.deleteMany({ where: { tenantId } });
      await tx.customerPriceOverride.deleteMany({ where: { tenantId } });
      await tx.warranty.deleteMany({ where: { tenantId } });
      await tx.warrantyPolicy.deleteMany({ where: { tenantId } });
      await tx.serialNumber.deleteMany({ where: { tenantId } });
      await tx.product.updateMany({ where: { tenantId }, data: { parentProductId: null } });
      const products = await tx.product.deleteMany({ where: { tenantId } });
      await tx.category.updateMany({ where: { tenantId }, data: { parentCategoryId: null } });
      const categories = await tx.category.deleteMany({ where: { tenantId } });
      await tx.productUnit.deleteMany({ where: { tenantId } });

      // 7. Clients
      const customers = await tx.customer.deleteMany({ where: { tenantId } });

      // 8. Caisse
      await tx.cashMovement.deleteMany({ where: { tenantId } });
      await tx.cashSession.deleteMany({ where: { tenantId } });

      // 9. Dépenses
      const expenses = await tx.expense.deleteMany({ where: { tenantId } });

      // 10. Prestations, atelier et rendez-vous
      await tx.serviceOrderItem.deleteMany({ where: { tenantId } });
      const serviceOrders = await tx.serviceOrder.deleteMany({ where: { tenantId } });
      const appointments = await tx.appointment.deleteMany({ where: { tenantId } });

      // 11. Fichiers (préserver les logos officiels d'entreprise) et réseaux sociaux
      await tx.storedFile.deleteMany({ where: { tenantId, category: { not: 'LOGO' } } });
      await tx.socialMessage.deleteMany({ where: { tenantId } });
      await tx.socialConversation.deleteMany({ where: { tenantId } });
      await tx.socialConsent.deleteMany({ where: { tenantId } });

      // 12. Automatisations & Diagnostics
      await tx.automationExecutionLog.deleteMany({ where: { tenantId } });
      await tx.automationRule.deleteMany({ where: { tenantId } });
      await tx.diagnosticScan.deleteMany({ where: { tenantId } });
      await tx.outboxEvent.deleteMany({ where: { tenantId } });

      // 13. Identités : préserver explicitement le directeur principal seulement.
      await tx.invitation.deleteMany({ where: { tenantId } });
      await tx.refreshToken.deleteMany({ where: { tenantId, userId: { not: principalUserId } } });
      await tx.refreshToken.updateMany({ where: { tenantId, userId: principalUserId }, data: { revokedAt: new Date() } });
      await tx.device.deleteMany({ where: { tenantId } });
      await tx.userRole.deleteMany({
        where: {
          tenantId,
          OR: [
            { userId: { not: principalUserId } },
            { roleId: { notIn: principalRoles.map((row) => row.roleId) } },
          ],
        },
      });
      await tx.user.deleteMany({ where: { tenantId, id: { not: principalUserId } } });
      await tx.rolePermission.deleteMany({ where: { tenantId } });
      await tx.role.deleteMany({ where: { tenantId } });
      await tx.tenantCapability.deleteMany({ where: { tenantId } });
      await tx.tenantModule.deleteMany({ where: { tenantId } });
      await tx.businessProfile.updateMany({ where: { tenantId }, data: { onboardedAt: null } });
      await tx.tenantSetting.updateMany({ where: { tenantId, key: 'onboarding.dismissed' }, data: { value: false } });

      // 14. Remise à zéro des numéroteurs de documents
      await tx.documentSequence.updateMany({ where: { tenantId }, data: { lastNumber: 0 } });

      // 15. Trace d'audit inaltérable de la réinitialisation
      await tx.auditLog.create({
        data: {
          id: newId(),
          tenantId,
          actorUserId: admin.id,
          actorType: 'SYSTEM',
          eventType: 'TENANT_OPERATIONAL_RESET',
          entityType: 'TENANT',
          entityId: tenantId,
          payload: {
            adminEmail: admin.email,
            adminFullName: admin.fullName,
            tenantName: tenant.name,
            resetTimestamp: new Date().toISOString(),
            principalUserId,
            backupExportedAt: backup.exportedAt,
            backupSha256: backup.integrity.snapshotSha256,
            phase: 'completed',
          },
        },
      });

      return {
        productsDeleted: products.count,
        categoriesDeleted: categories.count,
        salesDeleted: sales.count,
        saleLinesDeleted: saleLines.count,
        paymentsDeleted: payments.count,
        documentsDeleted: documents.count,
        ordersDeleted: orders.count + orderLines.count,
        purchaseOrdersDeleted: purchaseOrders.count + purchaseOrderLines.count,
        customersDeleted: customers.count,
        suppliersDeleted: suppliers.count,
        creditMovementsDeleted: creditMovements.count + creditAccounts.count,
        stockMovementsDeleted: stockMovements.count + stockBatches.count + stockTransfers.count + stockTransferLines.count,
        expensesDeleted: expenses.count,
        serviceOrdersDeleted: serviceOrders.count,
        appointmentsDeleted: appointments.count,
        deliveriesDeleted: deliveries.count + heldCarts.count + returns.count + returnLines.count,
      };
    });

    const after = await this.getTenantResetPreview(tenantId);

    return {
      success: true,
      scope: 'SINGLE_ORGANIZATION_OPERATIONAL_DATA',
      tenantId: tenant.id,
      tenantName: tenant.name,
      reinitializedAt: new Date().toISOString(),
      report: result,
      before: { totalOperationalRecords: before.totalOperationalRecords, tableCounts: before.tableCounts },
      after: { totalOperationalRecords: after.totalOperationalRecords, tableCounts: after.tableCounts, activeUserCount: after.activeUserCount },
      preservedDirector: after.principalDirector,
      message: `Les données opérationnelles de « ${tenant.name} » ont été remises à zéro. Le directeur principal et son compte ont été préservés ; les comptes secondaires et leurs accès ont été supprimés.`,
    };
  }

  /**
   * Catalogue central des codes d'erreurs
   */
  getErrorCatalog(query?: string, domain?: string, severity?: string): VtmErrorDefinition[] {
    let list = [...VTM_ERROR_CATALOG];
    if (domain && domain !== 'ALL') {
      list = list.filter((e) => e.domain.toUpperCase() === domain.toUpperCase());
    }
    if (severity && severity !== 'ALL') {
      list = list.filter((e) => e.severity.toUpperCase() === severity.toUpperCase());
    }
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.code.toLowerCase().includes(q) ||
          e.messageFr.toLowerCase().includes(q) ||
          e.module.toLowerCase().includes(q) ||
          e.technicalExplanation.toLowerCase().includes(q),
      );
    }
    return list;
  }

  /**
   * Diagnostic complet du système pour les administrateurs
   */
  async getPlatformDiagnostics() {
    const startTime = Date.now();
    let dbStatus = 'HEALTHY';
    let dbLatencyMs = 0;

    try {
      const t0 = Date.now();
      await this.platform.client.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - t0;
    } catch {
      dbStatus = 'DEGRADED';
    }

    const [totalTenants, activeTenants, totalUsers, activeSubs] = await Promise.all([
      this.platform.client.tenant.count({ where: { deletedAt: null } }),
      this.platform.client.tenant.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.platform.client.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.platform.client.platformSubscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    const memory = process.memoryUsage();
    const env = process.env.NODE_ENV || 'development';

    return {
      status: dbStatus === 'HEALTHY' ? 'OPERATIONAL' : 'DEGRADED',
      environment: env,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        client: 'Prisma Client 6.19.3 / PostgreSQL 16',
      },
      tenants: {
        total: totalTenants,
        active: activeTenants,
        activeSubscriptions: activeSubs,
      },
      users: {
        activeCount: totalUsers,
      },
      security: {
        platformResetPolicy: env === 'production' ? 'BLOCKED_IN_PRODUCTION' : 'DEMO_RESTRICTED',
        rbacProtection: 'ACTIVE_JWT_STRICT',
        dataIsolation: 'TENANT_ID_MANDATORY_PRISMA',
      },
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round(memory.rss / (1024 * 1024)),
        memoryHeapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
        nodeVersion: process.version,
      },
    };
  }

  /**
   * Réinitialisation Globale de la Plateforme SaaS
   * Strictement interdite en production et limitée aux tenants de test autorisés.
   */
  async resetAllPlatform(
    adminId: string,
    dto: { password: string; confirmationPhrase: string; targetDemoTenantId?: string },
  ) {
    const env = process.env.NODE_ENV;
    if (env === 'production') {
      throw new ForbiddenException(
        'VTM-PLATFORM-RESET-FORBIDDEN: La réinitialisation globale de la plateforme est formellement interdite et désactivée en environnement de production.',
      );
    }

    if (process.env.ALLOW_PLATFORM_RESET !== 'true') {
      throw new ForbiddenException(
        "VTM-PLATFORM-RESET-FLAG-REQUIRED: La réinitialisation requiert l'activation explicite de la variable d'environnement ALLOW_PLATFORM_RESET=true dans un environnement de test ou démonstration isolé.",
      );
    }

    if (env !== 'test' && env !== 'development' && env !== 'qa') {
      throw new ForbiddenException(
        `VTM-PLATFORM-RESET-FORBIDDEN: Environnement non autorisé pour la réinitialisation (${env ?? 'inconnu'}).`,
      );
    }

    if (!dto.targetDemoTenantId) {
      throw new BadRequestException(
        "VTM-PLATFORM-RESET-SCOPE-REQUIRED: L'identifiant du tenant de démonstration ciblé (targetDemoTenantId) est obligatoire. Tout effacement global non borné de tous les tenants est strictement interdit.",
      );
    }

    if (dto.confirmationPhrase.trim() !== 'REINITIALISER TOUTE LA PLATEFORME') {
      throw new BadRequestException(
        'Phrase de confirmation invalide. Vous devez taper exactement : REINITIALISER TOUTE LA PLATEFORME',
      );
    }

    const admin = await this.platform.client.platformAdminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte administrateur plateforme introuvable ou inactif');
    }

    const isPasswordValid = await argon2.verify(admin.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Mot de passe administrateur incorrect. La réinitialisation a été refusée.');
    }

    const targetTenant = await this.platform.client.tenant.findUnique({
      where: { id: dto.targetDemoTenantId },
    });
    if (!targetTenant) {
      throw new NotFoundException(`Tenant cible introuvable : ${dto.targetDemoTenantId}`);
    }

    const isDemoName =
      targetTenant.name.toLowerCase().includes('demo') ||
      targetTenant.name.toLowerCase().includes('test') ||
      targetTenant.name.toLowerCase().includes('fixture');
    if (!isDemoName) {
      throw new ForbiddenException(
        `VTM-PLATFORM-RESET-REFUSED: Le tenant ciblé "${targetTenant.name}" n'est pas identifié comme un espace de démonstration ou de test autorisé.`,
      );
    }

    const tenantId = targetTenant.id;

    // Réinitialisation bornée STRICTEMENT au périmètre du tenant de démonstration
    await this.platform.client.$transaction(async (tx) => {
      await tx.heldCart.deleteMany({ where: { tenantId } });
      await tx.delivery.deleteMany({ where: { tenantId } });
      await tx.returnLine.deleteMany({ where: { tenantId } });
      await tx.return.deleteMany({ where: { tenantId } });
      await tx.progressivePurchaseMovement.deleteMany({ where: { tenantId } });
      await tx.progressivePurchaseCase.deleteMany({ where: { tenantId } });
      await tx.saleLine.deleteMany({ where: { tenantId } });
      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.document.deleteMany({ where: { tenantId } });
      await tx.sale.deleteMany({ where: { tenantId } });

      await tx.orderLine.deleteMany({ where: { tenantId } });
      await tx.order.deleteMany({ where: { tenantId } });
      await tx.purchaseOrderLine.deleteMany({ where: { tenantId } });
      await tx.purchaseOrder.deleteMany({ where: { tenantId } });

      await tx.supplierMovement.deleteMany({ where: { tenantId } });
      await tx.supplierAccount.deleteMany({ where: { tenantId } });
      await tx.supplier.deleteMany({ where: { tenantId } });

      await tx.creditMovement.deleteMany({ where: { tenantId } });
      await tx.creditAccount.deleteMany({ where: { tenantId } });

      await tx.stockMovement.deleteMany({ where: { tenantId } });
      await tx.stockBatch.deleteMany({ where: { tenantId } });
      await tx.stockTransferLine.deleteMany({ where: { tenantId } });
      await tx.stockTransfer.deleteMany({ where: { tenantId } });
      await tx.stockLevel.updateMany({ where: { tenantId }, data: { quantityOnHand: 0, quantityReserved: 0 } });

      await tx.bundleComponent.deleteMany({ where: { tenantId } });
      await tx.productBarcode.deleteMany({ where: { tenantId } });
      await tx.productAlias.deleteMany({ where: { tenantId } });
      await tx.quantityPriceTier.deleteMany({ where: { tenantId } });
      await tx.customerPriceOverride.deleteMany({ where: { tenantId } });
      await tx.warranty.deleteMany({ where: { tenantId } });
      await tx.warrantyPolicy.deleteMany({ where: { tenantId } });
      await tx.serialNumber.deleteMany({ where: { tenantId } });
      await tx.product.deleteMany({ where: { tenantId } });
      await tx.category.deleteMany({ where: { tenantId } });
      await tx.productUnit.deleteMany({ where: { tenantId } });

      await tx.customer.deleteMany({ where: { tenantId } });
      await tx.cashMovement.deleteMany({ where: { tenantId } });
      await tx.cashSession.deleteMany({ where: { tenantId } });
      await tx.expense.deleteMany({ where: { tenantId } });
      await tx.serviceOrderItem.deleteMany({ where: { tenantId } });
      await tx.serviceOrder.deleteMany({ where: { tenantId } });
      await tx.appointment.deleteMany({ where: { tenantId } });

      await tx.storedFile.deleteMany({ where: { tenantId } });
      await tx.socialMessage.deleteMany({ where: { tenantId } });
      await tx.socialConversation.deleteMany({ where: { tenantId } });
      await tx.socialConsent.deleteMany({ where: { tenantId } });
      await tx.automationExecutionLog.deleteMany({ where: { tenantId } });
      await tx.automationRule.deleteMany({ where: { tenantId } });
      await tx.diagnosticScan.deleteMany({ where: { tenantId } });
      await tx.outboxEvent.deleteMany({ where: { tenantId } });
    });

    return {
      success: true,
      scope: 'DEMO_TENANT_FIXTURES_ONLY',
      targetTenantId: tenantId,
      targetTenantName: targetTenant.name,
      reinitializedAt: new Date().toISOString(),
      message: `Toutes les données opérationnelles du tenant démo "${targetTenant.name}" ont été réinitialisées avec succès. Les autres tenants et comptes réels sont restés intacts.`,
    };
  }
}

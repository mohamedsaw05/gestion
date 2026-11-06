/**
 * Données de démonstration / développement — CLEAREMENT IDENTIFIÉES COMME TELLES.
 * Ne jamais exécuter contre une base de production.
 *
 * IDEMPOTENT : les deux tenants de démo ont des IDs FIXES (pas de newId() sur
 * les tenants eux-mêmes) et sont entièrement réinitialisés (toutes leurs
 * données supprimées puis recréées) à chaque exécution — sans quoi relancer
 * `npm run db:seed` accumulerait des doublons de tenants "Boutique Alpha/Beta"
 * indéfiniment.
 *
 * Crée 2 tenants (pour tester l'isolation multi-tenant, cf docs/architecture/01-analyse-risques.md §5)
 * et, pour le Tenant A, les 5 profils de rôle demandés (Owner/Manager/Sales/Warehouse/Finance)
 * afin de pouvoir tester réellement le moteur RBAC (permissions + scope de localisation),
 * pas seulement l'affichage du menu. Inclut aussi des exemples de Pricing Engine
 * (prix négocié client, palier de quantité) et de Credit Engine (limite de crédit,
 * vente à crédit) pour pouvoir les tester immédiatement sans les configurer à la main.
 *
 * NOTE : le "Platform Admin" (administration cross-tenant) n'est PAS seedé ici car le
 * Platform Engine n'est pas encore implémenté dans cette phase — voir docs/PROJECT_STATUS.md.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { CAPABILITIES, DEFAULT_COMMERCIAL_MONTHLY_PRICE, newId, newTransactionalId, ROLE_TEMPLATES } from './index';

const prisma = new PrismaClient();

function normalizeLocationName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

if (process.env.NODE_ENV === 'production') {
  console.error('[SÉCURITÉ CRITIQUE] Le script seed.ts contient des identifiants de développement et est STRICTEMENT INTERDIT en environnement de production.');
  process.exit(1);
}

const DEV_PASSWORD = 'Passw0rd!';

// IDs fixes (UUID v4 valides — @IsUUID() côté API rejette les UUID "inventés"
// dont le nibble de version n'est pas 1-5) — voir la note d'idempotence ci-dessus.
const TENANT_A_ID = '3e91b057-f0f3-4410-9c4a-8541896328a6';
const TENANT_B_ID = '4e5f8f93-a704-42db-a2ac-33a310c58e8e';

async function hash(pw: string) {
  return argon2.hash(pw);
}

async function createRoleTemplates() {
  // NB : on utilise findFirst + create plutôt qu'un upsert sur la clé composite
  // (tenantId, key), car tenantId est nullable pour les rôles-modèles et Postgres
  // ne considère jamais deux NULL comme égaux dans une contrainte unique standard
  // (cf migration "role_template_partial_unique" pour le filet de sécurité DB).
  // Les rôles-modèles sont globaux (tenantId null) : PAS réinitialisés à chaque
  // run, seulement complétés/mis à jour si le catalogue de permissions a changé.
  const roleIdByKey: Record<string, string> = {};
  for (const template of Object.values(ROLE_TEMPLATES)) {
    let role = await prisma.role.findFirst({
      where: { tenantId: null, key: template.key },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          id: newId(),
          tenantId: null,
          key: template.key,
          name: template.name,
          isTemplate: true,
        },
      });
    }
    roleIdByKey[template.key] = role.id;
    for (const permissionKey of template.permissions) {
      const existing = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionKey },
      });
      if (!existing) {
        await prisma.rolePermission.create({
          data: { id: newId(), tenantId: null, roleId: role.id, permissionKey },
        });
      }
    }
  }
  return roleIdByKey;
}

/**
 * Supprime toutes les données d'un tenant de démo dans l'ordre imposé par les
 * contraintes de clé étrangère (enfants avant parents), puis le tenant
 * lui-même. Se connecte via le rôle superuser (comme tout le script), donc
 * bypass RLS intentionnellement — c'est un script d'administration/seed, pas
 * un chemin applicatif normal.
 */
async function resetTenant(tenantId: string) {
  await prisma.socialMessage.deleteMany({ where: { tenantId } });
  await prisma.socialConversation.deleteMany({ where: { tenantId } });
  await prisma.socialConsent.deleteMany({ where: { tenantId } });
  await prisma.socialAccount.deleteMany({ where: { tenantId } });
  await prisma.productAlias.deleteMany({ where: { tenantId } });
  await prisma.platformInvoice.deleteMany({ where: { tenantId } });
  await prisma.platformSubscription.deleteMany({ where: { tenantId } });
  await prisma.delivery.deleteMany({ where: { tenantId } });
  await prisma.returnLine.deleteMany({ where: { tenantId } });
  await prisma.return.deleteMany({ where: { tenantId } });
  await prisma.purchaseOrderLine.deleteMany({ where: { tenantId } });
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } });
  await prisma.supplierMovement.deleteMany({ where: { tenantId } });
  await prisma.supplierAccount.deleteMany({ where: { tenantId } });
  await prisma.supplier.deleteMany({ where: { tenantId } });
  await prisma.orderLine.deleteMany({ where: { tenantId } });
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.stockTransferLine.deleteMany({ where: { tenantId } });
  await prisma.stockTransfer.deleteMany({ where: { tenantId } });
  await prisma.stockBatch.deleteMany({ where: { tenantId } });
  await prisma.warranty.deleteMany({ where: { tenantId } });
  await prisma.warrantyPolicy.deleteMany({ where: { tenantId } });
  await prisma.serialNumber.deleteMany({ where: { tenantId } });
  await prisma.productBarcode.deleteMany({ where: { tenantId } });
  await prisma.bundleComponent.deleteMany({ where: { tenantId } });
  await prisma.cashMovement.deleteMany({ where: { tenantId } });
  await prisma.cashSession.deleteMany({ where: { tenantId } });
  await prisma.tenantSetting.deleteMany({ where: { tenantId } });
  await prisma.locationSetting.deleteMany({ where: { tenantId } });
  await prisma.tenantCapability.deleteMany({ where: { tenantId } });
  await prisma.tenantModule.deleteMany({ where: { tenantId } });
  await prisma.businessProfile.deleteMany({ where: { tenantId } });
  await prisma.saleLine.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.document.deleteMany({ where: { tenantId } });
  await prisma.documentSequence.deleteMany({ where: { tenantId } });
  await prisma.sale.deleteMany({ where: { tenantId } });
  await prisma.creditMovement.deleteMany({ where: { tenantId } });
  await prisma.creditAccount.deleteMany({ where: { tenantId } });
  await prisma.customerPriceOverride.deleteMany({ where: { tenantId } });
  await prisma.quantityPriceTier.deleteMany({ where: { tenantId } });
  await prisma.productUnit.deleteMany({ where: { tenantId } });
  await prisma.stockMovement.deleteMany({ where: { tenantId } });
  await prisma.stockLevel.deleteMany({ where: { tenantId } });
  await prisma.outboxEvent.deleteMany({ where: { tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.refreshToken.deleteMany({ where: { tenantId } });
  await prisma.invitation.deleteMany({ where: { tenantId } });
  await prisma.userRole.deleteMany({ where: { tenantId } });
  await prisma.device.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.expense.deleteMany({ where: { tenantId } });
  await prisma.storedFile.deleteMany({ where: { tenantId } });
  await prisma.automationExecutionLog.deleteMany({ where: { tenantId } });
  await prisma.automationRule.deleteMany({ where: { tenantId } });
  await prisma.diagnosticScan.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.category.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.location.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}


async function createPlatformPlansAndSuperadmin() {
  const superadminEmail = 'admin@platform.saas';
  const existingAdmin = await prisma.platformAdminUser.findUnique({ where: { email: superadminEmail } });
  if (!existingAdmin) {
    await prisma.platformAdminUser.create({
      data: {
        id: newId(),
        email: superadminEmail,
        passwordHash: await hash(DEV_PASSWORD),
        fullName: 'Super Administrateur Plateforme',
        role: 'SUPERADMIN',
        status: 'ACTIVE',
      },
    });
  }

  const plans = [
    {
      key: 'TRIAL',
      name: 'Essai Gratuit 14 jours',
      description: 'Découvrez le gestionnaire pendant 14 jours avant de choisir une durée commerciale.',
      priceMonthly: 0,
      currency: 'XOF',
      trialDays: 14,
      maxUsers: 3,
      maxLocations: 1,
      maxMonthlySales: 100,
      allowedCapabilities: ['inventory', 'customer_credit', 'custom_pricing', 'orders', 'purchases', 'returns', 'receipts'],
    },
    {
      key: 'STARTER',
      name: 'Starter Commerce',
      description: 'Idéal pour boutique unique et petit commerce de détail.',
      priceMonthly: DEFAULT_COMMERCIAL_MONTHLY_PRICE,
      currency: 'XOF',
      trialDays: 0,
      maxUsers: 2,
      maxLocations: 1,
      maxMonthlySales: 500,
      allowedCapabilities: ['inventory', 'customer_credit', 'custom_pricing', 'orders', 'purchases', 'returns', 'receipts', 'invoicing'],
    },
    {
      key: 'PRO',
      name: 'Professionnel Multi-boutiques',
      description: 'Pour commerces dynamiques avec plusieurs points de vente et logistique avancée.',
      priceMonthly: DEFAULT_COMMERCIAL_MONTHLY_PRICE,
      currency: 'XOF',
      trialDays: 0,
      maxUsers: 200,
      maxLocations: 20,
      maxMonthlySales: 5000,
      allowedCapabilities: [
        'inventory', 'multiple_locations', 'customer_credit', 'custom_pricing',
        'orders', 'purchases', 'returns', 'receipts', 'invoicing', 'delivery',
        'warranties', 'serial_numbers', 'variants', 'batch_tracking'
      ],
    },
    {
      key: 'ENTERPRISE',
      name: 'Entreprise & Réseau',
      description: 'Capacités illimitées, support prioritaire et fonctionnalités complètes.',
      priceMonthly: DEFAULT_COMMERCIAL_MONTHLY_PRICE,
      currency: 'XOF',
      trialDays: 0,
      maxUsers: 1000,
      maxLocations: 50,
      maxMonthlySales: 0,
      allowedCapabilities: [
        'inventory', 'multiple_locations', 'customer_credit', 'custom_pricing',
        'orders', 'purchases', 'returns', 'receipts', 'invoicing', 'delivery',
        'warranties', 'serial_numbers', 'variants', 'batch_tracking', 'services'
      ],
    },
  ];

  const planMap: Record<string, string> = {};
  for (const p of plans) {
    const existing = await prisma.platformPlan.findUnique({ where: { key: p.key } });
    if (!existing) {
      const created = await prisma.platformPlan.create({
        data: {
          id: newId(),
          ...p,
        },
      });
      planMap[p.key] = created.id;
    } else {
      await prisma.platformPlan.update({
        where: { id: existing.id },
        data: {
          priceMonthly: p.priceMonthly,
          maxUsers: p.maxUsers,
          maxLocations: p.maxLocations,
          maxMonthlySales: p.maxMonthlySales,
          allowedCapabilities: p.allowedCapabilities,
        },
      });
      planMap[p.key] = existing.id;
    }
  }
  await prisma.platformConfig.upsert({
    where: { key: 'commercial.subscription-tariff' },
    create: { id: newId(), key: 'commercial.subscription-tariff', value: DEFAULT_COMMERCIAL_MONTHLY_PRICE },
    update: {},
  });
  return planMap;
}

async function main() {
  console.log('Seed de développement — réinitialisation puis recréation des tenants de démonstration...');

  await resetTenant(TENANT_A_ID);
  await resetTenant(TENANT_B_ID);

  const roleIdByKey = await createRoleTemplates();
  const planMap = await createPlatformPlansAndSuperadmin();

  // ── Tenant A : "Boutique Alpha" — jeu de données complet (5 profils, 2 emplacements) ──
  const tenantA = await prisma.tenant.create({
    data: { id: TENANT_A_ID, name: 'Boutique Alpha (démo)', status: 'ACTIVE' },
  });
  // Profil de commerce (cf demande de continuation §3) : Alpha est une
  // boutique classique — toutes les capabilities déjà fonctionnelles restent
  // à leur défaut (true), on ne crée donc PAS de ligne TenantCapability pour
  // elles (absence de ligne = défaut du catalogue, cf BusinessProfileService).
  await prisma.businessProfile.create({
    data: { id: newId(), tenantId: tenantA.id, businessType: 'BOUTIQUE', onboardedAt: new Date() },
  });

  const storeA = await prisma.location.create({
    data: { id: newId(), tenantId: tenantA.id, name: 'Magasin Alpha Centre', normalizedName: normalizeLocationName('Magasin Alpha Centre'), type: 'STORE' },
  });
  const warehouseA = await prisma.location.create({
    data: { id: newId(), tenantId: tenantA.id, name: 'Dépôt Alpha Nord', normalizedName: normalizeLocationName('Dépôt Alpha Nord'), type: 'WAREHOUSE' },
  });

  const passwordHash = await hash(DEV_PASSWORD);

  async function createUser(tenantId: string, email: string, fullName: string) {
    return prisma.user.create({
      data: { id: newId(), tenantId, email, passwordHash, fullName, status: 'ACTIVE' },
    });
  }

  async function assignRole(
    tenantId: string,
    userId: string,
    roleKey: string,
    scopeType: 'ALL_LOCATIONS' | 'LOCATIONS' | 'OWN_RECORDS' | 'TEAM',
    scopeLocationIds: string[] = [],
  ) {
    return prisma.userRole.create({
      data: {
        id: newId(),
        tenantId,
        userId,
        roleId: roleIdByKey[roleKey],
        scopeType,
        scopeLocationIds,
      },
    });
  }

  const ownerA = await createUser(tenantA.id, 'owner@alpha.demo', 'Alice Owner');
  await assignRole(tenantA.id, ownerA.id, ROLE_TEMPLATES.TENANT_OWNER.key, 'ALL_LOCATIONS');

  const managerA = await createUser(tenantA.id, 'manager@alpha.demo', 'Marc Manager');
  await assignRole(tenantA.id, managerA.id, ROLE_TEMPLATES.MANAGER.key, 'ALL_LOCATIONS');

  const salesA = await createUser(tenantA.id, 'vendeur@alpha.demo', 'Sarah Vendeuse');
  await assignRole(tenantA.id, salesA.id, ROLE_TEMPLATES.SALES_USER.key, 'LOCATIONS', [storeA.id]);

  const warehouseUserA = await createUser(tenantA.id, 'depot@alpha.demo', 'Waël Dépôt');
  // Scope volontairement restreint au dépôt Nord uniquement (pas le magasin) :
  // sert au test RBAC "ne peut pas modifier le stock d'un autre emplacement"
  // (cf docs/architecture/08-roles-permissions.md §2 et le prompt de continuation §14).
  await assignRole(tenantA.id, warehouseUserA.id, ROLE_TEMPLATES.WAREHOUSE_USER.key, 'LOCATIONS', [
    warehouseA.id,
  ]);

  const financeA = await createUser(tenantA.id, 'finance@alpha.demo', 'Fatou Finance');
  await assignRole(tenantA.id, financeA.id, ROLE_TEMPLATES.FINANCE_USER.key, 'ALL_LOCATIONS');

  const categoryA = await prisma.category.create({
    data: { id: newId(), tenantId: tenantA.id, name: 'Épicerie' },
  });

  const [riz, huile, savon] = await Promise.all(
    [
      { sku: 'ALPHA-001', name: 'Riz 5kg', unit: 'piece', basePrice: '4500.0000' },
      { sku: 'ALPHA-002', name: 'Huile 1L', unit: 'piece', basePrice: '1200.0000' },
      { sku: 'ALPHA-003', name: 'Savon (carton de 24)', unit: 'carton', basePrice: '9600.0000' },
    ].map((p) =>
      prisma.product.create({
        data: {
          id: newId(),
          tenantId: tenantA.id,
          categoryId: categoryA.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          basePrice: p.basePrice,
          currency: 'XOF',
        },
      }),
    ),
  );
  const productsA = [riz, huile, savon];

  for (const location of [storeA, warehouseA]) {
    for (const product of productsA) {
      await prisma.stockLevel.create({
        data: {
          id: newId(),
          tenantId: tenantA.id,
          locationId: location.id,
          productId: product.id,
          quantityOnHand: '100.0000',
        },
      });
      await prisma.stockMovement.create({
        data: {
          id: newTransactionalId(),
          tenantId: tenantA.id,
          locationId: location.id,
          productId: product.id,
          movementType: 'adjustment',
          quantity: '100.0000',
          referenceType: 'seed',
          referenceId: newId(),
        },
      });
    }
  }

  const clientComptoir = await prisma.customer.create({
    data: { id: newId(), tenantId: tenantA.id, name: 'Client Comptoir', phone: '+22670000001' },
  });
  const kadi = await prisma.customer.create({
    data: {
      id: newId(),
      tenantId: tenantA.id,
      name: 'Kadi Traoré',
      phone: '+22670000002',
      creditLimit: '50000.0000', // exemple de limite de crédit (Credit Engine)
    },
  });

  // Exemples Pricing Engine : prix négocié pour Kadi sur l'huile, palier de
  // quantité sur le riz (à partir de 10 unités) — visibles immédiatement dans
  // /pricing et appliqués automatiquement à la prochaine vente correspondante.
  await prisma.customerPriceOverride.create({
    data: {
      id: newId(),
      tenantId: tenantA.id,
      customerId: kadi.id,
      productId: huile.id,
      price: '1000.0000',
    },
  });
  await prisma.quantityPriceTier.create({
    data: {
      id: newId(),
      tenantId: tenantA.id,
      productId: riz.id,
      minQuantity: '10.0000',
      price: '4200.0000',
    },
  });

  // Exemple Unit/Conversion Engine : le Riz se vend à la pièce (unité de
  // référence) mais aussi au carton de 10 — la vente en carton se convertit
  // automatiquement en pièces pour le stock (cf docs/architecture/02-moteurs.md §7 bis).
  await prisma.productUnit.create({
    data: { id: newId(), tenantId: tenantA.id, productId: riz.id, unit: 'carton', factor: '10' },
  });

  // Abonnement SaaS de Tenant A : Offre PRO active avec facture réglée
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const subA = await prisma.platformSubscription.create({
    data: {
      id: newId(),
      tenantId: tenantA.id,
      planId: planMap['PRO'],
      status: 'ACTIVE',
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
    },
  });

  await prisma.platformInvoice.create({
    data: {
      id: newId(),
      tenantId: tenantA.id,
      subscriptionId: subA.id,
      invoiceNumber: 'SAAS-2026-000001',
      amount: 35000,
      currency: 'XOF',
      status: 'PAID',
      periodStart: now,
      periodEnd: nextMonth,
      paidAt: now,
      paymentMethod: 'MANUAL_TRANSFER',
      paymentReference: 'REC-DEPOT-001',
      notes: 'Paiement initial comptoir éditeur SaaS',
    },
  });

  // Dépenses de démonstration pour Tenant A (Loyer, Électricité, Fournitures)
  await prisma.expense.createMany({
    data: [
      {
        id: newId(),
        tenantId: tenantA.id,
        locationId: storeA.id,
        category: 'RENT',
        amount: 150000,
        currency: 'XOF',
        description: 'Loyer mensuel Magasin Alpha Centre - Octobre 2026',
        beneficiary: 'Société Immobilière du Faso',
        paymentMethod: 'BANK_TRANSFER',
        status: 'PAID',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
        createdByUserId: ownerA.id,
        approvedByUserId: ownerA.id,
        paidAt: now,
      },
      {
        id: newId(),
        tenantId: tenantA.id,
        locationId: storeA.id,
        category: 'UTILITIES',
        amount: 35000,
        currency: 'XOF',
        description: 'Facture électricité SONABEL et eau ONEA',
        beneficiary: 'SONABEL / ONEA',
        paymentMethod: 'MOBILE_MONEY',
        status: 'PAID',
        createdByUserId: managerA.id,
        approvedByUserId: ownerA.id,
        paidAt: now,
      },
      {
        id: newId(),
        tenantId: tenantA.id,
        locationId: warehouseA.id,
        category: 'SUPPLIES',
        amount: 14500,
        currency: 'XOF',
        description: 'Cartons d\'emballage et rubans adhésifs dépôt',
        beneficiary: 'Papeterie Moderne',
        paymentMethod: 'CASH',
        status: 'APPROVED',
        createdByUserId: warehouseUserA.id,
        approvedByUserId: managerA.id,
      },
    ],
  });

  // Règle d'automatisation de démonstration
  const autoRule = await prisma.automationRule.create({
    data: {
      id: newId(),
      tenantId: tenantA.id,
      name: 'Alerte Stock Critique & Réapprovisionnement',
      description: 'Déclenche une alerte opérationnelle quand un stock descend sous 5 unités',
      trigger: 'STOCK_LOW',
      conditions: { stockBelow: 5 },
      actions: [{ type: 'ALERT', channel: 'IN_APP', recipientRole: 'manager' }],
      isActive: true,
      createdByUserId: ownerA.id,
    },
  });

  await prisma.automationExecutionLog.create({
    data: {
      id: newId(),
      tenantId: tenantA.id,
      ruleId: autoRule.id,
      triggerEvent: 'STOCK_LOW',
      status: 'SUCCESS',
      inputPayload: { product: 'Savon 200g', currentStock: 3, threshold: 5 },
      outputPayload: { alertCreated: true, notifiedRole: 'manager' },
      durationMs: 42,
    },
  });

  // Fichier stocké / Pièce jointe de démonstration
  await prisma.storedFile.create({
    data: {
      id: newId(),
      tenantId: tenantA.id,
      uploadedByUserId: ownerA.id,
      fileName: 'quittance-loyer-octobre-2026.pdf',
      originalName: 'Quittance_Loyer_Alpha_Oct2026.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 48512,
      hashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      storagePath: '/uploads/tenants/alpha/quittance-loyer-octobre-2026.pdf',
      storageProvider: 'LOCAL',
      category: 'EXPENSE_RECEIPT',
      scanStatus: 'CLEAN',
      isPublic: false,
    },
  });

  // ── Tenant B : "Boutique Beta" — reconfiguré en PRESTATAIRE DE SERVICES pur

  // (Commerce C du plan de test, cf demande de continuation §11) : inventory
  // désactivé, customer_credit désactivé, services activé. Sert à prouver
  // qu'une vente de service ne crée JAMAIS de mouvement de stock et qu'un
  // commerce sans gestion de stock reste pleinement fonctionnel.
  const tenantB = await prisma.tenant.create({
    data: { id: TENANT_B_ID, name: 'Beta Services (démo)', status: 'ACTIVE' },
  });
  await prisma.businessProfile.create({
    data: { id: newId(), tenantId: tenantB.id, businessType: 'SERVICES', onboardedAt: new Date() },
  });
  await prisma.tenantCapability.createMany({
    data: [
      { id: newId(), tenantId: tenantB.id, key: CAPABILITIES.INVENTORY, enabled: false },
      { id: newId(), tenantId: tenantB.id, key: CAPABILITIES.CUSTOMER_CREDIT, enabled: false },
      { id: newId(), tenantId: tenantB.id, key: CAPABILITIES.CUSTOM_PRICING, enabled: false },
      { id: newId(), tenantId: tenantB.id, key: CAPABILITIES.SERVICES, enabled: true },
    ],
  });

  const storeB = await prisma.location.create({
    data: { id: newId(), tenantId: tenantB.id, name: 'Atelier Beta', normalizedName: normalizeLocationName('Atelier Beta'), type: 'STORE' },
  });

  const ownerB = await createUser(tenantB.id, 'owner@beta.demo', 'Bakary Owner');
  await assignRole(tenantB.id, ownerB.id, ROLE_TEMPLATES.TENANT_OWNER.key, 'ALL_LOCATIONS');

  const salesB = await createUser(tenantB.id, 'vendeur@beta.demo', 'Béatrice Vendeuse');
  await assignRole(tenantB.id, salesB.id, ROLE_TEMPLATES.SALES_USER.key, 'LOCATIONS', [storeB.id]);

  const categoryB = await prisma.category.create({
    data: { id: newId(), tenantId: tenantB.id, name: 'Prestations' },
  });
  // SERVICE : jamais de stock propre (isStocked=false, cf CatalogService.create)
  // — aucune StockLevel/StockMovement ne doit exister pour ce produit.
  const productB = await prisma.product.create({
    data: {
      id: newId(),
      tenantId: tenantB.id,
      categoryId: categoryB.id,
      sku: 'BETA-SRV-001',
      name: 'Réparation ordinateur',
      type: 'SERVICE',
      unit: 'piece',
      basePrice: '15000.0000',
      currency: 'XOF',
      isStocked: false,
    },
  });
  await prisma.customer.create({
    data: { id: newId(), tenantId: tenantB.id, name: 'Client Comptoir Beta' },
  });

  // Abonnement SaaS de Tenant B : Essai TRIAL 14 jours
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  await prisma.platformSubscription.create({
    data: {
      id: newId(),
      tenantId: tenantB.id,
      planId: planMap['TRIAL'],
      status: 'TRIALING',
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
    },
  });

  console.log('\n─────────────────────────────────────────────');
  console.log('Seed terminé. Mot de passe pour tous les comptes de démo :', DEV_PASSWORD);
  console.log('─────────────────────────────────────────────');
  console.log('Superadmin Plateforme : admin@platform.saas');
  console.log('Tenant A — Boutique Alpha :', tenantA.id);
  console.log('  Souscription : PRO (ACTIVE, 10 users, 5 locations, 5000 ventes/mois)');
  console.log('  Facture SaaS réglée : INV-SAAS-2026-0001 (35 000 XOF)');
  console.log('  owner@alpha.demo      (Propriétaire, toutes locations)');
  console.log('  manager@alpha.demo    (Gestionnaire, toutes locations)');
  console.log('  vendeur@alpha.demo    (Vendeur, scope: Magasin Alpha Centre)');
  console.log('  depot@alpha.demo      (Gestionnaire dépôt, scope: Dépôt Alpha Nord SEULEMENT)');
  console.log('  finance@alpha.demo    (Finance, toutes locations)');
  console.log('  Client "Kadi Traoré" : limite de crédit 50000 XOF, prix négocié Huile 1L = 1000 XOF');
  console.log('  Palier de quantité "Riz 5kg" : 4200 XOF/unité à partir de 10 unités');
  console.log('Tenant B — Beta Services (prestataire de services, sans stock) :', tenantB.id);
  console.log('  Souscription : TRIAL (TRIALING 14 jours, 3 users, 1 location, 100 ventes/mois)');
  console.log('  owner@beta.demo       (Propriétaire, toutes locations)');
  console.log('  vendeur@beta.demo     (Vendeur, scope: Atelier Beta)');
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

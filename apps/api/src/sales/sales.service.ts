import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CAPABILITIES, newId, newTransactionalId, SETTINGS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { CreditService } from '../credit/credit.service.js';
import { ConfigurationService } from '../config/config.service.js';
import { UnitsService } from '../units/units.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { PERMISSIONS } from '@gestionnaire/db';
import type { CreateSaleDto } from './dto/create-sale.dto.js';

/**
 * Vente comme opération transactionnelle unique (stock + paiement + audit) —
 * cf docs/architecture/01-analyse-risques.md §4.1. Version simplifiée de la
 * cible : Pricing avancé, taxes, remises, crédit, paiement multi-méthode,
 * documents PDF sont PLANNED (voir docs/PROJECT_STATUS.md).
 */
@Injectable()
export class SalesService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly documents: DocumentsService,
    private readonly pricing: PricingService,
    private readonly credit: CreditService,
    private readonly config: ConfigurationService,
    private readonly units: UnitsService,
    private readonly businessProfile: BusinessProfileService,
    private readonly inventory: InventoryService,
    private readonly rbac: RbacService,
  ) {}

  /**
   * Traduit le scope RBAC effectif (cf RbacService.getRecordVisibility) en
   * clause Prisma — OWN_RECORDS / TEAM filtrent une LISTE de ventes, pas une
   * action ponctuelle sur un emplacement (PermissionGuard/`can()` ne
   * couvrent que ce second cas). Résolu AVANT d'ouvrir la transaction
   * principale : `resolveTeamMemberUserIds` ouvre sa propre transaction, et
   * Prisma ne supporte pas l'imbrication de transactions interactives (cf
   * piège déjà rencontré dans RolesService/CashRegisterService).
   */
  private async buildVisibilityWhere(tenantId: string, userId: string): Promise<Prisma.SaleWhereInput> {
    const visibility = await this.rbac.getRecordVisibility(tenantId, userId, PERMISSIONS.SALES_READ);
    if (visibility.allLocations) return {};

    const or: Prisma.SaleWhereInput[] = [];
    if (visibility.locationIds.length > 0) {
      or.push({ locationId: { in: visibility.locationIds } });
    }
    if (visibility.ownRecordsOnly) {
      or.push({ sellerUserId: userId });
    }
    if (visibility.teamLocationIds.length > 0) {
      const teamUserIds = await this.rbac.resolveTeamMemberUserIds(tenantId, visibility.teamLocationIds);
      if (teamUserIds.length > 0) {
        or.push({ sellerUserId: { in: teamUserIds } });
      }
    }
    // Aucun scope reconnu (grants vides ou uniquement des scopes non
    // applicables ici) : fail-closed, aucun enregistrement visible plutôt
    // qu'un filtre absent qui montrerait tout le tenant par erreur.
    return or.length > 0 ? { OR: or } : { id: '__none__' };
  }

  async list(tenantId: string, userId: string, requestedLimit?: number) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    const take = requestedLimit === undefined ? undefined : Math.max(1, Math.min(Math.floor(requestedLimit), 100));
    return this.db.run(tenantId, (tx) =>
      tx.sale.findMany({
        where: { tenantId, deletedAt: null, ...visibilityWhere },
        include: { lines: true, payments: true, documents: true },
        orderBy: { createdAt: 'desc' },
        ...(take ? { take } : {}),
      }),
    );
  }

  async getById(tenantId: string, userId: string, id: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    const sale = await this.db.run(tenantId, (tx) =>
      tx.sale.findFirst({
        where: { id, tenantId, ...visibilityWhere },
        include: { lines: true, payments: true, documents: true },
      }),
    );
    // Hors scope de visibilité = "introuvable", jamais "interdit" : pas de
    // fuite d'existence d'une vente hors du périmètre de l'utilisateur.
    if (!sale) throw new NotFoundException('Vente introuvable');
    return sale;
  }

  /**
   * Vérifie/décrémente le stock d'un produit en unité de RÉFÉRENCE, avec
   * verrouillage pessimiste (cf docs/architecture/01-analyse-risques.md §4.3).
   * Factorisé pour être appelé aussi bien pour la ligne principale que pour
   * chaque composant d'un BUNDLE (cf docs/architecture/02-moteurs.md §6).
   */
  private async decrementStockOrThrow(
    tx: Prisma.TransactionClient,
    tenantId: string,
    locationId: string,
    productId: string,
    productName: string,
    quantity: Prisma.Decimal,
  ): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string; quantityOnHand: Prisma.Decimal }[]>`
      SELECT id, "quantityOnHand" FROM "StockLevel"
      WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${locationId}::uuid AND "productId" = ${productId}::uuid
      FOR UPDATE
    `;
    const available = rows[0]?.quantityOnHand ?? new Prisma.Decimal(0);
    if (rows.length === 0 || available.lessThan(quantity)) {
      const allowNegative = await this.config.getWithTx<boolean>(
        tx,
        tenantId,
        SETTINGS.ALLOW_NEGATIVE_STOCK,
      );
      if (!allowNegative) {
        throw new BadRequestException(
          `Stock insuffisant pour "${productName}" : disponible ${available.toString()}, demandé ${quantity.toString()}`,
        );
      }
    }
    if (rows.length === 0) {
      await tx.stockLevel.create({
        data: { id: newId(), tenantId, locationId, productId, quantityOnHand: quantity.negated() },
      });
    } else {
      await tx.stockLevel.update({
        where: { id: rows[0].id },
        data: { quantityOnHand: available.minus(quantity) },
      });
    }
  }

  async create(tenantId: string, sellerUserId: string, dto: CreateSaleDto, progressivePurchaseCaseId?: string) {
    return this.db.run(tenantId, async (tx) => {
      if (progressivePurchaseCaseId) {
        await tx.$queryRaw`SELECT id FROM "ProgressivePurchaseCase" WHERE id = ${progressivePurchaseCaseId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      }
      // Idempotence : renvoyer la même operationId (retry réseau) retourne la
      // vente déjà créée plutôt que d'en recréer une — cf
      // docs/architecture/01-analyse-risques.md §4.4.
      const existing = await tx.sale.findFirst({
        where: { tenantId, operationId: dto.operationId },
        include: { lines: true, payments: true, documents: true },
      });
      if (existing) {
        // Contrôle d'intégrité de l'idempotence (Correction S1-01) :
        // Si le même operationId est réutilisé avec un contenu différent (autre client, autre magasin ou articles différents),
        // c'est un conflit d'opération ou une collision multi-onglets -> Refus 409 Conflict.
        const isSameLocation = existing.locationId === dto.locationId;
        const isSameCustomer = (existing.customerId ?? null) === (dto.customerId ?? null);
        const isSameLineCount = existing.lines.length === dto.lines.length;

        // Contrôle fin des lignes : produit, quantité exacte et prix négocié
        const existingLineMap = new Map(existing.lines.map((l) => [l.productId, l]));
        let allLinesMatch = isSameLineCount;
        if (allLinesMatch) {
          for (const l of dto.lines) {
            const exLine = existingLineMap.get(l.productId);
            if (!exLine) {
              allLinesMatch = false;
              break;
            }
            if (Number(exLine.quantity) !== Number(l.quantity)) {
              allLinesMatch = false;
              break;
            }
            if (l.unitPriceOverride && Number(exLine.unitPriceSnapshot) !== Number(l.unitPriceOverride)) {
              allLinesMatch = false;
              break;
            }
          }
        }

        // Contrôle des paiements : comparaison du nombre et du montant total payé
        let allPaymentsMatch = true;
        if (dto.payments && dto.payments.length > 0) {
          if (dto.payments.length !== existing.payments.length) {
            allPaymentsMatch = false;
          } else {
            const dtoPaymentTotal = dto.payments.reduce((acc, p) => acc + Number(p.amount), 0);
            const exPaymentTotal = existing.payments.reduce((acc, p) => acc + Number(p.amount), 0);
            if (Math.abs(dtoPaymentTotal - exPaymentTotal) > 0.01) {
              allPaymentsMatch = false;
            }
          }
        }

        if (!isSameLocation || !isSameCustomer || !allLinesMatch || !allPaymentsMatch) {
          throw new ConflictException(
            `VTM-SALE-IDEMPOTENCY-PAYLOAD-MISMATCH: La clé d'opération ${dto.operationId} a déjà été validée pour une vente avec un contenu différent (articles, quantités, prix ou paiements distincts). Chaque panier distinct doit posséder son propre identifiant d'opération.`,
          );
        }

        return existing;
      }

      // Quota et statut d'abonnement SaaS (Platform Engine)
      const sub = await tx.platformSubscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      });
      if (sub) {
        if (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED') {
          throw new BadRequestException(
            `Espace de travail suspendu (${sub.status}). Impossible d'effectuer une nouvelle vente. Veuillez régulariser votre abonnement.`,
          );
        }
        if (sub.plan.maxMonthlySales > 0) {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthlySalesCount = await tx.sale.count({
            where: { tenantId, createdAt: { gte: startOfMonth } },
          });
          if (monthlySalesCount >= sub.plan.maxMonthlySales) {
            throw new BadRequestException(
              `Quota de ventes mensuelles atteint pour votre abonnement (${monthlySalesCount}/${sub.plan.maxMonthlySales}). Veuillez passer à une offre supérieure.`,
            );
          }
        }
      }

      // Vérification emplacement : interdiction absolue de vente depuis un emplacement de quarantaine SAV
      const saleLocation = await tx.location.findFirst({
        where: { id: dto.locationId, tenantId, deletedAt: null },
      });
      if (!saleLocation) {
        throw new BadRequestException('Emplacement introuvable');
      }
      if (saleLocation.type === 'QUARANTINE') {
        throw new BadRequestException("Impossible d'effectuer une vente depuis un emplacement de quarantaine SAV");
      }

      const currency =
        dto.currency ?? (await this.config.getWithTx<string>(tx, tenantId, SETTINGS.DEFAULT_CURRENCY));
      // Généré tôt : nécessaire comme referenceId des mouvements de stock des
      // composants de bundle, créés avant l'écriture de la vente elle-même.
      const saleId = newTransactionalId();

      const productIds = dto.lines.map((l) => l.productId);
      const products = await tx.product.findMany({
        where: { tenantId, id: { in: productIds }, deletedAt: null },
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      let subtotal = new Prisma.Decimal(0);
      const lineInputs: {
        id: string;
        productId: string;
        productNameSnapshot: string;
        unitSnapshot: string;
        quantity: Prisma.Decimal;
        conversionFactorSnapshot: Prisma.Decimal;
        unitPriceSnapshot: Prisma.Decimal;
        appliedPriceRule: string;
        lineTotal: Prisma.Decimal;
        isStocked: boolean;
        referenceQuantity: Prisma.Decimal;
        serialNumbers: string[];
        costPriceSnapshot: Prisma.Decimal | null;
      }[] = [];

      // Approvisionnement immédiat + Vente (Section 9 du CDC)
      if (dto.immediateRestocks && dto.immediateRestocks.length > 0) {
        for (const ir of dto.immediateRestocks) {
          const restockQty = new Prisma.Decimal(ir.quantity);
          if (restockQty.lessThanOrEqualTo(0)) {
            throw new BadRequestException("La quantité d'approvisionnement immédiat doit être strictement positive");
          }
          const p =
            productById.get(ir.productId) ??
            (await tx.product.findFirst({ where: { id: ir.productId, tenantId, deletedAt: null } }));
          if (!p) {
            throw new BadRequestException(`Produit introuvable pour l'approvisionnement immédiat : ${ir.productId}`);
          }
          if (!p.isStocked || p.type === 'SERVICE') {
            throw new BadRequestException(`Le produit "${p.name}" n'est pas un article stocké`);
          }
          if (!p.isFractional && !restockQty.isInteger()) {
            throw new BadRequestException(
              `Quantité décimale (${restockQty.toString()}) interdite pour "${p.name}" géré en unités entières`,
            );
          }

          // Verrouillage et incrémentation du stock
          const stockRows = await tx.$queryRaw<{ id: string; quantityOnHand: Prisma.Decimal }[]>`
            SELECT id, "quantityOnHand" FROM "StockLevel"
            WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${dto.locationId}::uuid AND "productId" = ${ir.productId}::uuid
            FOR UPDATE
          `;
          let stockLevelId: string;
          let newQty: Prisma.Decimal;
          if (stockRows.length === 0) {
            newQty = restockQty;
            const created = await tx.stockLevel.create({
              data: {
                id: newId(),
                tenantId,
                locationId: dto.locationId,
                productId: ir.productId,
                quantityOnHand: newQty,
              },
            });
            stockLevelId = created.id;
          } else {
            stockLevelId = stockRows[0].id;
            newQty = stockRows[0].quantityOnHand.plus(restockQty);
            await tx.stockLevel.update({
              where: { id: stockLevelId },
              data: { quantityOnHand: newQty },
            });
          }

          // Mouvement d'entrée traçable (Section 9 CDC)
          await tx.stockMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              locationId: dto.locationId,
              productId: ir.productId,
              movementType: 'purchase_receipt',
              quantity: restockQty,
              referenceType: 'sale_immediate_restock',
              referenceId: saleId,
            },
          });

          // Événement d'audit traçable outbox (Section 9 CDC)
          await tx.outboxEvent.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              eventType: 'inventory.immediate_restock',
              payload: {
                actorUserId: sellerUserId,
                entityType: 'StockLevel',
                entityId: stockLevelId,
                productId: ir.productId,
                productName: p.name,
                locationId: dto.locationId,
                quantity: restockQty.toString(),
                saleId,
                source: ir.source ?? 'Présent physiquement en boutique',
                costPrice: ir.costPrice ?? null,
              },
            },
          });
        }
      }

      // Triage déterministe par productId pour éliminer mathématiquement tout risque de deadlock PostgreSQL (40P01)
      // lorsque plusieurs caisses vendent simultanément les mêmes articles dans des ordres différents
      const sortedLines = [...dto.lines].sort((a, b) => a.productId.localeCompare(b.productId));
      for (const line of sortedLines) {
        const product = productById.get(line.productId);
        if (!product) {
          throw new BadRequestException(`Produit introuvable ou inactif : ${line.productId}`);
        }
        // Variantes (Phase 12) : un produit parent avec des variantes n'est
        // plus qu'un regroupement visuel — il faut vendre une variante
        // précise (son propre productId), jamais le parent lui-même.
        if (product.hasVariants) {
          throw new BadRequestException(
            `"${product.name}" a des variantes : sélectionnez la variante précise à vendre`,
          );
        }
        const quantity = new Prisma.Decimal(line.quantity);
        // ATTENTION : Decimal#isPositive() de decimal.js signifie "signe non
        // négatif" (vrai aussi pour zéro), PAS "strictement positif" — piège
        // classique de cette librairie. Toujours utiliser .greaterThan(0) /
        // .lessThanOrEqualTo(0) quand on veut réellement exclure zéro.
        if (quantity.lessThanOrEqualTo(0)) {
          throw new BadRequestException('La quantité doit être strictement positive');
        }

        // Numéros de série (Phase 12) : la quantité seule ne suffit plus à
        // identifier QUELLE unité physique est vendue — chaque numéro fourni
        // doit exister, être disponible, et leur nombre doit correspondre
        // exactement à la quantité vendue (une unité = un numéro).
        let serialNumbers: string[] = [];
        if (product.tracksSerialNumbers) {
          const provided = line.serialNumbers ?? [];
          if (!quantity.equals(provided.length)) {
            throw new BadRequestException(
              `"${product.name}" suit les numéros de série : ${provided.length} numéro(s) fourni(s) pour une quantité de ${quantity.toString()}`,
            );
          }
          const uniqueProvided = [...new Set(provided)];
          if (uniqueProvided.length !== provided.length) {
            throw new BadRequestException('Numéros de série en double dans la même ligne');
          }
          const rows = await tx.serialNumber.findMany({
            where: { tenantId, productId: product.id, serial: { in: provided } },
          });
          const rowBySerial = new Map(rows.map((r) => [r.serial, r]));
          for (const serial of provided) {
            const row = rowBySerial.get(serial);
            if (!row || row.status !== 'AVAILABLE') {
              throw new BadRequestException(
                `Numéro de série indisponible pour "${product.name}" : ${serial}`,
              );
            }
          }
          serialNumbers = provided;
        }

        // Les bundles ne supportent pas les unités alternatives (PLANNED) —
        // chaque composant a sa propre unité de référence, une conversion
        // globale au niveau du bundle n'aurait pas de sens univoque.
        if (product.type === 'BUNDLE' && line.unit && line.unit !== product.unit) {
          throw new BadRequestException(
            `Le bundle "${product.name}" ne supporte pas les unités alternatives`,
          );
        }

        // Unit/Conversion Engine : la quantité peut être exprimée dans une
        // unité alternative (ex: "carton") ; le stock et le pricing raisonnent
        // toujours en unité de RÉFÉRENCE du produit (cf ProductUnit).
        const resolvedUnit =
          product.type === 'BUNDLE'
            ? { unit: product.unit, factor: new Prisma.Decimal(1), isReferenceUnit: true }
            : await this.units.resolveUnit(tx, tenantId, product.id, product.unit, line.unit);
        const referenceQuantity = quantity.times(resolvedUnit.factor);

        // Règle des quantités entières (Section 4 du CDC) :
        // Pour les produits physiques non fractionnables, refuser toute quantité décimale
        if (!product.isFractional && product.type !== 'SERVICE') {
          if (!quantity.isInteger()) {
            throw new BadRequestException(
              `Quantité décimale (${quantity.toString()}) interdite pour "${product.name}" géré en unités entières`,
            );
          }
          if (!referenceQuantity.isInteger()) {
            throw new BadRequestException(
              `La conversion en unité de référence (${resolvedUnit.unit}) produit une quantité non entière (${referenceQuantity.toString()}) pour "${product.name}"`,
            );
          }
        }

        if (product.isStocked) {
          // Verrouillage pessimiste court (cf docs/architecture/01-analyse-risques.md §4.3) :
          // deux ventes concurrentes sur la même ligne de stock ne peuvent pas
          // toutes les deux réussir si le stock est insuffisant pour l'une d'elles.
          await this.decrementStockOrThrow(
            tx,
            tenantId,
            dto.locationId,
            product.id,
            product.name,
            referenceQuantity,
          );

          // Lots/péremption (Phase 13) : EN PLUS de la décrémentation du total
          // (jamais à la place), consomme les lots les plus proches de
          // péremption en premier (FEFO) — échoue si le total réparti en lots
          // est insuffisant, cohérent avec le refus de sur-vente sur le total.
          if (product.tracksBatches) {
            await this.inventory.consumeBatchesFefoWithTx(
              tx,
              tenantId,
              dto.locationId,
              product.id,
              product.name,
              referenceQuantity,
            );
          }
        }

        // BUNDLE (cf docs/architecture/02-moteurs.md §6) : le bundle lui-même
        // n'est jamais stocké (isStocked=false forcé à la création) — c'est
        // CHAQUE COMPOSANT qui est décrémenté, proportionnellement à la
        // quantité de bundles vendus. Un mouvement de stock est créé par
        // composant, tous rattachés à CETTE vente (referenceId = saleId).
        if (product.type === 'BUNDLE') {
          const bundleComponents = await tx.bundleComponent.findMany({
            where: { tenantId, bundleProductId: product.id },
          });
          if (bundleComponents.length === 0) {
            throw new BadRequestException(`Le bundle "${product.name}" n'a aucun composant configuré`);
          }
          const componentIds = bundleComponents.map((c) => c.componentProductId);
          const componentProducts = await tx.product.findMany({
            where: { tenantId, id: { in: componentIds }, deletedAt: null },
          });
          const componentById = new Map(componentProducts.map((c) => [c.id, c]));

          for (const bc of bundleComponents) {
            const componentProduct = componentById.get(bc.componentProductId);
            if (!componentProduct) {
              throw new BadRequestException(
                `Composant introuvable ou inactif pour le bundle "${product.name}"`,
              );
            }
            if (!componentProduct.isStocked) continue;
            const requiredQty = referenceQuantity.times(bc.quantity);
            await this.decrementStockOrThrow(
              tx,
              tenantId,
              dto.locationId,
              componentProduct.id,
              componentProduct.name,
              requiredQty,
            );
            await tx.stockMovement.create({
              data: {
                id: newTransactionalId(),
                tenantId,
                locationId: dto.locationId,
                productId: componentProduct.id,
                movementType: 'sale',
                quantity: requiredQty.negated(),
                referenceType: 'sale',
                referenceId: saleId,
              },
            });
          }
        }

        // Le Pricing Engine raisonne en unité de référence (tiers de quantité,
        // prix négocié) : on lui passe referenceQuantity, puis on ramène le
        // prix résultant à l'unité vendue pour l'affichage/snapshot.
        // Si un unitPriceOverride est fourni (ex: conversion de commande/devis),
        // ce tarif convenu est scrupuleusement respecté sans subir les hausses catalogue.
        let referenceUnitPrice: Prisma.Decimal;
        let appliedRule: string;

        if (line.unitPriceOverride) {
          const overrideVal = new Prisma.Decimal(line.unitPriceOverride);
          if (overrideVal.lessThan(0)) {
            throw new BadRequestException('Le prix unitaire convenu ne peut pas être négatif');
          }
          referenceUnitPrice = resolvedUnit.factor.isZero()
            ? overrideVal
            : overrideVal.dividedBy(resolvedUnit.factor);
          appliedRule = 'ORDER_QUOTE_SNAPSHOT';
        } else {
          const resolved = await this.pricing.resolveUnitPrice(
            tx,
            tenantId,
            product.id,
            dto.customerId,
            referenceQuantity,
            product.basePrice,
          );
          referenceUnitPrice = resolved.unitPrice;
          appliedRule = resolved.appliedRule;
        }

        // Résolution des rôles pour plafonner les remises commerciales
        const userRoles = await tx.userRole.findMany({
          where: { tenantId, userId: sellerUserId },
          include: { role: true },
        });
        const roleKeys = new Set(userRoles.map((ur) => ur.role.key.toLowerCase()));
        const isOwner = roleKeys.has('tenant_owner') || roleKeys.has('owner');
        const isManager = isOwner || roleKeys.has('manager') || roleKeys.has('store_manager');

        const sellerMaxDiscStr =
          (await this.config.getWithTx<string>(tx, tenantId, SETTINGS.DISCOUNT_MAX_SELLER_PERCENT)) ?? '5';
        const managerMaxDiscStr =
          (await this.config.getWithTx<string>(tx, tenantId, SETTINGS.DISCOUNT_MAX_MANAGER_PERCENT)) ?? '15';
        const maxAllowedDiscount = isOwner
          ? new Prisma.Decimal(100)
          : isManager
          ? new Prisma.Decimal(managerMaxDiscStr)
          : new Prisma.Decimal(sellerMaxDiscStr);

        let effectiveUnitPrice = referenceUnitPrice.times(resolvedUnit.factor);
        if (line.discountPercent !== undefined && line.discountPercent !== null && line.discountPercent !== '') {
          const lineDisc = new Prisma.Decimal(line.discountPercent);
          if (lineDisc.lessThan(0)) {
            throw new BadRequestException('Le pourcentage de remise ne peut pas être négatif');
          }
          if (lineDisc.greaterThan(maxAllowedDiscount)) {
            throw new BadRequestException(
              `Remise de ${lineDisc.toString()}% sur "${product.name}" supérieure au plafond autorisé pour votre rôle (${maxAllowedDiscount.toString()}% max)`,
            );
          }
          effectiveUnitPrice = effectiveUnitPrice.times(new Prisma.Decimal(1).minus(lineDisc.dividedBy(100)));
        }

        const lineTotal = effectiveUnitPrice.times(quantity);
        subtotal = subtotal.plus(lineTotal);

        let refCost: Prisma.Decimal | null = product.costPrice ? new Prisma.Decimal(product.costPrice) : null;
        if (!refCost) {
          const lastPurchase = await tx.purchaseOrderLine.findFirst({
            where: { tenantId, productId: product.id },
            orderBy: { purchaseOrder: { createdAt: 'desc' } },
            select: { unitCostSnapshot: true },
          });
          if (lastPurchase) {
            refCost = new Prisma.Decimal(lastPurchase.unitCostSnapshot);
          }
        }
        const costPriceSnapshot = refCost ? refCost.times(resolvedUnit.factor) : null;

        lineInputs.push({
          id: newTransactionalId(),
          productId: product.id,
          productNameSnapshot: product.name,
          unitSnapshot: resolvedUnit.unit,
          quantity,
          conversionFactorSnapshot: resolvedUnit.factor,
          unitPriceSnapshot: effectiveUnitPrice,
          appliedPriceRule: appliedRule,
          lineTotal,
          isStocked: product.isStocked,
          referenceQuantity,
          serialNumbers,
          costPriceSnapshot,
        });
      }

      // Remise commerciale globale sur le ticket
      const userRolesGlobal = await tx.userRole.findMany({
        where: { tenantId, userId: sellerUserId },
        include: { role: true },
      });
      const roleKeysGlobal = new Set(userRolesGlobal.map((ur) => ur.role.key.toLowerCase()));
      const isOwnerGlobal = roleKeysGlobal.has('tenant_owner') || roleKeysGlobal.has('owner');
      const isManagerGlobal = isOwnerGlobal || roleKeysGlobal.has('manager') || roleKeysGlobal.has('store_manager');

      const sellerMaxDiscStr =
        (await this.config.getWithTx<string>(tx, tenantId, SETTINGS.DISCOUNT_MAX_SELLER_PERCENT)) ?? '5';
      const managerMaxDiscStr =
        (await this.config.getWithTx<string>(tx, tenantId, SETTINGS.DISCOUNT_MAX_MANAGER_PERCENT)) ?? '15';
      const maxAllowedDiscountGlobal = isOwnerGlobal
        ? new Prisma.Decimal(100)
        : isManagerGlobal
        ? new Prisma.Decimal(managerMaxDiscStr)
        : new Prisma.Decimal(sellerMaxDiscStr);

      let discountTotal = new Prisma.Decimal(0);
      if (dto.discountPercent !== undefined && dto.discountPercent !== null && dto.discountPercent !== '') {
        const globalDisc = new Prisma.Decimal(dto.discountPercent);
        if (globalDisc.lessThan(0)) {
          throw new BadRequestException('La remise globale ne peut pas être négative');
        }
        if (globalDisc.greaterThan(maxAllowedDiscountGlobal)) {
          throw new BadRequestException(
            `Remise globale de ${globalDisc.toString()}% supérieure au plafond autorisé pour votre rôle (${maxAllowedDiscountGlobal.toString()}% max)`,
          );
        }
        discountTotal = subtotal.times(globalDisc.dividedBy(100));
      }
      const grandTotal = subtotal.minus(discountTotal);

      // Protection anti-vente à perte (interdiction de vente sous le coût de revient sans dérogation)
      const globalMultiplier =
        discountTotal.greaterThan(0) && subtotal.greaterThan(0)
          ? grandTotal.dividedBy(subtotal)
          : new Prisma.Decimal(1);

      for (const line of lineInputs) {
        const netUnitPrice = line.unitPriceSnapshot.times(globalMultiplier);
        if (
          line.costPriceSnapshot &&
          line.costPriceSnapshot.greaterThan(0) &&
          netUnitPrice.lessThan(line.costPriceSnapshot)
        ) {
          const allowBelowCost = await this.config.getWithTx<boolean>(tx, tenantId, SETTINGS.ALLOW_SALE_BELOW_COST);
          if (!allowBelowCost) {
            const hasOverride =
              dto.overrideBelowCost &&
              isManagerGlobal &&
              dto.belowCostReason &&
              dto.belowCostReason.trim().length > 0;
            if (!hasOverride) {
              throw new BadRequestException(
                `Vente sous le coût de revient interdite pour "${line.productNameSnapshot}" (Coût: ${line.costPriceSnapshot.toString()}, Prix net: ${netUnitPrice.toFixed(2)}). Une autorisation responsable avec motif obligatoire est requise.`,
              );
            }
            await tx.outboxEvent.create({
              data: {
                id: newTransactionalId(),
                tenantId,
                eventType: 'sales.sale.below_cost_override',
                payload: {
                  saleId,
                  sellerUserId,
                  productId: line.productId,
                  productName: line.productNameSnapshot,
                  costPrice: line.costPriceSnapshot.toString(),
                  sellingPrice: netUnitPrice.toString(),
                  reason: dto.belowCostReason!.trim(),
                },
              },
            });
          }
        }
      }

      // Paiement multi-méthode / partiel (cf docs/architecture/02-moteurs.md §13).
      // Si aucun paiement n'est fourni, comportement historique : encaissement
      // comptant intégral (compatibilité avec les clients qui n'envoient pas ce champ).
      let progressiveCase: { id: string; reference: string; locationId: string; customerId: string; productId: string | null; productPriceSnapshot: Prisma.Decimal | null; status: string } | null = null;
      if (progressivePurchaseCaseId) {
        progressiveCase = await tx.progressivePurchaseCase.findFirst({ where: { id: progressivePurchaseCaseId, tenantId } });
        if (!progressiveCase || ['CANCELLED', 'REFUNDED', 'REDEEMED'].includes(progressiveCase.status)) throw new BadRequestException('Dossier de versements indisponible pour le retrait');
        if (progressiveCase.locationId !== dto.locationId || progressiveCase.customerId !== dto.customerId || lineInputs.length !== 1 || progressiveCase.productId !== lineInputs[0].productId || !lineInputs[0].quantity.equals(1)) {
          throw new BadRequestException('La vente ne correspond pas au dossier de versements progressifs');
        }
        if (!progressiveCase.productPriceSnapshot || !progressiveCase.productPriceSnapshot.equals(grandTotal)) throw new ConflictException('Le prix final diffère du prix enregistré dans le dossier');
        const ledger = await tx.progressivePurchaseMovement.findMany({ where: { tenantId, caseId: progressiveCase.id }, select: { kind: true, amount: true } });
        const available = ledger.reduce((sum, movement) => movement.kind === 'DEPOSIT' ? sum.plus(movement.amount) : sum.minus(movement.amount), new Prisma.Decimal(0));
        if (available.lessThan(grandTotal)) throw new BadRequestException('Le solde des versements est insuffisant pour cette vente');
      }
      const paymentInputs: { method: string; amount: Prisma.Decimal; reference: string | null; status: string }[] = progressiveCase
        ? [{ method: 'PROGRESSIVE_BALANCE', amount: grandTotal, reference: `VPP-${progressiveCase.reference}`, status: 'COMPLETED' }]
        : dto.payments && dto.payments.length > 0
          ? dto.payments.map((p) => ({
              method: p.method,
              amount: new Prisma.Decimal(p.amount),
              reference: p.reference?.trim() || null,
              status: p.status || 'COMPLETED',
            }))
          : [{ method: 'CASH' as const, amount: grandTotal, reference: null, status: 'COMPLETED' as const }];

      const enabledMethods =
        (await this.config.getWithTx<string[]>(
          tx,
          tenantId,
          SETTINGS.ENABLED_PAYMENT_METHODS,
        )) ?? ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK'];
      for (const p of paymentInputs) {
        if (p.amount.lessThanOrEqualTo(0)) {
          throw new BadRequestException('Chaque paiement doit avoir un montant strictement positif');
        }
        if (p.method !== 'PROGRESSIVE_BALANCE' && !enabledMethods.includes(p.method)) {
          throw new BadRequestException(
            `Moyen de paiement désactivé pour ce tenant : ${p.method} (cf Paramètres)`,
          );
        }
        // Vérification stricte Mobile Money : ne jamais valider un paiement Mobile Money sans référence
        if (p.method === 'MOBILE_MONEY') {
          if (p.status === 'FAILED') {
            throw new BadRequestException('Le paiement Mobile Money spécifié est marqué en échec');
          }
          if (!p.reference || p.reference.length === 0) {
            throw new BadRequestException(
              'Une référence de transaction Mobile Money valide (ex: ID opérateur) est obligatoire pour valider le paiement',
            );
          }
        }
      }

      const amountPaid = paymentInputs.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));

      // Calcul du rendu de monnaie automatique
      let changeGiven = new Prisma.Decimal(0);
      let tenderedAmountDecimal: Prisma.Decimal | null = null;
      if (dto.tenderedAmount !== undefined && dto.tenderedAmount !== null && String(dto.tenderedAmount).trim() !== '') {
        tenderedAmountDecimal = new Prisma.Decimal(dto.tenderedAmount);
        if (tenderedAmountDecimal.lessThan(0)) {
          throw new BadRequestException('Le montant remis ne peut pas être négatif');
        }
        const cashAmount = paymentInputs
          .filter((p) => p.method === 'CASH')
          .reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));
        if (tenderedAmountDecimal.lessThan(cashAmount)) {
          throw new BadRequestException(
            `Le montant remis (${tenderedAmountDecimal.toString()}) est inférieur au montant à payer en espèces (${cashAmount.toString()})`,
          );
        }
        changeGiven = tenderedAmountDecimal.minus(cashAmount);
      }

      if (amountPaid.greaterThan(grandTotal)) {
        throw new BadRequestException(
          `Le total des paiements affectés à la vente (${amountPaid.toString()}) dépasse le montant net de la vente (${grandTotal.toString()})`,
        );
      }
      const balanceDue = grandTotal.minus(amountPaid);
      const paymentStatus = amountPaid.isZero() ? 'UNPAID' : balanceDue.isZero() ? 'PAID' : 'PARTIAL';

      // Règle générale (plus stricte que le crédit) : ce commerce peut exiger un
      // client sur TOUTE vente, payée ou non. Configurable : sales.requireCustomerAlways
      // (désactivé par défaut, pour ne rien changer au comportement existant).
      const requireCustomerAlways = await this.config.getWithTx<boolean>(
        tx,
        tenantId,
        SETTINGS.REQUIRE_CUSTOMER_ALWAYS,
      );
      if (!dto.customerId && requireCustomerAlways) {
        throw new BadRequestException(
          'Un client doit être sélectionné pour toute vente (cf Paramètres)',
        );
      }

      // Une vente à crédit doit être rattachée à un client identifié — sans quoi
      // la dette ne pourrait être réclamée à personne (cf docs/architecture/02-moteurs.md §14).
      // Configurable : sales.requireCustomerForCreditSales (activé par défaut).
      if (balanceDue.greaterThan(0)) {
        // Fail-closed : si ce commerce n'utilise pas la vente à crédit, aucune
        // vente avec solde dû n'est autorisée, même avec un client sélectionné —
        // pas seulement "client requis". Défense en profondeur, comme
        // PricingService.resolveUnitPrice pour custom_pricing.
        const creditEnabled = await this.businessProfile.isCapabilityEnabledWithTx(
          tx,
          tenantId,
          CAPABILITIES.CUSTOMER_CREDIT,
        );
        if (!creditEnabled) {
          throw new BadRequestException(
            "La vente à crédit n'est pas activée pour ce commerce (cf Profil du commerce) : le paiement doit couvrir le montant total",
          );
        }

        const requireCustomerForCredit = await this.config.getWithTx<boolean>(
          tx,
          tenantId,
          SETTINGS.REQUIRE_CUSTOMER_FOR_CREDIT,
        );
        if (!dto.customerId && requireCustomerForCredit) {
          throw new BadRequestException(
            'Un client doit être sélectionné pour une vente avec solde dû (vente à crédit)',
          );
        }
      }

      await tx.sale.create({
        data: {
          id: saleId,
          tenantId,
          locationId: dto.locationId,
          customerId: dto.customerId,
          sellerUserId,
          currency,
          subtotal,
          taxTotal: new Prisma.Decimal(0),
          discountTotal,
          grandTotal,
          amountPaid,
          balanceDue,
          paymentStatus,
          operationId: dto.operationId,
        },
      });

      const warrantyPolicies = await tx.warrantyPolicy.findMany({
        where: { tenantId, productId: { in: lineInputs.map((l) => l.productId) } },
      });
      const warrantyPolicyByProduct = new Map(warrantyPolicies.map((w) => [w.productId, w]));
      const saleCreatedAt = new Date();

      for (const line of lineInputs) {
        await tx.saleLine.create({
          data: {
            id: line.id,
            tenantId,
            saleId,
            productId: line.productId,
            productNameSnapshot: line.productNameSnapshot,
            unitSnapshot: line.unitSnapshot,
            quantity: line.quantity,
            conversionFactorSnapshot: line.conversionFactorSnapshot,
            unitPriceSnapshot: line.unitPriceSnapshot,
            appliedPriceRule: line.appliedPriceRule,
            lineTotal: line.lineTotal,
            costPriceSnapshot: line.costPriceSnapshot,
          },
        });

        if (line.isStocked) {
          // En unité de RÉFÉRENCE (jamais l'unité vendue) — cf Unit/Conversion Engine.
          await tx.stockMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              locationId: dto.locationId,
              productId: line.productId,
              movementType: 'sale',
              quantity: line.referenceQuantity.negated(),
              referenceType: 'sale',
              referenceId: saleId,
            },
          });
        }

        // Numéros de série (Phase 12) : chaque unité vendue passe AVAILABLE -> SOLD,
        // rattachée à sa ligne de vente précise (traçabilité pour un retour ultérieur).
        if (line.serialNumbers.length > 0) {
          await tx.serialNumber.updateMany({
            where: { tenantId, productId: line.productId, serial: { in: line.serialNumbers } },
            data: { status: 'SOLD', saleLineId: line.id },
          });
        }

        // Garanties (Phase 12) : une garantie est créée automatiquement SI une
        // politique existe pour ce produit — snapshot immuable de sa durée
        // (cf commentaire sur le modèle Warranty), jamais recalculée si la
        // politique change ensuite. Une seule garantie par ligne (couvre
        // toute la quantité vendue sur cette ligne) — une garantie distincte
        // par unité individuelle pour un produit non sérialisé est PLANNED.
        const policy = warrantyPolicyByProduct.get(line.productId);
        if (policy) {
          const expiresAt = new Date(saleCreatedAt.getTime() + policy.durationDays * 24 * 60 * 60 * 1000);
          await tx.warranty.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              saleId,
              saleLineId: line.id,
              productId: line.productId,
              productNameSnapshot: line.productNameSnapshot,
              customerId: dto.customerId,
              durationDaysSnapshot: policy.durationDays,
              termsSnapshot: policy.terms,
              startDate: saleCreatedAt,
              expiresAt,
            },
          });
        }
      }

      // Rattachement best-effort à la session de caisse ouverte pour cet
      // emplacement (cf CashRegisterService) : n'existe que pour les
      // paiements CASH, reste NULL si aucune session n'est ouverte — une
      // vente ne dépend JAMAIS de l'existence d'une session de caisse.
      const hasCashPayment = paymentInputs.some((p) => p.method === 'CASH');
      const openCashSession = hasCashPayment
        ? await tx.cashSession.findFirst({ where: { tenantId, locationId: dto.locationId, status: 'OPEN' } })
        : null;

      for (const p of paymentInputs) {
        await tx.payment.create({
          data: {
            id: newTransactionalId(),
            tenantId,
            saleId,
            method: p.method,
            amount: p.amount,
            currency,
            status: 'COMPLETED',
            cashSessionId: p.method === 'CASH' ? (openCashSession?.id ?? null) : null,
          },
        });
      }

      // Dette client (cf docs/architecture/02-moteurs.md §14) — enregistrée DANS
      // la même transaction que la vente : soit la vente ET sa dette sont
      // créées ensemble, soit ni l'une ni l'autre (ex: limite de crédit dépassée
      // -> tout est annulé, y compris le décrément de stock déjà effectué).
      if (balanceDue.greaterThan(0) && dto.customerId) {
        await this.credit.recordSaleDebt(tx, tenantId, dto.customerId, balanceDue, saleId);
      }

      // Génération du reçu DANS la même transaction (cf
      // docs/architecture/02-moteurs.md §16) — conditionné par la capability RECEIPTS
      // (activée par défaut, désactivable au profil du commerce).
      const receiptsEnabled = await this.businessProfile.isCapabilityEnabledWithTx(
        tx,
        tenantId,
        CAPABILITIES.RECEIPTS,
      );
      if (receiptsEnabled) {
        await this.documents.createReceiptForSale(tx, tenantId, {
          sale: {
            id: saleId,
            locationId: dto.locationId,
            customerId: dto.customerId ?? null,
            currency,
            subtotal,
            taxTotal: new Prisma.Decimal(0),
            discountTotal,
            grandTotal,
            amountPaid,
            balanceDue,
          },
          lines: lineInputs,
          payments: paymentInputs,
          tenderedAmount: tenderedAmountDecimal ? tenderedAmountDecimal.toString() : undefined,
          changeGiven: changeGiven.greaterThan(0) ? changeGiven.toString() : undefined,
        });
      }

      // Pattern Outbox transactionnel (cf docs/architecture/01-analyse-risques.md §4.2) :
      // l'événement est écrit DANS la même transaction que la vente, jamais publié
      // séparément — impossible d'avoir une vente enregistrée sans son événement.
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'sales.sale.completed',
          payload: {
            actorUserId: sellerUserId,
            entityType: 'Sale',
            entityId: saleId,
            locationId: dto.locationId,
            grandTotal: grandTotal.toString(),
            paymentStatus,
            currency,
            payments: paymentInputs.map((p) => ({
              method: p.method,
              amount: p.amount.toString(),
              reference: p.reference,
              verificationStatus: p.method === 'MOBILE_MONEY' ? 'DECLARED_MANUAL' : 'CONFIRMED_MANUAL',
            })),
          },
        },
      });

      return tx.sale.findFirst({
        where: { id: saleId },
        include: { lines: true, payments: true, documents: true },
      });
    });
  }

  /**
   * Annulation contrôlée d'un ticket de vente (Phase 2 - Audit QA)
   * Restaure le stock, contre-passe la dette éventuelle et le cash, et annule les documents.
   */
  async cancel(tenantId: string, actorUserId: string, saleId: string, cancelReason: string) {
    if (!cancelReason || cancelReason.trim().length === 0) {
      throw new BadRequestException("Un motif d'annulation est obligatoire");
    }
    return this.db.run(tenantId, async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, tenantId },
        include: { lines: true, payments: true },
      });
      if (!sale) throw new NotFoundException('Vente introuvable');
      if (sale.status === 'CANCELLED') {
        throw new BadRequestException('Cette vente est déjà annulée');
      }

      // Vérifier si des retours ont déjà été enregistrés sur cette vente
      const existingReturns = await tx.return.count({ where: { tenantId, saleId } });
      if (existingReturns > 0) {
        throw new BadRequestException("Impossible d'annuler une vente ayant déjà fait l'objet de retours");
      }

      // Restauration du stock pour chaque ligne
      for (const line of sale.lines) {
        const referenceQuantity = line.quantity.times(line.conversionFactorSnapshot);
        const stockRows = await tx.$queryRaw<{ id: string; quantityOnHand: Prisma.Decimal }[]>`
          SELECT id, "quantityOnHand" FROM "StockLevel"
          WHERE "tenantId" = ${tenantId}::uuid AND "locationId" = ${sale.locationId}::uuid AND "productId" = ${line.productId}::uuid
          FOR UPDATE
        `;
        if (stockRows.length > 0) {
          await tx.stockLevel.update({
            where: { id: stockRows[0].id },
            data: { quantityOnHand: stockRows[0].quantityOnHand.plus(referenceQuantity) },
          });
          await tx.stockMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              locationId: sale.locationId,
              productId: line.productId,
              movementType: 'adjustment',
              quantity: referenceQuantity,
              referenceType: 'sale_cancellation',
              referenceId: sale.id,
            },
          });
        }
      }

      // Si la vente a créé une dette client (balanceDue > 0), annuler la créance
      if (sale.balanceDue.greaterThan(0) && sale.customerId) {
        const acc = await tx.creditAccount.findUnique({
          where: { tenantId_customerId: { tenantId, customerId: sale.customerId } },
        });
        if (acc) {
          await tx.creditMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              accountId: acc.id,
              movementType: 'CREDIT',
              amount: sale.balanceDue,
              method: 'CANCELLATION',
              referenceType: 'sale_cancellation',
              referenceId: sale.id,
            },
          });
          await tx.creditAccount.update({
            where: { id: acc.id },
            data: { balance: { decrement: sale.balanceDue } },
          });
        }
      }

      // Sortie de caisse si paiement CASH et session ouverte
      const cashPayments = sale.payments.filter((p) => p.method === 'CASH');
      const totalCash = cashPayments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
      if (totalCash.greaterThan(0)) {
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
              amount: totalCash,
              reason: `Annulation vente #${sale.id.slice(0, 8)} : ${cancelReason.trim()}`,
              createdByUserId: actorUserId,
            },
          });
        }
      }

      // Marquer la vente CANCELLED
      const updated = await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'CANCELLED' },
      });

      // Annuler les documents associés
      await tx.document.updateMany({
        where: { tenantId, saleId: sale.id },
        data: { voidedAt: new Date(), voidReason: cancelReason.trim() },
      });

      // Événement d'audit Outbox
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'sales.sale.cancelled',
          payload: {
            actorUserId,
            saleId: sale.id,
            reason: cancelReason.trim(),
            locationId: sale.locationId,
            grandTotal: sale.grandTotal.toString(),
          },
        },
      });

      return updated;
    });
  }
}

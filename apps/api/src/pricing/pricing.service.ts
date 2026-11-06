import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CAPABILITIES, newId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';

export interface ResolvedPrice {
  unitPrice: Prisma.Decimal;
  appliedRule: 'CUSTOMER_OVERRIDE' | 'QUANTITY_TIER' | 'BASE_PRICE';
}

/**
 * Pricing Engine simplifié (cf docs/architecture/02-moteurs.md §8). Résolution :
 * prix négocié client > meilleur palier de quantité atteint > prix de base.
 * Listes de prix par groupe client, promotions temporelles, prix par
 * emplacement/période = PLANNED.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly businessProfile: BusinessProfileService,
  ) {}

  /**
   * DOIT être appelé à l'intérieur de la transaction de la vente (comme
   * DocumentsService/CreditService) pour que la résolution voie un état
   * cohérent avec le reste de l'opération.
   */
  async resolveUnitPrice(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    customerId: string | null | undefined,
    quantity: Prisma.Decimal,
    basePrice: Prisma.Decimal,
  ): Promise<ResolvedPrice> {
    // Si le commerce n'utilise pas la tarification personnalisée, on ignore
    // délibérément tout override/palier déjà en base (défense en profondeur :
    // désactiver la capability doit revenir à l'état "prix de base uniquement"
    // immédiatement, pas seulement bloquer la création de nouvelles règles).
    const customPricingEnabled = await this.businessProfile.isCapabilityEnabledWithTx(
      tx,
      tenantId,
      CAPABILITIES.CUSTOM_PRICING,
    );
    if (!customPricingEnabled) {
      return { unitPrice: basePrice, appliedRule: 'BASE_PRICE' };
    }

    if (customerId) {
      const override = await tx.customerPriceOverride.findFirst({
        where: { tenantId, customerId, productId },
      });
      if (override) {
        return { unitPrice: override.price, appliedRule: 'CUSTOMER_OVERRIDE' };
      }
    }

    const tiers = await tx.quantityPriceTier.findMany({
      where: { tenantId, productId },
      orderBy: { minQuantity: 'desc' },
    });
    const matchingTier = tiers.find((t) => quantity.greaterThanOrEqualTo(t.minQuantity));
    if (matchingTier) {
      return { unitPrice: matchingTier.price, appliedRule: 'QUANTITY_TIER' };
    }

    return { unitPrice: basePrice, appliedRule: 'BASE_PRICE' };
  }

  async listCustomerOverrides(tenantId: string, customerId?: string) {
    return this.db.run(tenantId, (tx) =>
      tx.customerPriceOverride.findMany({ where: { tenantId, customerId } }),
    );
  }

  async upsertCustomerOverride(tenantId: string, customerId: string, productId: string, price: string) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.customerPriceOverride.findFirst({
        where: { tenantId, customerId, productId },
      });
      if (existing) {
        return tx.customerPriceOverride.update({ where: { id: existing.id }, data: { price } });
      }
      return tx.customerPriceOverride.create({
        data: { id: newId(), tenantId, customerId, productId, price },
      });
    });
  }

  async deleteCustomerOverride(tenantId: string, id: string) {
    return this.db.run(tenantId, (tx) => tx.customerPriceOverride.deleteMany({ where: { id, tenantId } }));
  }

  async listQuantityTiers(tenantId: string, productId?: string) {
    return this.db.run(tenantId, (tx) =>
      tx.quantityPriceTier.findMany({
        where: { tenantId, productId },
        orderBy: { minQuantity: 'asc' },
      }),
    );
  }

  async createQuantityTier(tenantId: string, productId: string, minQuantity: string, price: string) {
    return this.db.run(tenantId, (tx) =>
      tx.quantityPriceTier.create({
        data: { id: newId(), tenantId, productId, minQuantity, price },
      }),
    );
  }

  async deleteQuantityTier(tenantId: string, id: string) {
    return this.db.run(tenantId, (tx) => tx.quantityPriceTier.deleteMany({ where: { id, tenantId } }));
  }
}

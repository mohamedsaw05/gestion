import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

export interface ResolvedUnit {
  unit: string;
  factor: Prisma.Decimal;
  isReferenceUnit: boolean;
}

/**
 * Unit / Conversion Engine (cf docs/architecture/02-moteurs.md §7 bis).
 * `Product.unit` est l'unité de RÉFÉRENCE (= unité de stock), jamais convertie.
 * `ProductUnit` déclare les unités alternatives (achat/vente) avec un facteur
 * vers cette référence — ex: "carton" avec facteur 12 si la référence est "piece".
 */
@Injectable()
export class UnitsService {
  constructor(private readonly db: PrismaTenantService) {}

  /**
   * Résout le facteur de conversion d'une unité vers l'unité de référence du
   * produit. DOIT être appelé à l'intérieur de la transaction de la vente
   * (comme PricingService/CreditService) pour voir un état cohérent.
   */
  async resolveUnit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    referenceUnit: string,
    requestedUnit: string | undefined,
  ): Promise<ResolvedUnit> {
    if (!requestedUnit || requestedUnit === referenceUnit) {
      return { unit: referenceUnit, factor: new Prisma.Decimal(1), isReferenceUnit: true };
    }
    const row = await tx.productUnit.findFirst({
      where: { tenantId, productId, unit: requestedUnit },
    });
    if (!row) {
      throw new BadRequestException(
        `Unité "${requestedUnit}" non déclarée pour ce produit (unité de référence : ${referenceUnit})`,
      );
    }
    return { unit: row.unit, factor: row.factor, isReferenceUnit: false };
  }

  async listForProduct(tenantId: string, productId: string) {
    return this.db.run(tenantId, (tx) =>
      tx.productUnit.findMany({ where: { tenantId, productId }, orderBy: { unit: 'asc' } }),
    );
  }

  async create(tenantId: string, productId: string, unit: string, factor: string) {
    const factorDecimal = new Prisma.Decimal(factor);
    if (factorDecimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Le facteur de conversion doit être strictement positif');
    }
    return this.db.run(tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } });
      if (!product) throw new NotFoundException('Produit introuvable');
      if (unit === product.unit) {
        throw new BadRequestException("Cette unité est déjà l'unité de référence du produit");
      }
      const existing = await tx.productUnit.findFirst({ where: { tenantId, productId, unit } });
      if (existing) {
        return tx.productUnit.update({ where: { id: existing.id }, data: { factor: factorDecimal } });
      }
      return tx.productUnit.create({
        data: { id: newId(), tenantId, productId, unit, factor: factorDecimal },
      });
    });
  }

  async delete(tenantId: string, id: string) {
    return this.db.run(tenantId, (tx) => tx.productUnit.deleteMany({ where: { id, tenantId } }));
  }
}

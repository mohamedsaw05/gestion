import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CAPABILITIES, newId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import type { AddVariantDto } from './dto/add-variant.dto.js';
import type { RegisterSerialNumbersDto } from './dto/register-serial-numbers.dto.js';
import type { SetWarrantyPolicyDto } from './dto/set-warranty-policy.dto.js';
import type { RegisterBatchDto } from './dto/register-batch.dto.js';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
    }
  }
  return d[m][n];
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly businessProfile: BusinessProfileService,
    private readonly inventory: InventoryService,
  ) {}

  async list(tenantId: string, locationId?: string, search?: string, limit?: number) {
    return this.db.run(tenantId, async (tx) => {
      const [products, barcodes, aliases, stockLevels, locations] = await Promise.all([
        tx.product.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { name: 'asc' },
        }),
        tx.productBarcode.findMany({
          where: { tenantId },
          select: { productId: true, code: true },
        }),
        tx.productAlias.findMany({
          where: { tenantId },
          select: { id: true, productId: true, alias: true },
        }),
        tx.stockLevel.findMany({
          where: { tenantId },
          select: { locationId: true, productId: true, quantityOnHand: true, quantityReserved: true },
        }),
        tx.location.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true },
        }),
      ]);

      const barcodesByProduct = new Map<string, string[]>();
      for (const b of barcodes) {
        const list = barcodesByProduct.get(b.productId) ?? [];
        list.push(b.code);
        barcodesByProduct.set(b.productId, list);
      }

      const aliasesByProduct = new Map<string, { id: string; alias: string }[]>();
      for (const a of aliases) {
        const list = aliasesByProduct.get(a.productId) ?? [];
        list.push({ id: a.id, alias: a.alias });
        aliasesByProduct.set(a.productId, list);
      }

      const locationMap = new Map(locations.map((l) => [l.id, l.name]));

      // Indexer les stocks par productId -> Map<locationId, { onHand, reserved }>
      const stockByProductAndLoc = new Map<string, Map<string, { onHand: number; reserved: number }>>();
      for (const sl of stockLevels) {
        let locMap = stockByProductAndLoc.get(sl.productId);
        if (!locMap) {
          locMap = new Map();
          stockByProductAndLoc.set(sl.productId, locMap);
        }
        locMap.set(sl.locationId, {
          onHand: Number(sl.quantityOnHand),
          reserved: Number(sl.quantityReserved),
        });
      }

      const normalizedSearch = search ? normalizeText(search) : null;
      const searchTokens = normalizedSearch ? normalizedSearch.split(/\s+/).filter(Boolean) : [];

      const scoredProducts = products.map((p) => {
        const pBarcodes = barcodesByProduct.get(p.id) ?? [];
        const pAliases = aliasesByProduct.get(p.id) ?? [];
        const locMap = stockByProductAndLoc.get(p.id);

        let stockOnHand = 0;
        let stockReserved = 0;
        let stockAvailable = 0;
        const otherLocationsStock: { locationId: string; locationName: string; available: number }[] = [];

        if (p.isStocked && p.type !== 'SERVICE') {
          if (locationId) {
            const currentStock = locMap?.get(locationId);
            stockOnHand = currentStock?.onHand ?? 0;
            stockReserved = currentStock?.reserved ?? 0;
            stockAvailable = Math.max(0, stockOnHand - stockReserved);

            // Chercher la disponibilité dans les autres emplacements si stock faible ou nul
            if (locMap) {
              for (const [locId, data] of locMap.entries()) {
                if (locId !== locationId) {
                  const avail = Math.max(0, data.onHand - data.reserved);
                  if (avail > 0) {
                    otherLocationsStock.push({
                      locationId: locId,
                      locationName: locationMap.get(locId) ?? locId,
                      available: avail,
                    });
                  }
                }
              }
            }
          } else {
            // Pas de locationId spécifique : agréger le stock global
            if (locMap) {
              for (const data of locMap.values()) {
                stockOnHand += data.onHand;
                stockReserved += data.reserved;
              }
              stockAvailable = Math.max(0, stockOnHand - stockReserved);
            }
          }
        }

        let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SERVICE' = 'SERVICE';
        if (p.isStocked && p.type !== 'SERVICE') {
          if (stockAvailable <= 0) {
            stockStatus = 'OUT_OF_STOCK';
          } else if (stockAvailable <= 5) {
            stockStatus = 'LOW_STOCK';
          } else {
            stockStatus = 'IN_STOCK';
          }
        }

        let score = 0;
        if (normalizedSearch) {
          const normName = normalizeText(p.name);
          const normSku = p.sku ? normalizeText(p.sku) : '';
          const normBrand = p.brand ? normalizeText(p.brand) : '';

          // 1. Code-barre exact (priorité absolue, typique scan douchette)
          if (pBarcodes.some((b) => normalizeText(b) === normalizedSearch)) {
            score = Math.max(score, 100);
          } else if (pBarcodes.some((b) => normalizeText(b).startsWith(normalizedSearch))) {
            score = Math.max(score, 85);
          }

          // 2. SKU exact
          if (normSku === normalizedSearch) {
            score = Math.max(score, 95);
          } else if (normSku.startsWith(normalizedSearch)) {
            score = Math.max(score, 80);
          } else if (normSku.includes(normalizedSearch)) {
            score = Math.max(score, 60);
          }

          // 3. Nom produit
          if (normName === normalizedSearch) {
            score = Math.max(score, 90);
          } else if (normName.startsWith(normalizedSearch)) {
            score = Math.max(score, 75);
          } else if (normName.includes(normalizedSearch)) {
            score = Math.max(score, 50);
          }

          // 4. Alias produit
          for (const a of pAliases) {
            const normAlias = normalizeText(a.alias);
            if (normAlias === normalizedSearch) {
              score = Math.max(score, 88);
            } else if (normAlias.startsWith(normalizedSearch)) {
              score = Math.max(score, 70);
            } else if (normAlias.includes(normalizedSearch)) {
              score = Math.max(score, 45);
            }
          }

          // 5. Marque
          if (normBrand && normBrand.includes(normalizedSearch)) {
            score = Math.max(score, 40);
          }

          // 6. Multi-tokens / sous-mots
          if (searchTokens.length > 1) {
            const allTokensMatch = searchTokens.every(
              (tok) =>
                normName.includes(tok) ||
                normSku.includes(tok) ||
                normBrand.includes(tok) ||
                pAliases.some((a) => normalizeText(a.alias).includes(tok)),
            );
            if (allTokensMatch) {
              score = Math.max(score, 65);
            }
          }

          // 8. Tolérance aux fautes de frappe (Levenshtein distance <= 2)
          if (score === 0 && normalizedSearch.length >= 4) {
            const words = normName.split(/\s+/);
            for (const w of words) {
              if (w.length >= 3 && Math.abs(w.length - normalizedSearch.length) <= 2) {
                const dist = levenshteinDistance(w, normalizedSearch);
                if (dist <= 1) {
                  score = Math.max(score, 40);
                  break;
                } else if (dist === 2) {
                  score = Math.max(score, 20);
                  break;
                }
              }
            }
          }
        }

        return {
          ...p,
          barcodes: pBarcodes,
          aliases: pAliases,
          stockOnHand,
          stockReserved,
          stockAvailable,
          stockStatus,
          otherLocationsStock,
          _score: score,
        };
      });

      let results = scoredProducts;
      if (normalizedSearch) {
        results = results.filter((p) => p._score > 0);
        results.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));
      }

      const safeLimit = limit && limit > 0 ? Math.min(limit, 100) : undefined;
      if (safeLimit) {
        results = results.slice(0, safeLimit);
      }

      return results.map(({ _score, ...rest }) => rest);
    });
  }

  async getById(tenantId: string, id: string) {
    const product = await this.db.run(tenantId, (tx) =>
      tx.product.findFirst({ where: { id, tenantId, deletedAt: null } }),
    );
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async create(tenantId: string, dto: CreateProductDto) {
    const type = dto.type ?? 'PHYSICAL';

    if (type === 'SERVICE') {
      const servicesEnabled = await this.businessProfile.isCapabilityEnabled(
        tenantId,
        CAPABILITIES.SERVICES,
      );
      if (!servicesEnabled) {
        throw new BadRequestException(
          'La vente de services n\'est pas activée pour ce commerce (cf Profil du commerce)',
        );
      }
    }

    // Un SERVICE ou un BUNDLE n'a jamais de stock propre : le stock d'un
    // bundle est entièrement dérivé de ses composants à la vente (cf
    // docs/architecture/02-moteurs.md §6 et SalesService). Un PHYSICAL n'est
    // stocké que si le commerce utilise réellement la gestion de stock.
    const inventoryEnabled = await this.businessProfile.isCapabilityEnabled(
      tenantId,
      CAPABILITIES.INVENTORY,
    );
    const isStocked = type === 'PHYSICAL' && inventoryEnabled ? (dto.isStocked ?? true) : false;

    let tracksSerialNumbers = false;
    if (dto.tracksSerialNumbers) {
      const serialNumbersEnabled = await this.businessProfile.isCapabilityEnabled(
        tenantId,
        CAPABILITIES.SERIAL_NUMBERS,
      );
      if (!serialNumbersEnabled) {
        throw new BadRequestException(
          "Le suivi par numéro de série n'est pas activé pour ce commerce (cf Profil du commerce)",
        );
      }
      if (!isStocked) {
        throw new BadRequestException('Le suivi par numéro de série exige un produit physique stocké');
      }
      tracksSerialNumbers = true;
    }

    let tracksBatches = false;
    if (dto.tracksBatches) {
      const batchTrackingEnabled = await this.businessProfile.isCapabilityEnabled(
        tenantId,
        CAPABILITIES.BATCH_TRACKING,
      );
      if (!batchTrackingEnabled) {
        throw new BadRequestException(
          "Le suivi par lot n'est pas activé pour ce commerce (cf Profil du commerce)",
        );
      }
      if (!isStocked) {
        throw new BadRequestException('Le suivi par lot exige un produit physique stocké');
      }
      if (tracksSerialNumbers) {
        throw new BadRequestException('Un produit ne peut pas suivre à la fois les numéros de série et les lots');
      }
      tracksBatches = true;
    }

    return this.db.run(tenantId, (tx) =>
      tx.product.create({
        data: {
          id: newId(),
          tenantId,
          sku: dto.sku,
          name: dto.name,
          brand: dto.brand,
          type,
          unit: dto.unit,
          basePrice: dto.basePrice,
          costPrice: dto.costPrice ? new Prisma.Decimal(dto.costPrice) : null,
          currency: dto.currency ?? 'XOF',
          categoryId: dto.categoryId,
          isStocked,
          tracksSerialNumbers,
          tracksBatches,
        },
      }),
    );
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.getById(tenantId, id);
    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.brand !== undefined) data.brand = dto.brand;
    if (dto.basePrice !== undefined) data.basePrice = new Prisma.Decimal(dto.basePrice);
    if (dto.costPrice !== undefined) data.costPrice = dto.costPrice ? new Prisma.Decimal(dto.costPrice) : null;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.isStocked !== undefined) data.isStocked = dto.isStocked;

    return this.db.run(tenantId, (tx) =>
      tx.product.update({ where: { id }, data }),
    );
  }

  async archive(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    return this.db.run(tenantId, (tx) =>
      tx.product.update({ where: { id }, data: { status: 'ARCHIVED' } }),
    );
  }

  // ── Codes-barres (plusieurs par produit, cf docs/architecture/02-moteurs.md §6) ──

  async listBarcodes(tenantId: string, productId: string) {
    return this.db.run(tenantId, (tx) =>
      tx.productBarcode.findMany({ where: { tenantId, productId }, orderBy: { code: 'asc' } }),
    );
  }

  async addBarcode(tenantId: string, productId: string, code: string) {
    return this.db.run(tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } });
      if (!product) throw new NotFoundException('Produit introuvable');
      const existing = await tx.productBarcode.findFirst({ where: { tenantId, code } });
      if (existing) {
        throw new ConflictException(
          existing.productId === productId
            ? 'Ce code-barres est déjà associé à ce produit'
            : 'Ce code-barres est déjà utilisé par un autre produit',
        );
      }
      return tx.productBarcode.create({ data: { id: newId(), tenantId, productId, code } });
    });
  }

  async deleteBarcode(tenantId: string, id: string) {
    return this.db.run(tenantId, (tx) => tx.productBarcode.deleteMany({ where: { id, tenantId } }));
  }

  async findByBarcode(tenantId: string, code: string) {
    const product = await this.db.run(tenantId, async (tx) => {
      const barcode = await tx.productBarcode.findFirst({ where: { tenantId, code } });
      if (!barcode) return null;
      return tx.product.findFirst({ where: { id: barcode.productId, tenantId, deletedAt: null } });
    });
    if (!product) throw new NotFoundException('Aucun produit pour ce code-barres');
    return product;
  }

  // ── Bundles (composition, cf docs/architecture/02-moteurs.md §6) ──

  async listBundleComponents(tenantId: string, bundleProductId: string) {
    return this.db.run(tenantId, async (tx) => {
      const components = await tx.bundleComponent.findMany({ where: { tenantId, bundleProductId } });
      const componentIds = components.map((c) => c.componentProductId);
      const products = await tx.product.findMany({ where: { tenantId, id: { in: componentIds } } });
      const byId = new Map(products.map((p) => [p.id, p]));
      return components.map((c) => ({ ...c, product: byId.get(c.componentProductId) ?? null }));
    });
  }

  async addBundleComponent(
    tenantId: string,
    bundleProductId: string,
    componentProductId: string,
    quantity: string,
  ) {
    const qty = new Prisma.Decimal(quantity);
    if (qty.lessThanOrEqualTo(0)) {
      throw new BadRequestException('La quantité doit être strictement positive');
    }
    if (bundleProductId === componentProductId) {
      throw new BadRequestException("Un bundle ne peut pas se contenir lui-même");
    }

    return this.db.run(tenantId, async (tx) => {
      const bundle = await tx.product.findFirst({
        where: { id: bundleProductId, tenantId, deletedAt: null },
      });
      if (!bundle) throw new NotFoundException('Bundle introuvable');
      if (bundle.type !== 'BUNDLE') {
        throw new BadRequestException('Ce produit n\'est pas de type BUNDLE');
      }
      const component = await tx.product.findFirst({
        where: { id: componentProductId, tenantId, deletedAt: null },
      });
      if (!component) throw new NotFoundException('Produit composant introuvable');
      if (component.type === 'BUNDLE') {
        throw new BadRequestException('Un bundle ne peut pas contenir un autre bundle (PLANNED)');
      }

      const existing = await tx.bundleComponent.findFirst({
        where: { tenantId, bundleProductId, componentProductId },
      });
      if (existing) {
        return tx.bundleComponent.update({ where: { id: existing.id }, data: { quantity: qty } });
      }
      return tx.bundleComponent.create({
        data: { id: newId(), tenantId, bundleProductId, componentProductId, quantity: qty },
      });
    });
  }

  async deleteBundleComponent(tenantId: string, id: string) {
    return this.db.run(tenantId, (tx) => tx.bundleComponent.deleteMany({ where: { id, tenantId } }));
  }

  // ── Variantes (Phase 12, capability "variants") — cf commentaire sur
  // Product.parentProductId dans le schéma : une variante EST un Product,
  // jamais un modèle séparé, pour traverser Stock/Sales/Purchase/Returns
  // sans la moindre modification de ces moteurs. ──

  async listVariants(tenantId: string, parentProductId: string) {
    await this.getById(tenantId, parentProductId);
    return this.db.run(tenantId, (tx) =>
      tx.product.findMany({ where: { tenantId, parentProductId, deletedAt: null }, orderBy: { name: 'asc' } }),
    );
  }

  async addVariant(tenantId: string, parentProductId: string, dto: AddVariantDto) {
    const variantsEnabled = await this.businessProfile.isCapabilityEnabled(tenantId, CAPABILITIES.VARIANTS);
    if (!variantsEnabled) {
      throw new BadRequestException(
        "Les variantes de produits ne sont pas activées pour ce commerce (cf Profil du commerce)",
      );
    }

    return this.db.run(tenantId, async (tx) => {
      const parent = await tx.product.findFirst({ where: { id: parentProductId, tenantId, deletedAt: null } });
      if (!parent) throw new NotFoundException('Produit parent introuvable');
      if (parent.parentProductId) {
        throw new BadRequestException('Une variante ne peut pas elle-même avoir de variantes');
      }
      if (parent.type !== 'PHYSICAL') {
        throw new BadRequestException('Seul un produit PHYSICAL peut avoir des variantes');
      }
      const existingSku = await tx.product.findFirst({ where: { tenantId, sku: dto.sku } });
      if (existingSku) {
        throw new ConflictException(`Le SKU "${dto.sku}" est déjà utilisé`);
      }

      const variant = await tx.product.create({
        data: {
          id: newId(),
          tenantId,
          categoryId: parent.categoryId,
          sku: dto.sku,
          name: dto.name ?? `${parent.name} (${Object.values(dto.attributes).join(' / ')})`,
          brand: parent.brand,
          type: 'PHYSICAL',
          unit: parent.unit,
          basePrice: dto.basePrice ?? parent.basePrice,
          currency: parent.currency,
          isStocked: parent.isStocked,
          parentProductId: parent.id,
          variantAttributes: dto.attributes,
        },
      });

      // Le parent devient un simple regroupement visuel une fois sa première
      // variante créée : il n'a plus de stock propre à suivre (chaque
      // variante a le sien), et SalesService refuse désormais de le vendre
      // directement (cf hasVariants).
      if (!parent.hasVariants) {
        await tx.product.update({ where: { id: parent.id }, data: { hasVariants: true, isStocked: false } });
      }

      return variant;
    });
  }

  // ── Numéros de série / IMEI (Phase 12, capability "serial_numbers") ──

  async listSerialNumbers(tenantId: string, productId: string, status?: string) {
    await this.getById(tenantId, productId);
    return this.db.run(tenantId, (tx) =>
      tx.serialNumber.findMany({
        where: { tenantId, productId, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async registerSerialNumbers(tenantId: string, productId: string, dto: RegisterSerialNumbersDto) {
    const serialNumbersEnabled = await this.businessProfile.isCapabilityEnabled(
      tenantId,
      CAPABILITIES.SERIAL_NUMBERS,
    );
    if (!serialNumbersEnabled) {
      throw new BadRequestException(
        "Le suivi par numéro de série n'est pas activé pour ce commerce (cf Profil du commerce)",
      );
    }

    return this.db.run(tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } });
      if (!product) throw new NotFoundException('Produit introuvable');
      if (!product.tracksSerialNumbers) {
        throw new BadRequestException('Ce produit ne suit pas les numéros de série');
      }

      const uniqueSerials = [...new Set(dto.serials)];
      if (uniqueSerials.length !== dto.serials.length) {
        throw new BadRequestException('Numéros de série en double dans la requête');
      }
      const existing = await tx.serialNumber.findMany({
        where: { tenantId, productId, serial: { in: uniqueSerials } },
      });
      if (existing.length > 0) {
        throw new ConflictException(
          `Numéro(s) de série déjà enregistré(s) pour ce produit : ${existing.map((s) => s.serial).join(', ')}`,
        );
      }

      return Promise.all(
        uniqueSerials.map((serial) =>
          tx.serialNumber.create({
            data: { id: newId(), tenantId, productId, locationId: dto.locationId, serial, status: 'AVAILABLE' },
          }),
        ),
      );
    });
  }

  // ── Garanties (Phase 12, capability "warranties") — politique par produit ;
  // la garantie CONCRÈTE (Warranty) est créée à la vente, cf SalesService. ──

  async getWarrantyPolicy(tenantId: string, productId: string) {
    await this.getById(tenantId, productId);
    return this.db.run(tenantId, (tx) => tx.warrantyPolicy.findFirst({ where: { tenantId, productId } }));
  }

  async setWarrantyPolicy(tenantId: string, productId: string, dto: SetWarrantyPolicyDto) {
    const warrantiesEnabled = await this.businessProfile.isCapabilityEnabled(tenantId, CAPABILITIES.WARRANTIES);
    if (!warrantiesEnabled) {
      throw new BadRequestException("Les garanties ne sont pas activées pour ce commerce (cf Profil du commerce)");
    }

    return this.db.run(tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } });
      if (!product) throw new NotFoundException('Produit introuvable');

      const existing = await tx.warrantyPolicy.findFirst({ where: { tenantId, productId } });
      if (existing) {
        return tx.warrantyPolicy.update({
          where: { id: existing.id },
          data: { durationDays: dto.durationDays, terms: dto.terms },
        });
      }
      return tx.warrantyPolicy.create({
        data: { id: newId(), tenantId, productId, durationDays: dto.durationDays, terms: dto.terms },
      });
    });
  }

  async deleteWarrantyPolicy(tenantId: string, productId: string) {
    return this.db.run(tenantId, (tx) => tx.warrantyPolicy.deleteMany({ where: { tenantId, productId } }));
  }

  // ── Lots / péremption (Phase 13, capability "batch_tracking") — délègue
  // entièrement à InventoryService (StockBatch décompose StockLevel, c'est
  // fondamentalement une donnée de stock, pas de catalogue ; ces routes
  // restent sous /products/:id pour la cohérence avec barcodes/variants/
  // serial-numbers/warranty-policy, mêmes onglets dans la page Catalogue). ──

  async listBatches(tenantId: string, productId: string) {
    return this.inventory.listBatches(tenantId, productId);
  }

  async registerBatch(tenantId: string, actorUserId: string, productId: string, dto: RegisterBatchDto) {
    return this.inventory.registerBatch(
      tenantId,
      actorUserId,
      productId,
      dto.locationId,
      dto.lotNumber,
      dto.quantity,
      dto.expiresAt,
    );
  }

  /**
   * Importation de produits depuis un fichier CSV avec pré-validation (dryRun)
   */
  async importCsv(tenantId: string, csvContent: string, dryRun = false) {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new BadRequestException('Le fichier CSV doit contenir un en-tête et au moins une ligne de données');
    }

    const header = lines[0].toLowerCase().split(/[,;\t]/).map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const nameIdx = header.findIndex((h) => h.includes('nom') || h === 'name');
    const skuIdx = header.findIndex((h) => h.includes('sku') || h.includes('ref') || h === 'reference');
    const priceIdx = header.findIndex((h) => h.includes('prix') || h.includes('price'));
    const typeIdx = header.findIndex((h) => h.includes('type'));
    const unitIdx = header.findIndex((h) => h.includes('unit') || h.includes('unite'));
    const barcodeIdx = header.findIndex((h) => h.includes('code_barre') || h.includes('barcode') || h.includes('ean'));

    if (nameIdx === -1 || priceIdx === -1) {
      throw new BadRequestException('Colonnes "nom" (ou name) et "prix" (ou price) obligatoires dans l\'en-tête du fichier (CSV ou TXT)');
    }

    const errors: { row: number; reason: string; raw: string }[] = [];
    const validRows: {
      name: string;
      sku: string;
      price: Prisma.Decimal;
      type: string;
      unit: string;
      barcode?: string;
    }[] = [];

    const seenSkusInFile = new Set<string>();

    return this.db.run(tenantId, async (tx) => {
      const existingProducts = await tx.product.findMany({
        where: { tenantId, deletedAt: null },
        select: { sku: true },
      });
      const existingSkuSet = new Set(existingProducts.map((p) => p.sku.toLowerCase()));

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
        const name = cols[nameIdx]?.trim();
        const priceRaw = cols[priceIdx]?.trim().replace(',', '.');
        let sku = skuIdx !== -1 && cols[skuIdx]?.trim() ? cols[skuIdx].trim() : '';
        const rawType = typeIdx !== -1 && cols[typeIdx]?.trim() ? cols[typeIdx].trim().toUpperCase() : 'PHYSICAL';
        const type = ['PHYSICAL', 'SERVICE', 'BUNDLE'].includes(rawType) ? rawType : 'PHYSICAL';
        const unit = unitIdx !== -1 && cols[unitIdx]?.trim() ? cols[unitIdx].trim() : 'U';
        const barcode = barcodeIdx !== -1 && cols[barcodeIdx]?.trim() ? cols[barcodeIdx].trim() : undefined;

        if (!name) {
          errors.push({ row: i + 1, reason: 'Nom manquant ou vide', raw: line });
          continue;
        }

        if (!priceRaw || isNaN(Number(priceRaw)) || Number(priceRaw) < 0) {
          errors.push({ row: i + 1, reason: `Prix invalide: "${cols[priceIdx]}"`, raw: line });
          continue;
        }
        const price = new Prisma.Decimal(priceRaw);

        if (!sku) {
          sku = `PRD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
        }

        const skuLower = sku.toLowerCase();
        if (seenSkusInFile.has(skuLower)) {
          errors.push({ row: i + 1, reason: `SKU dupliqué dans le fichier: "${sku}"`, raw: line });
          continue;
        }
        if (existingSkuSet.has(skuLower)) {
          errors.push({ row: i + 1, reason: `SKU déjà existant dans le catalogue: "${sku}"`, raw: line });
          continue;
        }

        seenSkusInFile.add(skuLower);
        validRows.push({ name, sku, price, type, unit, barcode });
      }

      if (dryRun) {
        return {
          dryRun: true,
          totalRows: lines.length - 1,
          validCount: validRows.length,
          errorCount: errors.length,
          errors,
          preview: validRows.slice(0, 5).map((r) => ({
            name: r.name,
            sku: r.sku,
            price: r.price.toString(),
            type: r.type,
            unit: r.unit,
            barcode: r.barcode,
          })),
        };
      }

      let createdCount = 0;
      for (const row of validRows) {
        const prod = await tx.product.create({
          data: {
            id: newId(),
            tenantId,
            name: row.name,
            sku: row.sku,
            basePrice: row.price,
            type: row.type,
            unit: row.unit,
            isStocked: row.type === 'PHYSICAL',
          },
        });
        if (row.barcode) {
          await tx.productBarcode.create({
            data: {
              id: newId(),
              tenantId,
              productId: prod.id,
              code: row.barcode,
            },
          });
        }
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

  // ── Alias de recherche ──

  async listAliases(tenantId: string, productId: string) {
    return this.db.run(tenantId, (tx) =>
      tx.productAlias.findMany({
        where: { tenantId, productId },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async addAlias(tenantId: string, productId: string, alias: string) {
    const trimmed = alias.trim();
    if (!trimmed) throw new BadRequestException("L'alias ne peut pas être vide");
    return this.db.run(tenantId, async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, tenantId, deletedAt: null },
      });
      if (!product) throw new NotFoundException('Produit introuvable');

      const existing = await tx.productAlias.findFirst({
        where: { tenantId, productId, alias: trimmed },
      });
      if (existing) throw new ConflictException('Cet alias existe déjà pour ce produit');

      return tx.productAlias.create({
        data: {
          id: newId(),
          tenantId,
          productId,
          alias: trimmed,
        },
      });
    });
  }

  async deleteAlias(tenantId: string, productId: string, aliasId: string) {
    return this.db.run(tenantId, async (tx) => {
      const alias = await tx.productAlias.findFirst({
        where: { id: aliasId, productId, tenantId },
      });
      if (!alias) throw new NotFoundException('Alias introuvable');
      await tx.productAlias.delete({ where: { id: aliasId } });
      return { success: true };
    });
  }

  // ── Rentabilité et historique achats / ventes par produit (Partie 23) ──

  async listProductPurchases(tenantId: string, productId: string, page = 1, limit = 20) {
    await this.getById(tenantId, productId);
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const skip = (safePage - 1) * safeLimit;

    return this.db.run(tenantId, async (tx) => {
      const [total, lines] = await Promise.all([
        tx.purchaseOrderLine.count({ where: { tenantId, productId } }),
        tx.purchaseOrderLine.findMany({
          where: { tenantId, productId },
          include: { purchaseOrder: true },
          orderBy: { purchaseOrder: { createdAt: 'desc' } },
          skip,
          take: safeLimit,
        }),
      ]);

      const supplierIds = [...new Set(lines.map((l) => l.purchaseOrder.supplierId))];
      const suppliers = await tx.supplier.findMany({
        where: { tenantId, id: { in: supplierIds } },
        select: { id: true, name: true, phone: true },
      });
      const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

      const data = lines.map((l) => {
        const supp = supplierMap.get(l.purchaseOrder.supplierId);
        const qtyOrdered = Number(l.quantityOrdered);
        const qtyReceived = Number(l.quantityReceived);
        const unitCost = Number(l.unitCostSnapshot);
        const lineTotal = Number(l.lineTotal);
        return {
          id: l.id,
          purchaseOrderId: l.purchaseOrderId,
          status: l.purchaseOrder.status,
          currency: l.purchaseOrder.currency,
          createdAt: l.purchaseOrder.createdAt,
          confirmedAt: l.purchaseOrder.confirmedAt,
          supplierId: l.purchaseOrder.supplierId,
          supplierName: supp?.name ?? 'Fournisseur inconnu',
          supplierPhone: supp?.phone ?? null,
          quantityOrdered: qtyOrdered,
          quantityReceived: qtyReceived,
          remainingQuantity: Math.max(0, qtyOrdered - qtyReceived),
          unitCost,
          lineTotal,
        };
      });

      return {
        data,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    });
  }

  async listProductSales(tenantId: string, productId: string, page = 1, limit = 20) {
    const product = await this.getById(tenantId, productId);
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const skip = (safePage - 1) * safeLimit;

    return this.db.run(tenantId, async (tx) => {
      const [total, lines] = await Promise.all([
        tx.saleLine.count({ where: { tenantId, productId } }),
        tx.saleLine.findMany({
          where: { tenantId, productId },
          include: { sale: true },
          orderBy: { sale: { createdAt: 'desc' } },
          skip,
          take: safeLimit,
        }),
      ]);

      const customerIds = lines.map((l) => l.sale.customerId).filter(Boolean) as string[];
      const customers =
        customerIds.length > 0
          ? await tx.customer.findMany({
              where: { tenantId, id: { in: customerIds } },
              select: { id: true, name: true, phone: true },
            })
          : [];
      const customerMap = new Map(customers.map((c) => [c.id, c]));

      const data = lines.map((l) => {
        const cust = l.sale.customerId ? customerMap.get(l.sale.customerId) : null;
        const qty = Number(l.quantity);
        const unitPrice = Number(l.unitPriceSnapshot);
        const lineTotal = Number(l.lineTotal);
        const costPrice = l.costPriceSnapshot
          ? Number(l.costPriceSnapshot)
          : product.costPrice
          ? Number(product.costPrice)
          : null;
        const lineCost = costPrice !== null ? costPrice * qty : null;
        const grossMargin = lineCost !== null ? lineTotal - lineCost : null;
        const marginRate =
          grossMargin !== null && lineCost && lineCost > 0 ? (grossMargin / lineCost) * 100 : null;
        const markupRate =
          grossMargin !== null && lineTotal > 0 ? (grossMargin / lineTotal) * 100 : null;

        return {
          id: l.id,
          saleId: l.saleId,
          createdAt: l.sale.createdAt,
          saleStatus: l.sale.status,
          paymentStatus: l.sale.paymentStatus,
          currency: l.sale.currency,
          customerId: l.sale.customerId,
          customerName: cust ? cust.name : l.sale.customerId ? 'Client inconnu' : 'Client au comptant',
          customerPhone: cust?.phone ?? null,
          quantity: qty,
          unitSnapshot: l.unitSnapshot,
          unitPriceSnapshot: unitPrice,
          lineTotal,
          costPriceSnapshot: costPrice,
          lineCost,
          grossMargin,
          marginRate,
          markupRate,
        };
      });

      return {
        data,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    });
  }

  async getProductProfitability(tenantId: string, productId: string) {
    const product = await this.getById(tenantId, productId);

    return this.db.run(tenantId, async (tx) => {
      const [purchaseLines, saleLines, stockLevels] = await Promise.all([
        tx.purchaseOrderLine.findMany({
          where: { tenantId, productId },
          include: { purchaseOrder: true },
        }),
        tx.saleLine.findMany({
          where: { tenantId, productId, sale: { status: 'COMPLETED' } },
          include: { sale: true },
        }),
        tx.stockLevel.findMany({
          where: { tenantId, productId },
        }),
      ]);

      // Analyse des achats
      const receivedLines = purchaseLines.filter((l) => l.quantityReceived.greaterThan(0));
      const sortedPurchases = [...purchaseLines].sort(
        (a, b) => b.purchaseOrder.createdAt.getTime() - a.purchaseOrder.createdAt.getTime(),
      );
      const latestPurchase = sortedPurchases[0];
      const latestPurchaseCost = latestPurchase
        ? Number(latestPurchase.unitCostSnapshot)
        : product.costPrice
        ? Number(product.costPrice)
        : null;

      let totalReceivedQty = new Prisma.Decimal(0);
      let totalReceivedValue = new Prisma.Decimal(0);
      for (const l of receivedLines) {
        totalReceivedQty = totalReceivedQty.plus(l.quantityReceived);
        totalReceivedValue = totalReceivedValue.plus(l.quantityReceived.times(l.unitCostSnapshot));
      }

      const averagePurchaseCost = totalReceivedQty.greaterThan(0)
        ? Number(totalReceivedValue.dividedBy(totalReceivedQty))
        : product.costPrice
        ? Number(product.costPrice)
        : null;

      // Analyse des ventes historiques
      let totalUnitsSold = new Prisma.Decimal(0);
      let totalRevenue = new Prisma.Decimal(0);
      let totalCostOfGoodsSold = new Prisma.Decimal(0);

      for (const l of saleLines) {
        totalUnitsSold = totalUnitsSold.plus(l.quantity);
        totalRevenue = totalRevenue.plus(l.lineTotal);

        const unitCost = l.costPriceSnapshot
          ? l.costPriceSnapshot
          : averagePurchaseCost
          ? new Prisma.Decimal(averagePurchaseCost)
          : product.costPrice
          ? new Prisma.Decimal(product.costPrice)
          : null;

        if (unitCost) {
          totalCostOfGoodsSold = totalCostOfGoodsSold.plus(l.quantity.times(unitCost));
        }
      }

      const numTotalRevenue = Number(totalRevenue);
      const numCogs = Number(totalCostOfGoodsSold);
      const historicalGrossMargin = numTotalRevenue - numCogs;
      const historicalMarginRate = numCogs > 0 ? (historicalGrossMargin / numCogs) * 100 : 0;
      const historicalMarkupRate = numTotalRevenue > 0 ? (historicalGrossMargin / numTotalRevenue) * 100 : 0;

      // Valorisation actuelle & marges prévisionnelles
      const basePrice = Number(product.basePrice);
      const refCost = averagePurchaseCost ?? (product.costPrice ? Number(product.costPrice) : null);
      const estimatedCurrentMargin = refCost !== null ? basePrice - refCost : null;
      const estimatedCurrentMarginRate =
        estimatedCurrentMargin !== null && refCost && refCost > 0
          ? (estimatedCurrentMargin / refCost) * 100
          : null;
      const estimatedCurrentMarkupRate =
        estimatedCurrentMargin !== null && basePrice > 0 ? (estimatedCurrentMargin / basePrice) * 100 : null;

      const isSoldBelowCost = refCost !== null && basePrice < refCost;
      const isLowMargin = estimatedCurrentMarginRate !== null && estimatedCurrentMarginRate < 15;

      const stockOnHand = stockLevels.reduce((sum, sl) => sum + Number(sl.quantityOnHand), 0);
      const stockValuation = refCost !== null ? stockOnHand * refCost : null;

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        currency: product.currency,
        basePrice,
        costPrice: product.costPrice ? Number(product.costPrice) : null,
        latestPurchaseCost,
        averagePurchaseCost,
        stockOnHand,
        stockValuation,
        totalUnitsSold: Number(totalUnitsSold),
        totalRevenue: numTotalRevenue,
        totalCostOfGoodsSold: numCogs,
        historicalGrossMargin,
        historicalMarginRate: Math.round(historicalMarginRate * 100) / 100,
        historicalMarkupRate: Math.round(historicalMarkupRate * 100) / 100,
        estimatedCurrentMargin,
        estimatedCurrentMarginRate:
          estimatedCurrentMarginRate !== null ? Math.round(estimatedCurrentMarginRate * 100) / 100 : null,
        estimatedCurrentMarkupRate:
          estimatedCurrentMarkupRate !== null ? Math.round(estimatedCurrentMarkupRate * 100) / 100 : null,
        isSoldBelowCost,
        isLowMargin,
        completedSalesCount: saleLines.length,
        totalPurchasesCount: purchaseLines.length,
      };
    });
  }
}



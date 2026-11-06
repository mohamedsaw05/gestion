import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@gestionnaire/db';
import {
  SETTINGS_CATALOG,
  getSettingDefault,
  getSettingDefinition,
  isValidSettingKey,
  type SettingKey,
} from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

/**
 * Configuration Engine (cf docs/architecture/02-moteurs.md §7). Chaque
 * paramètre du catalogue (packages/db/src/settings.catalog.ts) est un
 * comportement réellement branché dans un moteur métier — jamais un simple
 * champ décoratif. Résolution : valeur tenant explicite > valeur par défaut
 * du catalogue (jamais d'erreur si le tenant n'a rien configuré).
 */
@Injectable()
export class ConfigurationService {
  constructor(private readonly db: PrismaTenantService) {}

  /** Vue résolue de tous les paramètres, pour l'écran de configuration. */
  async getAll(tenantId: string): Promise<Record<string, unknown>> {
    return this.db.run(tenantId, async (tx) => {
      const rows = await tx.tenantSetting.findMany({ where: { tenantId } });
      const byKey = new Map(rows.map((r) => [r.key, r.value]));
      const result: Record<string, unknown> = {};
      for (const def of SETTINGS_CATALOG) {
        result[def.key] = byKey.has(def.key) ? byKey.get(def.key) : def.default;
      }
      return result;
    });
  }

  /**
   * Lecture d'un paramètre unique, en dehors de toute transaction en cours —
   * pour les endpoints de lecture simple.
   */
  async get<T = unknown>(tenantId: string, key: SettingKey): Promise<T> {
    return this.db.run(tenantId, (tx) => this.getWithTx(tx, tenantId, key)) as Promise<T>;
  }

  /**
   * DOIT être utilisé par tout moteur métier qui lit un paramètre à
   * l'intérieur d'une transaction déjà ouverte (Sales, Inventory, Documents)
   * — jamais ouvrir une seconde transaction depuis l'intérieur d'une première.
   */
  async getWithTx<T = unknown>(
    tx: Prisma.TransactionClient,
    tenantId: string,
    key: SettingKey,
  ): Promise<T> {
    const row = await tx.tenantSetting.findFirst({ where: { tenantId, key } });
    return (row ? row.value : getSettingDefault(key)) as T;
  }

  async set(tenantId: string, key: string, value: unknown) {
    if (!isValidSettingKey(key)) {
      throw new BadRequestException(`Clé de configuration inconnue : ${key}`);
    }
    const def = getSettingDefinition(key);
    this.validateValue(def, value);

    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.tenantSetting.findFirst({ where: { tenantId, key } });
      const jsonValue = value as Prisma.InputJsonValue;
      let record;
      if (existing) {
        record = await tx.tenantSetting.update({ where: { id: existing.id }, data: { value: jsonValue } });
      } else {
        record = await tx.tenantSetting.create({ data: { id: newId(), tenantId, key, value: jsonValue } });
      }

      // Synchronisation bidirectionnelle stricte : si le nom légal change, mettre à jour le nom du Tenant
      if (key === 'organization.legalName' && typeof value === 'string' && value.trim()) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { name: value.trim() },
        });
      }

      return record;
    });
  }

  getCatalog() {
    return SETTINGS_CATALOG;
  }

  // ── Résolution hiérarchique (Phase 8.1) ──────────────────────────────────
  // TENANT → LOCATION uniquement : PLATFORM/PLAN n'ont pas encore de modèle
  // réel dans le projet (Platform Engine = uniquement la liste des tenants
  // actifs à l'écran de connexion, cf PROJECT_STATUS §4) — ajouter ces
  // niveaux maintenant fabriquerait une hiérarchie sans donnée derrière,
  // contraire à la règle "jamais un paramètre décoratif". À réintroduire
  // quand un vrai Plan/Subscription existera (Phase 25).

  /**
   * DOIT être utilisé DANS une transaction déjà ouverte (même règle que
   * getWithTx) — résout LocationSetting > TenantSetting > défaut catalogue.
   * Ignore silencieusement une éventuelle LocationSetting sur une clé qui
   * n'autorise plus la surcharge (ex: retirée du catalogue depuis) plutôt que
   * de faire échouer toute lecture — l'écriture, elle, est strictement
   * validée dans `setForLocation`.
   */
  async getEffectiveWithTx<T = unknown>(
    tx: Prisma.TransactionClient,
    tenantId: string,
    locationId: string,
    key: SettingKey,
  ): Promise<T> {
    const def = getSettingDefinition(key);
    if (def.allowLocationOverride) {
      const locationRow = await tx.locationSetting.findFirst({ where: { tenantId, locationId, key } });
      if (locationRow) return locationRow.value as T;
    }
    return this.getWithTx(tx, tenantId, key);
  }

  async getEffective<T = unknown>(tenantId: string, locationId: string, key: SettingKey): Promise<T> {
    return this.db.run(tenantId, (tx) => this.getEffectiveWithTx(tx, tenantId, locationId, key)) as Promise<T>;
  }

  /** Vue résolue combinée pour un emplacement — consommée par l'écran de configuration. */
  async getAllEffectiveForLocation(tenantId: string, locationId: string): Promise<Record<string, unknown>> {
    return this.db.run(tenantId, async (tx) => {
      const [tenantRows, locationRows] = await Promise.all([
        tx.tenantSetting.findMany({ where: { tenantId } }),
        tx.locationSetting.findMany({ where: { tenantId, locationId } }),
      ]);
      const tenantByKey = new Map(tenantRows.map((r) => [r.key, r.value]));
      const locationByKey = new Map(locationRows.map((r) => [r.key, r.value]));
      const result: Record<string, unknown> = {};
      for (const def of SETTINGS_CATALOG) {
        if (def.allowLocationOverride && locationByKey.has(def.key)) {
          result[def.key] = locationByKey.get(def.key);
        } else {
          result[def.key] = tenantByKey.has(def.key) ? tenantByKey.get(def.key) : def.default;
        }
      }
      return result;
    });
  }

  async setForLocation(tenantId: string, locationId: string, key: string, value: unknown) {
    if (!isValidSettingKey(key)) {
      throw new BadRequestException(`Clé de configuration inconnue : ${key}`);
    }
    const def = getSettingDefinition(key);
    if (!def.allowLocationOverride) {
      throw new BadRequestException(
        `"${key}" ne peut pas être personnalisé par emplacement (paramètre au niveau du commerce uniquement)`,
      );
    }
    this.validateValue(def, value);

    return this.db.run(tenantId, async (tx) => {
      const location = await tx.location.findFirst({ where: { id: locationId, tenantId, deletedAt: null } });
      if (!location) throw new BadRequestException('Emplacement introuvable');

      const existing = await tx.locationSetting.findFirst({ where: { tenantId, locationId, key } });
      const jsonValue = value as Prisma.InputJsonValue;
      if (existing) {
        return tx.locationSetting.update({ where: { id: existing.id }, data: { value: jsonValue } });
      }
      return tx.locationSetting.create({ data: { id: newId(), tenantId, locationId, key, value: jsonValue } });
    });
  }

  private validateValue(def: ReturnType<typeof getSettingDefinition>, value: unknown) {
    if (def.type === 'boolean' && typeof value !== 'boolean') {
      throw new BadRequestException(`"${def.key}" attend un booléen`);
    }
    if (def.type === 'string' && typeof value !== 'string') {
      throw new BadRequestException(`"${def.key}" attend une chaîne`);
    }
    if (def.type === 'string[]') {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        throw new BadRequestException(`"${def.key}" attend un tableau de chaînes`);
      }
      if (def.allowedValues) {
        const invalid = value.filter((v) => !def.allowedValues!.includes(v));
        if (invalid.length > 0) {
          throw new BadRequestException(
            `"${def.key}" contient des valeurs non autorisées : ${invalid.join(', ')}`,
          );
        }
      }
    }
  }
}

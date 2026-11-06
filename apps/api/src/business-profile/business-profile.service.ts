import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ALL_CAPABILITY_KEYS,
  CAPABILITIES_CATALOG,
  MODULES_CATALOG,
  MODULE_CATEGORY,
  isValidCapabilityKey,
  newId,
  newTransactionalId,
  type CapabilityKey,
} from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

export interface ResolvedModule {
  key: string;
  label: string;
  category: string;
  enabled: boolean;
}

/**
 * Business Profile / Capabilities / Modules — cf demande de continuation.
 * Fondation de la configuration intelligente : « pour CE commerce, quelles
 * fonctions sont disponibles ? » Chaque capability a des conséquences
 * réellement vérifiées par les moteurs consommateurs (Catalog, Inventory,
 * Sales, Credit, Pricing, Organization) — jamais un simple affichage.
 */
@Injectable()
export class BusinessProfileService {
  constructor(private readonly db: PrismaTenantService) {}

  async getProfile(tenantId: string) {
    return this.db.run(tenantId, (tx) => tx.businessProfile.findFirst({ where: { tenantId } }));
  }

  /** Résolution complète : valeur explicite du tenant > défaut du catalogue codé. */
  async getResolvedCapabilities(tenantId: string): Promise<Record<CapabilityKey, boolean>> {
    return this.db.run(tenantId, async (tx) => {
      const rows = await tx.tenantCapability.findMany({ where: { tenantId } });
      const byKey = new Map(rows.map((r) => [r.key, r.enabled]));
      const result = {} as Record<CapabilityKey, boolean>;
      for (const def of CAPABILITIES_CATALOG) {
        result[def.key] = byKey.has(def.key) ? byKey.get(def.key)! : def.defaultEnabled;
      }
      return result;
    });
  }

  /**
   * Variante utilisable À L'INTÉRIEUR d'une transaction déjà ouverte (comme
   * ConfigurationService.getWithTx) — pour les moteurs qui doivent vérifier
   * une capability au milieu d'une opération transactionnelle (Sales, Catalog).
   */
  async isCapabilityEnabledWithTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    key: CapabilityKey,
  ): Promise<boolean> {
    const row = await tx.tenantCapability.findFirst({ where: { tenantId, key } });
    if (row) return row.enabled;
    const def = CAPABILITIES_CATALOG.find((d) => d.key === key);
    return def?.defaultEnabled ?? false; // fail-closed si clé inconnue (ne devrait pas arriver)
  }

  async isCapabilityEnabled(tenantId: string, key: CapabilityKey): Promise<boolean> {
    return this.db.run(tenantId, (tx) => this.isCapabilityEnabledWithTx(tx, tenantId, key));
  }

  async setCapability(tenantId: string, actorUserId: string, key: string, enabled: boolean) {
    if (!isValidCapabilityKey(key)) {
      throw new BadRequestException(`Capability inconnue : ${key}`);
    }
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.tenantCapability.findFirst({ where: { tenantId, key } });
      const before = existing?.enabled ?? CAPABILITIES_CATALOG.find((c) => c.key === key)!.defaultEnabled;
      const result = existing
        ? await tx.tenantCapability.update({ where: { id: existing.id }, data: { enabled } })
        : await tx.tenantCapability.create({ data: { id: newId(), tenantId, key, enabled } });

      if (before !== enabled) {
        await tx.outboxEvent.create({
          data: {
            id: newTransactionalId(),
            tenantId,
            eventType: 'business_profile.capability.changed',
            // BUG RÉEL TROUVÉ EN PHASE 14 : entityId portait la clé texte
            // ("invoicing"...) plutôt qu'un UUID — AuditLog.entityId est
            // `@db.Uuid`, donc CHAQUE changement de capability échouait
            // silencieusement à s'écrire dans l'audit depuis la Phase 8
            // (l'outbox worker logue l'erreur mais ne fait jamais échouer la
            // requête HTTP d'origine, d'où l'absence de symptôme visible).
            // La clé reste disponible dans le payload (`capabilityKey`).
            payload: { actorUserId, entityType: 'TenantCapability', entityId: result.id, capabilityKey: key, before, after: enabled },
          },
        });
      }
      return result;
    });
  }

  /** Modules effectivement actifs pour ce tenant (catégorie + capability requise + choix du tenant). */
  async getResolvedModules(tenantId: string): Promise<ResolvedModule[]> {
    const capabilities = await this.getResolvedCapabilities(tenantId);
    const overrides = await this.db.run(tenantId, (tx) => tx.tenantModule.findMany({ where: { tenantId } }));
    const overrideByKey = new Map(overrides.map((o) => [o.key, o.enabled]));

    return MODULES_CATALOG.map((def) => {
      if (def.category === MODULE_CATEGORY.CORE || def.category === MODULE_CATEGORY.AUTOMATIC) {
        return { key: def.key, label: def.label, category: def.category, enabled: true };
      }
      if (def.category === MODULE_CATEGORY.HIDDEN) {
        return { key: def.key, label: def.label, category: def.category, enabled: false };
      }
      // OPTIONAL / ADVANCED : la capability requise est un PRÉREQUIS, jamais
      // contournable par le choix du tenant sur le module lui-même.
      const capabilityOk = !def.requiresCapability || capabilities[def.requiresCapability];
      const tenantChoice = overrideByKey.has(def.key) ? overrideByKey.get(def.key)! : true;
      return { key: def.key, label: def.label, category: def.category, enabled: capabilityOk && tenantChoice };
    });
  }

  async setModule(tenantId: string, actorUserId: string, key: string, enabled: boolean) {
    const def = MODULES_CATALOG.find((m) => m.key === key);
    if (!def) throw new BadRequestException(`Module inconnu : ${key}`);
    if (def.category === MODULE_CATEGORY.CORE || def.category === MODULE_CATEGORY.AUTOMATIC) {
      throw new BadRequestException(`Le module "${key}" est toujours actif (catégorie ${def.category})`);
    }

    // Résolu AVANT d'ouvrir la transaction d'écriture — getResolvedModules
    // fait son propre appel à getResolvedCapabilities/db.run, jamais imbriqué
    // dans une transaction déjà ouverte (même piège que RolesService/
    // CashRegisterService, déjà rencontré et documenté dans ce projet).
    const resolved = await this.getResolvedModules(tenantId);
    const resolvedByKey = new Map(resolved.map((m) => [m.key, m.enabled]));

    if (enabled) {
      const missingDependency = (def.dependencies ?? []).find((dep) => !resolvedByKey.get(dep));
      if (missingDependency) {
        const depDef = MODULES_CATALOG.find((m) => m.key === missingDependency);
        throw new BadRequestException(
          `Le module "${key}" nécessite que "${depDef?.label ?? missingDependency}" soit d'abord activé`,
        );
      }
    } else {
      const dependent = MODULES_CATALOG.find(
        (m) => m.key !== key && resolvedByKey.get(m.key) && (m.dependencies ?? []).includes(key),
      );
      if (dependent) {
        throw new BadRequestException(
          `Impossible de désactiver "${key}" : le module "${dependent.label}" en dépend encore (désactivez-le d'abord)`,
        );
      }
    }

    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.tenantModule.findFirst({ where: { tenantId, key } });
      const before = resolvedByKey.get(key) ?? true;
      const result = existing
        ? await tx.tenantModule.update({ where: { id: existing.id }, data: { enabled } })
        : await tx.tenantModule.create({ data: { id: newId(), tenantId, key, enabled } });

      if (before !== enabled) {
        await tx.outboxEvent.create({
          data: {
            id: newTransactionalId(),
            tenantId,
            eventType: 'business_profile.module.changed',
            // Même bug/correction que setCapability ci-dessus.
            payload: { actorUserId, entityType: 'TenantModule', entityId: result.id, moduleKey: key, before, after: enabled },
          },
        });
      }
      return result;
    });
  }

  getCapabilitiesCatalog() {
    return CAPABILITIES_CATALOG;
  }

  getModulesCatalog() {
    return MODULES_CATALOG;
  }

  /**
   * Assistant de configuration (cf demande §8) : crée/complète le profil et
   * définit en une fois les capabilities/modules choisis. Idempotent — peut
   * être rejoué pour ajuster la configuration après coup, pas seulement à la
   * création du tenant.
   */
  async completeOnboarding(
    tenantId: string,
    actorUserId: string,
    businessType: string,
    capabilities: Record<string, boolean>,
    modules: Record<string, boolean>,
  ) {
    for (const key of Object.keys(capabilities)) {
      if (!isValidCapabilityKey(key)) {
        throw new BadRequestException(`Capability inconnue : ${key}`);
      }
    }

    // Validation des dépendances de modules (Phase 8.2) SUR L'ÉTAT FINAL
    // simulé — cette route applique plusieurs changements en une fois
    // (contrairement à setModule), donc la vérification ne peut pas se faire
    // changement par changement : activer "orders" ET "delivery" dans le
    // même appel doit réussir même si aucun des deux n'est encore actif
    // avant l'appel. Résolu AVANT d'ouvrir la transaction d'écriture (même
    // règle que setModule : jamais de db.run imbriqué).
    // BUG RÉEL TROUVÉ EN PHASE 14 : le fallback utilisait auparavant l'état
    // RÉSOLU (capability ET choix déjà combinés) d'un module non touché dans
    // CET appel comme s'il s'agissait du choix brut du tenant. Si sa
    // capability requise passe de false à true DANS LE MÊME appel (ex:
    // activer "orders" ET "delivery" ensemble, "delivery" dépendant
    // d'"orders"), l'état résolu AVANT l'appel valait encore false (bloqué
    // par l'ancienne capability), et ce false se retrouvait réinjecté comme
    // "choix du tenant" — un module qui aurait dû se débloquer restait
    // bloqué, exactement le bug déjà corrigé côté `setModule`/
    // BusinessProfilePage en Phase 8, mais réapparu ici sous une forme
    // différente (le choix BRUT, pas la résolution, doit servir de secours).
    const [currentCapabilities, rawModuleOverrides] = await Promise.all([
      this.getResolvedCapabilities(tenantId),
      this.db.run(tenantId, (tx) => tx.tenantModule.findMany({ where: { tenantId } })),
    ]);
    const rawModuleChoice = new Map(rawModuleOverrides.map((m) => [m.key, m.enabled]));
    const finalCapabilities = { ...currentCapabilities, ...capabilities } as Record<string, boolean>;
    const finalModuleEnabled = new Map<string, boolean>();
    for (const def of MODULES_CATALOG) {
      if (def.category === MODULE_CATEGORY.CORE || def.category === MODULE_CATEGORY.AUTOMATIC) {
        finalModuleEnabled.set(def.key, true);
        continue;
      }
      if (def.category === MODULE_CATEGORY.HIDDEN) {
        finalModuleEnabled.set(def.key, false);
        continue;
      }
      const capabilityOk = !def.requiresCapability || finalCapabilities[def.requiresCapability];
      const tenantChoice = def.key in modules ? modules[def.key] : (rawModuleChoice.get(def.key) ?? true);
      finalModuleEnabled.set(def.key, capabilityOk && tenantChoice);
    }
    for (const def of MODULES_CATALOG) {
      if (!finalModuleEnabled.get(def.key)) continue;
      const missingDependency = (def.dependencies ?? []).find((dep) => !finalModuleEnabled.get(dep));
      if (missingDependency) {
        const depDef = MODULES_CATALOG.find((m) => m.key === missingDependency);
        throw new BadRequestException(
          `Le module "${def.label}" nécessite que "${depDef?.label ?? missingDependency}" soit aussi activé`,
        );
      }
    }

    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.businessProfile.findFirst({ where: { tenantId } });
      if (existing) {
        await tx.businessProfile.update({
          where: { id: existing.id },
          data: { businessType, onboardedAt: existing.onboardedAt ?? new Date() },
        });
      } else {
        await tx.businessProfile.create({
          data: { id: newId(), tenantId, businessType, onboardedAt: new Date() },
        });
      }

      for (const key of ALL_CAPABILITY_KEYS) {
        if (!(key in capabilities)) continue;
        const enabled = capabilities[key];
        const row = await tx.tenantCapability.findFirst({ where: { tenantId, key } });
        if (row) await tx.tenantCapability.update({ where: { id: row.id }, data: { enabled } });
        else await tx.tenantCapability.create({ data: { id: newId(), tenantId, key, enabled } });
      }

      for (const def of MODULES_CATALOG) {
        if (!(def.key in modules)) continue;
        if (def.category === MODULE_CATEGORY.CORE || def.category === MODULE_CATEGORY.AUTOMATIC) continue;
        const enabled = modules[def.key];
        const row = await tx.tenantModule.findFirst({ where: { tenantId, key: def.key } });
        if (row) await tx.tenantModule.update({ where: { id: row.id }, data: { enabled } });
        else await tx.tenantModule.create({ data: { id: newId(), tenantId, key: def.key, enabled } });
      }

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'business_profile.onboarding.completed',
          payload: { actorUserId, entityType: 'BusinessProfile', entityId: tenantId, businessType, capabilities, modules },
        },
      });

      return tx.businessProfile.findFirst({ where: { tenantId } });
    });
  }
}

import { CAPABILITIES, type CapabilityKey } from './capabilities.catalog';

/**
 * Registre des modules (domaines fonctionnels) — DISTINCT des capabilities
 * (cf docs, §6) : un module est une brique du moteur qui EXISTE dans le
 * système ; une capability est le choix du commerce d'UTILISER ce domaine.
 *
 * - CORE       : toujours actif, jamais désactivable par le tenant.
 * - AUTOMATIC  : toujours actif en interne, pas d'action utilisateur dédiée
 *                (ex: Audit) — traité comme CORE pour la résolution de menu.
 * - OPTIONAL   : activable/désactivable par le tenant, sous réserve que sa
 *                `requiresCapability` (si définie) soit elle-même activée.
 * - ADVANCED   : comme OPTIONAL, mais destiné à une section "avancé" de
 *                l'interface (regroupement visuel = PLANNED, la donnée existe déjà).
 * - HIDDEN     : jamais exposé dans le menu, quel que soit son état.
 */
export const MODULE_CATEGORY = {
  CORE: 'CORE',
  AUTOMATIC: 'AUTOMATIC',
  OPTIONAL: 'OPTIONAL',
  ADVANCED: 'ADVANCED',
  HIDDEN: 'HIDDEN',
} as const;

export type ModuleCategory = (typeof MODULE_CATEGORY)[keyof typeof MODULE_CATEGORY];

export interface ModuleDefinition {
  key: string;
  label: string;
  category: ModuleCategory;
  requiresCapability?: CapabilityKey;
  /**
   * Autres modules (par clé) devant être ACTIFS pour que celui-ci le soit
   * (Phase 8.2). Vérifié par BusinessProfileService : une activation est
   * refusée si une dépendance n'est pas active, une désactivation est
   * refusée si un autre module actif dépend encore de celui-ci — jamais un
   * module qui casse silencieusement un autre en s'activant/se désactivant.
   */
  dependencies?: string[];
}

export const MODULES_CATALOG: ModuleDefinition[] = [
  { key: 'sell', label: 'Vendre', category: MODULE_CATEGORY.CORE },
  { key: 'sales', label: 'Ventes', category: MODULE_CATEGORY.CORE },
  { key: 'catalog', label: 'Catalogue', category: MODULE_CATEGORY.CORE },
  { key: 'customers', label: 'Clients', category: MODULE_CATEGORY.CORE },
  { key: 'settings', label: 'Configuration', category: MODULE_CATEGORY.CORE },
  { key: 'users', label: 'Utilisateurs & rôles', category: MODULE_CATEGORY.CORE },
  { key: 'audit', label: 'Audit', category: MODULE_CATEGORY.AUTOMATIC },
  { key: 'reports', label: 'Rapports', category: MODULE_CATEGORY.OPTIONAL },

  { key: 'inventory', label: 'Stock', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.INVENTORY },
  { key: 'services', label: 'Prestations & Services', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.SERVICES },
  { key: 'credit', label: 'Crédit clients', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.CUSTOMER_CREDIT },
  { key: 'pricing', label: 'Tarification', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.CUSTOM_PRICING },

  { key: 'invoices', label: 'Factures', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.INVOICING },
  { key: 'orders', label: 'Commandes', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.ORDERS },
  { key: 'progressive_purchases', label: 'Versements progressifs', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.PROGRESSIVE_PURCHASES },
  { key: 'cash', label: 'Caisse', category: MODULE_CATEGORY.OPTIONAL },
  { key: 'suppliers', label: 'Fournisseurs', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.PURCHASES },
  { key: 'returns', label: 'Retours', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.RETURNS },
  { key: 'warranties', label: 'Garanties', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.WARRANTIES },
  // La livraison n'a de sens que sur une commande à livrer — dépendance
  // déclarée à titre d'exemple concret (cf continuation §13), vérifiée au
  // niveau métadonnées même si l'Order Engine lui-même est PLANNED.
  { key: 'delivery', label: 'Livraison', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.DELIVERY, dependencies: ['orders'] },
  { key: 'customer_reports', label: 'Relevés clients', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.CUSTOMER_REPORTS, dependencies: ['customers'] },
  { key: 'social', label: 'Messages & Réseaux sociaux', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.SOCIAL_INBOX },
  { key: 'expenses', label: 'Dépenses', category: MODULE_CATEGORY.OPTIONAL, requiresCapability: CAPABILITIES.EXPENSES },
  { key: 'automation', label: 'Automatisations', category: MODULE_CATEGORY.ADVANCED, requiresCapability: CAPABILITIES.AUTOMATION },
  { key: 'diagnostics', label: 'Diagnostics & Réparation', category: MODULE_CATEGORY.ADVANCED, requiresCapability: CAPABILITIES.DIAGNOSTICS },
  { key: 'reseller_receipts', label: 'Reçus Revendeur (Bac à sable)', category: MODULE_CATEGORY.OPTIONAL },
  { key: 'staff_attendance', label: 'Pointage & Feuilles de temps', category: MODULE_CATEGORY.OPTIONAL },
  { key: 'appointments', label: 'Rendez-vous', category: MODULE_CATEGORY.ADVANCED, requiresCapability: CAPABILITIES.RESERVATIONS },
  { key: 'loyalty', label: 'Fidélité', category: MODULE_CATEGORY.ADVANCED },
];

export function getModuleDefinition(key: string): ModuleDefinition | undefined {
  return MODULES_CATALOG.find((m) => m.key === key);
}

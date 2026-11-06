import { CAPABILITIES, PERMISSIONS, type CapabilityKey, type PermissionKey } from '@gestionnaire/db';

export interface MenuItem {
  key: string;
  label: string;
  path: string;
  requiredAnyOf: PermissionKey[];
  /**
   * Capability tenant devant être active pour que l'item apparaisse, EN PLUS
   * de la permission utilisateur (cf docs/architecture — menu adaptatif =
   * capability ET permission ET règle d'affichage). Absent = toujours visible
   * dès lors que la permission est accordée (item non lié à une capability).
   */
  requiredCapability?: CapabilityKey;
  /**
   * Module (registre distinct des capabilities, cf `modules.catalog.ts`)
   * devant être RÉSOLU ACTIF pour ce tenant — combine déjà la capability
   * requise du module ET le choix explicite du tenant de le désactiver
   * (cf `BusinessProfileService.getResolvedModules`). Absent = item non
   * rattaché à un module désactivable (ex: Ventes, Clients = CORE).
   */
  moduleKey?: string;
}

/**
 * Arbre de menu déclaratif : une section n'apparaît que si l'utilisateur possède
 * au moins une des permissions listées, dans au moins un scope. C'est le
 * mécanisme concret du principe "90% de complexité cachée" (cf
 * docs/architecture/04-architecture-web.md §5 et
 * docs/architecture/08-roles-permissions.md §4) — le frontend consomme ce
 * résultat déjà calculé, il ne réimplémente jamais la logique de permission.
 */
export const MENU_DEFINITION: MenuItem[] = [
  {
    key: 'sell',
    label: 'Vendre',
    path: '/sales/new',
    requiredAnyOf: [PERMISSIONS.SALES_CREATE],
  },
  {
    key: 'sales',
    label: 'Ventes',
    path: '/sales',
    requiredAnyOf: [PERMISSIONS.SALES_READ],
  },
  {
    key: 'catalog',
    label: 'Catalogue',
    path: '/catalog',
    requiredAnyOf: [PERMISSIONS.CATALOG_READ],
  },
  {
    key: 'inventory',
    label: 'Stock',
    path: '/inventory',
    requiredAnyOf: [PERMISSIONS.INVENTORY_STOCK_READ],
    requiredCapability: CAPABILITIES.INVENTORY,
    moduleKey: 'inventory',
  },
  {
    key: 'services',
    label: 'Prestations & Services',
    path: '/services',
    requiredAnyOf: [PERMISSIONS.SERVICES_READ],
    requiredCapability: CAPABILITIES.SERVICES,
    moduleKey: 'services',
  },
  {
    key: 'appointments',
    label: 'Rendez-vous',
    path: '/appointments',
    requiredAnyOf: [PERMISSIONS.APPOINTMENTS_READ],
    moduleKey: 'appointments',
  },
  {
    key: 'customers',
    label: 'Clients',
    path: '/customers',
    requiredAnyOf: [PERMISSIONS.CUSTOMERS_READ],
  },
  {
    key: 'orders',
    label: 'Commandes',
    path: '/orders',
    requiredAnyOf: [PERMISSIONS.ORDERS_READ],
    requiredCapability: CAPABILITIES.ORDERS,
    moduleKey: 'orders',
  },
  {
    key: 'progressive-purchases',
    label: 'Versements progressifs',
    path: '/progressive-purchases',
    requiredAnyOf: [PERMISSIONS.PROGRESSIVE_PURCHASES_READ],
    requiredCapability: CAPABILITIES.PROGRESSIVE_PURCHASES,
    moduleKey: 'progressive_purchases',
  },
  {
    key: 'suppliers',
    label: 'Fournisseurs',
    path: '/suppliers',
    requiredAnyOf: [PERMISSIONS.SUPPLIERS_READ, PERMISSIONS.PURCHASES_READ],
    requiredCapability: CAPABILITIES.PURCHASES,
    moduleKey: 'suppliers',
  },
  {
    key: 'returns',
    label: 'Retours',
    path: '/returns',
    requiredAnyOf: [PERMISSIONS.RETURNS_READ],
    requiredCapability: CAPABILITIES.RETURNS,
    moduleKey: 'returns',
  },
  {
    key: 'warranties',
    label: 'Garanties',
    path: '/warranties',
    requiredAnyOf: [PERMISSIONS.WARRANTIES_READ],
    requiredCapability: CAPABILITIES.WARRANTIES,
    moduleKey: 'warranties',
  },
  {
    key: 'documents',
    label: 'Documents',
    path: '/documents',
    // Toujours visible dès SALES_READ (le reçu est core, cf Phase 3) — les
    // actions "Émettre une facture/un devis" à l'intérieur de la page sont,
    // elles, conditionnées à la capability "invoicing" côté frontend, sans
    // dupliquer la logique de permission (même principe que les onglets
    // Variantes/Lots dans le Catalogue).
    requiredAnyOf: [PERMISSIONS.SALES_READ],
  },
  {
    key: 'deliveries',
    label: 'Livraisons',
    path: '/deliveries',
    requiredAnyOf: [PERMISSIONS.DELIVERIES_READ],
    requiredCapability: CAPABILITIES.DELIVERY,
    moduleKey: 'delivery',
  },
  {
    key: 'services',
    label: 'Prestations & Services',
    path: '/services',
    requiredAnyOf: [PERMISSIONS.SERVICES_READ],
    requiredCapability: CAPABILITIES.SERVICES,
    moduleKey: 'services',
  },
  {
    key: 'credit',
    label: 'Crédit clients',
    path: '/credit',
    requiredAnyOf: [PERMISSIONS.CREDIT_READ],
    requiredCapability: CAPABILITIES.CUSTOMER_CREDIT,
    moduleKey: 'credit',
  },
  {
    key: 'pricing',
    label: 'Tarification',
    path: '/pricing',
    requiredAnyOf: [PERMISSIONS.PRICING_MANAGE],
    requiredCapability: CAPABILITIES.CUSTOM_PRICING,
    moduleKey: 'pricing',
  },
  {
    key: 'cash',
    label: 'Caisse',
    path: '/cash',
    requiredAnyOf: [PERMISSIONS.CASH_SESSION_READ],
    moduleKey: 'cash',
  },
  {
    key: 'reports',
    label: 'Rapports',
    path: '/reports',
    requiredAnyOf: [PERMISSIONS.REPORTS_SALES_READ, PERMISSIONS.REPORTS_FINANCIAL_READ],
    moduleKey: 'reports',
  },
  {
    key: 'stock_valuation',
    label: 'Calculs & Simulations',
    path: '/reports/calculations',
    requiredAnyOf: [PERMISSIONS.REPORTS_SALES_READ, PERMISSIONS.REPORTS_FINANCIAL_READ],
    moduleKey: 'reports',
  },
  {
    key: 'social',
    label: 'Réseaux Sociaux',
    path: '/social',
    requiredAnyOf: [PERMISSIONS.SOCIAL_READ],
    requiredCapability: CAPABILITIES.SOCIAL_INBOX,
    moduleKey: 'social',
  },
  {
    key: 'audit',
    label: 'Audit',
    path: '/audit',
    requiredAnyOf: [PERMISSIONS.AUDIT_READ],
  },
  {
    key: 'settings-users',
    label: 'Utilisateurs & rôles',
    path: '/settings/users',
    requiredAnyOf: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE],
  },
  {
    key: 'settings-config',
    label: 'Configuration',
    path: '/settings/config',
    requiredAnyOf: [PERMISSIONS.SETTINGS_READ],
  },
  {
    key: 'settings-peripherals',
    label: 'Périphériques & impression',
    path: '/settings/peripherals',
    requiredAnyOf: [PERMISSIONS.DEVICES_MANAGE],
  },
  {
    key: 'settings-business-profile',
    label: 'Profil du commerce',
    path: '/settings/business-profile',
    requiredAnyOf: [PERMISSIONS.SETTINGS_READ],
  },
  {
    key: 'expenses',
    label: 'Dépenses & Charges',
    path: '/expenses',
    requiredAnyOf: [PERMISSIONS.EXPENSES_READ],
    requiredCapability: CAPABILITIES.EXPENSES,
    moduleKey: 'expenses',
  },
  {
    key: 'partners',
    label: 'Partenaires & Investisseurs',
    path: '/partners',
    requiredAnyOf: [PERMISSIONS.EXPENSES_READ, PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.REPORTS_FINANCIAL_READ],
  },
  {
    key: 'automation',
    label: 'Automatisation',
    path: '/automation',
    requiredAnyOf: [PERMISSIONS.AUTOMATION_READ],
    requiredCapability: CAPABILITIES.AUTOMATION,
    moduleKey: 'automation',
  },
  {
    key: 'diagnostics',
    label: 'Diagnostic & Réparation',
    path: '/diagnostics',
    requiredAnyOf: [PERMISSIONS.DIAGNOSTICS_RUN],
    requiredCapability: CAPABILITIES.DIAGNOSTICS,
    moduleKey: 'diagnostics',
  },
  {
    key: 'help',
    label: 'Centre d’aide (FR/EN)',
    path: '/help',
    requiredAnyOf: [PERMISSIONS.CATALOG_READ, PERMISSIONS.SALES_READ, PERMISSIONS.SETTINGS_READ],
  },
  {
    key: 'reseller-receipts',
    label: 'Reçus Revendeur',
    path: '/reseller-receipts',
    requiredAnyOf: [PERMISSIONS.SALES_READ],
    moduleKey: 'reseller_receipts',
  },
  {
    key: 'staff-attendance',
    label: 'Pointage Boutique',
    path: '/staff-attendance',
    requiredAnyOf: [PERMISSIONS.SALES_READ, PERMISSIONS.USERS_MANAGE],
    moduleKey: 'staff_attendance',
  },
  {
    key: 'settings-subscription',
    label: 'Abonnement & Quotas',
    path: '/settings/subscription',
    requiredAnyOf: [PERMISSIONS.SETTINGS_READ],
  },
];

/**
 * Un item est visible ⟺ module actif (si rattaché à un module) ET capability
 * active (si applicable) ET permission utilisateur — cacher un item côté UI
 * n'est jamais la sécurité réelle (appliquée côté serveur par
 * CapabilityGuard/PermissionGuard), seulement un reflet honnête de ce que
 * l'utilisateur peut effectivement faire.
 */
export function buildMenu(
  grantedKeys: Set<PermissionKey>,
  enabledCapabilities: Set<CapabilityKey>,
  enabledModules: Set<string>,
) {
  return MENU_DEFINITION.filter((item) => {
    const hasPermission = item.requiredAnyOf.some((p) => grantedKeys.has(p));
    if (!hasPermission) return false;
    if (item.requiredCapability && !enabledCapabilities.has(item.requiredCapability)) return false;
    if (item.moduleKey && !enabledModules.has(item.moduleKey)) return false;
    return true;
  }).map(({ key, label, path }) => ({ key, label, path }));
}

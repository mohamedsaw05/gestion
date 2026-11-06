/**
 * Catalogue des capabilities — même principe que permissions.catalog.ts et
 * settings.catalog.ts : source de vérité codée et versionnée, jamais une clé
 * libre en base. Une capability est une capacité RÉELLEMENT utilisée par CE
 * commerce, avec des conséquences vérifiables dans le code (cf
 * docs/PROJECT_STATUS.md pour l'état réel de branchement de chacune).
 *
 * `defaultEnabled` reflète le comportement du système AVANT l'introduction de
 * ce catalogue, pour ne pas régresser les tenants existants (cf règle : ne
 * jamais casser un tenant existant en ajoutant un système de configuration).
 * `implemented: false` signifie que le flag existe pour la cohérence du
 * catalogue et de l'assistant de configuration, mais qu'AUCUN moteur ne le
 * consulte encore — l'activer ou le désactiver n'a aucun effet réel tant que
 * le moteur correspondant (Order/Purchase/Delivery/...) n'existe pas.
 */

export const CAPABILITIES = {
  INVENTORY: 'inventory',
  MULTIPLE_LOCATIONS: 'multiple_locations',
  CUSTOMER_CREDIT: 'customer_credit',
  CUSTOM_PRICING: 'custom_pricing',
  SERVICES: 'services',
  RECEIPTS: 'receipts',
  INVOICING: 'invoicing',
  ORDERS: 'orders',
  DELIVERY: 'delivery',
  RESERVATIONS: 'reservations',
  SERIAL_NUMBERS: 'serial_numbers',
  VARIANTS: 'variants',
  PURCHASES: 'purchases',
  RETURNS: 'returns',
  WARRANTIES: 'warranties',
  PROGRESSIVE_PURCHASES: 'progressive_purchases',
  BATCH_TRACKING: 'batch_tracking',
  CUSTOMER_REPORTS: 'customer_reports',
  SOCIAL_INBOX: 'social_inbox',
  EXPENSES: 'expenses',
  AUTOMATION: 'automation',
  DIAGNOSTICS: 'diagnostics',
} as const;

export type CapabilityKey = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

export const ALL_CAPABILITY_KEYS: CapabilityKey[] = Object.values(CAPABILITIES);

export function isValidCapabilityKey(key: string): key is CapabilityKey {
  return (ALL_CAPABILITY_KEYS as string[]).includes(key);
}

export interface CapabilityDefinition {
  key: CapabilityKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
  implemented: boolean;
}

export const CAPABILITIES_CATALOG: CapabilityDefinition[] = [
  {
    key: CAPABILITIES.INVENTORY,
    label: 'Gestion de stock',
    description:
      "Suivi des quantités en stock. Si désactivé, les produits physiques sont créés sans suivi de stock (isStocked forcé à faux) et le module Stock est masqué.",
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.MULTIPLE_LOCATIONS,
    label: 'Plusieurs emplacements',
    description: "Autorise la création de plus d'un magasin/dépôt pour ce commerce.",
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.CUSTOMER_CREDIT,
    label: 'Vente à crédit',
    description:
      "Autorise une vente avec solde dû. Si désactivé, toute vente doit être intégralement payée et le module Crédit clients est masqué.",
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.CUSTOM_PRICING,
    label: 'Tarification personnalisée',
    description:
      "Prix négociés par client et paliers de quantité. Si désactivé, seul le prix de base s'applique et le module Tarification est masqué.",
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.SERVICES,
    label: 'Vente de services',
    description: 'Autorise la création de produits de type SERVICE (jamais stockés).',
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.RECEIPTS,
    label: 'Reçus',
    description: 'Génération automatique d\'un reçu à chaque vente.',
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.INVOICING,
    label: 'Facturation',
    description:
      'Émission à la demande de factures (depuis une vente) et de devis (depuis une commande), distincts du reçu automatique.',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.ORDERS,
    label: 'Commandes',
    description:
      'Commandes clients distinctes de la vente immédiate, avec acompte et progression de statut (Order Engine). Complète en vente réelle uniquement à la finalisation.',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.DELIVERY,
    label: 'Livraison',
    description:
      'Livraison planifiée pour une commande (Delivery Engine) : statut PENDING → OUT_FOR_DELIVERY → DELIVERED/FAILED, bon de livraison généré à la livraison.',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.RESERVATIONS,
    label: 'Réservations / rendez-vous',
    description: 'Prise de rendez-vous ou réservation de créneau.',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.SERIAL_NUMBERS,
    label: 'Numéros de série / IMEI',
    description:
      'Suivi individuel de certains produits (électronique, informatique) : chaque unité vendue/retournée doit être identifiée par son numéro exact.',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.VARIANTS,
    label: 'Variantes de produits',
    description:
      'Déclinaisons d\'un même produit (taille, couleur...) avec SKU et stock propres — chaque variante est vendue/stockée comme un produit à part entière.',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.PURCHASES,
    label: 'Achats fournisseurs',
    description:
      'Fournisseurs, commandes fournisseur avec réception partielle/totale, dette fournisseur (Purchase Engine).',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.RETURNS,
    label: 'Retours / remboursements',
    description:
      'Retour d\'un produit vendu, avec remise en stock si l\'état le permet et remboursement (Returns Engine).',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.WARRANTIES,
    label: 'Garanties',
    description:
      'Politique de garantie par produit ; une garantie est créée automatiquement à la vente et peut faire l\'objet d\'une réclamation (Warranty Engine).',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.PROGRESSIVE_PURCHASES,
    label: 'Versements progressifs',
    description: 'Dossiers de versements clients cumulés avant achat, avec reçu pour chaque dépôt.',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.BATCH_TRACKING,
    label: 'Lots / péremption',
    description:
      'Suivi du stock par lot avec date de péremption optionnelle (produits alimentaires, pharmaceutiques...) ; consommé automatiquement du lot le plus proche de péremption (FEFO) à la vente.',
    defaultEnabled: false,
    implemented: true,
  },
  {
    key: CAPABILITIES.CUSTOMER_REPORTS,
    label: 'Relevés et rapports clients',
    description:
      'Génération de relevés de compte et historiques détaillés par client (achats, paiements, retours, créances) exportables en PDF.',
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.SOCIAL_INBOX,
    label: 'Messagerie & Réseaux sociaux',
    description:
      'Boîte de réception unifiée officielle pour Facebook, Instagram, TikTok et WhatsApp (Meta Graph API, TikTok Business, WhatsApp Cloud).',
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.EXPENSES,
    label: 'Gestion des Dépenses',
    description:
      'Suivi rigoureux des frais opérationnels (loyer, salaires, énergie) avec justificatifs et réconciliation caisse.',
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.AUTOMATION,
    label: 'Règles d\'Automatisation',
    description:
      'Moteur de règles métier configurables : alertes de stock, relances, seuils et déclencheurs.',
    defaultEnabled: true,
    implemented: true,
  },
  {
    key: CAPABILITIES.DIAGNOSTICS,
    label: 'Diagnostics Système & Auto-Réparation',
    description:
      'Scans d\'intégrité de la base de données, détection d\'orphelins et auto-réparation sûre.',
    defaultEnabled: true,
    implemented: true,
  },
];

export function getCapabilityDefinition(key: CapabilityKey): CapabilityDefinition {
  const def = CAPABILITIES_CATALOG.find((d) => d.key === key);
  if (!def) throw new Error(`Capability inconnue : ${key}`);
  return def;
}

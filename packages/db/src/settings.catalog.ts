/**
 * Catalogue des paramètres de configuration tenant — même principe que le
 * catalogue de permissions (packages/db/src/permissions.catalog.ts) : source
 * de vérité codée et versionnée, pas une liste libre en base. Chaque clé
 * correspond à un comportement RÉELLEMENT branché dans un moteur (jamais un
 * paramètre décoratif qui ne change rien) — cf docs/architecture/02-moteurs.md §7.
 *
 * Format de clé : domaine.parametre (ex: "sales.requireCustomerForCreditSales").
 */

export const SETTINGS = {
  DEFAULT_CURRENCY: 'commerce.defaultCurrency',
  ENABLED_PAYMENT_METHODS: 'payments.enabledMethods',
  REQUIRE_CUSTOMER_FOR_CREDIT: 'sales.requireCustomerForCreditSales',
  REQUIRE_CUSTOMER_ALWAYS: 'sales.requireCustomerAlways',
  ALLOW_NEGATIVE_STOCK: 'inventory.allowNegativeStock',
  RECEIPT_FOOTER_TEXT: 'documents.receiptFooterText',
  ORGANIZATION_LOGO: 'documents.logoDataUri',
  ORGANIZATION_LEGAL_NAME: 'organization.legalName',
  ORGANIZATION_PHONE: 'organization.phone',
  ORGANIZATION_EMAIL: 'organization.email',
  ORGANIZATION_ADDRESS: 'organization.address',
  ORGANIZATION_TAX_ID: 'organization.taxId',
  RECEIPT_HEADER_TEXT: 'documents.receiptHeaderText',
  INVOICE_TEMPLATE: 'documents.invoiceTemplate',
  SHOW_CUSTOMER_ON_RECEIPTS: 'documents.showCustomerOnReceipts',
  WHATSAPP_CREDIT_REMINDERS_ENABLED: 'reminders.whatsappCreditRemindersEnabled',
  DISCRETE_UNITS: 'inventory.discreteUnits',
  ONBOARDING_DISMISSED: 'onboarding.dismissed',
  LOW_STOCK_THRESHOLD: 'inventory.lowStockThreshold',
  RECEIPT_FORMAT: 'documents.receiptFormat',
  QUOTE_VALIDITY_DAYS: 'documents.quoteValidityDays',
  DEFAULT_OPENING_FLOAT: 'cash.defaultOpeningFloat',
  ALLOW_MANUAL_DISCOUNTS: 'sales.allowManualDiscounts',
  MAX_MANUAL_DISCOUNT_PERCENT: 'sales.maxManualDiscountPercent',
  DISCOUNT_MAX_SELLER_PERCENT: 'sales.discountMaxSellerPercent',
  DISCOUNT_MAX_MANAGER_PERCENT: 'sales.discountMaxManagerPercent',
  ALLOW_SALE_BELOW_COST: 'sales.allowSaleBelowCost',
  DEFAULT_CREDIT_TERM_DAYS: 'credit.defaultCreditTermDays',
  INVENTORY_VALUATION_METHOD: 'inventory.valuationMethod',
  INVENTORY_REORDER_LEAD_DAYS: 'inventory.reorderLeadDays',
  CREDIT_AMORTIZATION_METHOD: 'credit.amortizationMethod',
  CREDIT_MAX_DEBT_RATIO_PERCENT: 'credit.maxDebtRatioPercent',
  CREDIT_LATE_PENALTY_DAILY_RATE: 'credit.latePenaltyDailyRate',
  FESTIVE_MODE: 'festive.mode',
} as const;

export type SettingKey = (typeof SETTINGS)[keyof typeof SETTINGS];

export const ALL_SETTING_KEYS: SettingKey[] = Object.values(SETTINGS);

export function isValidSettingKey(key: string): key is SettingKey {
  return (ALL_SETTING_KEYS as string[]).includes(key);
}

export type SettingType = 'string' | 'boolean' | 'string[]';

export interface SettingDefinition {
  key: SettingKey;
  label: string;
  description: string;
  type: SettingType;
  default: unknown;
  /** Pour type "string[]" contraint à un ensemble fermé (ex: méthodes de paiement). */
  allowedValues?: string[];
  /**
   * Résolution hiérarchique (Phase 8.1) : true si un emplacement peut
   * surcharger la valeur tenant pour ce paramètre précis (ex: un pied de
   * reçu différent par magasin). Absent/false = paramètre uniquement au
   * niveau tenant — ne pas activer sans qu'un moteur consulte réellement
   * cette surcharge (même règle que pour le catalogue lui-même : jamais un
   * champ décoratif).
   */
  allowLocationOverride?: boolean;
}

export const SETTINGS_CATALOG: SettingDefinition[] = [
  {
    key: SETTINGS.DEFAULT_CURRENCY,
    label: 'Devise par défaut',
    description: "Utilisée pour une vente créée sans devise explicite. N'affecte pas les ventes déjà enregistrées (snapshotées).",
    type: 'string',
    default: 'XOF',
  },
  {
    key: SETTINGS.ENABLED_PAYMENT_METHODS,
    label: 'Moyens de paiement activés',
    description: "Une vente ne peut être payée qu'avec l'un de ces moyens — cf Payment Engine.",
    type: 'string[]',
    default: ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK'],
    allowedValues: ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK'],
  },
  {
    key: SETTINGS.REQUIRE_CUSTOMER_FOR_CREDIT,
    label: 'Client obligatoire pour une vente à crédit',
    description: "Si activé (recommandé), une vente avec solde dû sans client sélectionné est refusée — cf Credit Engine.",
    type: 'boolean',
    default: true,
  },
  {
    key: SETTINGS.REQUIRE_CUSTOMER_ALWAYS,
    label: 'Client obligatoire pour toute vente',
    description: "Si activé, TOUTE vente (même intégralement payée) doit désigner un client — plus strict que l'exigence limitée aux ventes à crédit.",
    type: 'boolean',
    default: false,
  },
  {
    key: SETTINGS.ALLOW_NEGATIVE_STOCK,
    label: 'Autoriser la vente en stock négatif',
    description: "Si désactivé (recommandé), une vente ou un ajustement qui ferait passer le stock sous zéro est refusé — cf Inventory Engine.",
    type: 'boolean',
    default: false,
  },
  {
    key: SETTINGS.RECEIPT_FOOTER_TEXT,
    label: 'Texte de pied de reçu',
    description:
      'Affiché en bas du reçu PDF (ex: mentions légales, coordonnées). Peut être personnalisé par emplacement (ex: adresse propre à chaque magasin) — sinon la valeur du commerce s\'applique.',
    type: 'string',
    default: '',
    allowLocationOverride: true,
  },
  {
    key: SETTINGS.ORGANIZATION_LOGO,
    label: "Logo de l'entreprise (Image Data URI)",
    description: "Logo officiel imprimé sur les reçus, factures, devis et bons de livraison.",
    type: 'string',
    default: '',
  },
  {
    key: SETTINGS.ORGANIZATION_LEGAL_NAME,
    label: 'Raison sociale / Nom commercial',
    description: "Nom de l'entreprise imprimé en en-tête de tous les documents émis.",
    type: 'string',
    default: '',
  },
  {
    key: SETTINGS.ORGANIZATION_PHONE,
    label: 'Téléphone commercial',
    description: 'Numéro de téléphone de contact imprimé sur les reçus.',
    type: 'string',
    default: '',
  },
  {
    key: SETTINGS.ORGANIZATION_EMAIL,
    label: 'Email commercial',
    description: 'Adresse email professionnelle affichée sur les documents.',
    type: 'string',
    default: '',
  },
  {
    key: SETTINGS.ORGANIZATION_ADDRESS,
    label: 'Adresse physique',
    description: "Adresse du siège ou de l'établissement principal.",
    type: 'string',
    default: '',
  },
  {
    key: SETTINGS.ORGANIZATION_TAX_ID,
    label: 'Identifiant fiscal (NIF / RCCM)',
    description: 'Numéro d’identification fiscale légalement obligatoire sur les factures.',
    type: 'string',
    default: '',
  },
  {
    key: SETTINGS.RECEIPT_HEADER_TEXT,
    label: "Message d'en-tête de reçu",
    description: 'Texte affiché sous le logo sur les reçus (ex: slogan, bienvenue).',
    type: 'string',
    default: '',
  },
  {
    key: SETTINGS.INVOICE_TEMPLATE,
    label: 'Modèle de facture par défaut',
    description: 'Choix du template de facture parmi les 5 modèles officiels (STANDARD_PRO, COMPACT, DETAILED, ELEGANT, SERVICES).',
    type: 'string',
    default: 'STANDARD_PRO',
    allowedValues: ['STANDARD_PRO', 'COMPACT', 'DETAILED', 'ELEGANT', 'SERVICES'],
  },
  {
    key: SETTINGS.SHOW_CUSTOMER_ON_RECEIPTS,
    label: 'Afficher le client sur les reçus',
    description: 'Affiche le nom et le contact du client sur le ticket de caisse lorsqu’un client est rattaché.',
    type: 'boolean',
    default: true,
  },
  {
    key: SETTINGS.WHATSAPP_CREDIT_REMINDERS_ENABLED,
    label: 'Autoriser relances de créances sur WhatsApp (restreint)',
    description: 'Conformité stricte : WhatsApp Business interdit le recouvrement de créance par défaut. Activer uniquement si l’activité et la juridiction l’autorisent expressément.',
    type: 'boolean',
    default: false,
  },
  {
    key: SETTINGS.DISCRETE_UNITS,
    label: 'Unités discrètes (quantités entières obligatoires)',
    description: 'Liste des unités pour lesquelles les quantités doivent obligatoirement être des nombres entiers (ex: piece, carton, boite).',
    type: 'string[]',
    default: ['piece', 'carton', 'pack', 'boite', 'bouteille', 'sac'],
  },
  {
    key: SETTINGS.ONBOARDING_DISMISSED,
    label: 'Guide de démarrage masqué',
    description: 'Indique si l’utilisateur a masqué le guide de démarrage initial.',
    type: 'boolean',
    default: false,
  },
  {
    key: SETTINGS.LOW_STOCK_THRESHOLD,
    label: 'Seuil d’alerte de stock faible par défaut',
    description: 'Niveau de stock sous lequel un article déclenche une alerte de réapprovisionnement.',
    type: 'string',
    default: '5',
  },
  {
    key: SETTINGS.RECEIPT_FORMAT,
    label: 'Format d’impression des tickets',
    description: 'Format de sortie des reçus de caisse : rouleau thermique 80mm ou feuille A4 standard.',
    type: 'string',
    default: 'THERMAL_80MM',
    allowedValues: ['THERMAL_80MM', 'A4_STANDARD'],
  },
  {
    key: SETTINGS.QUOTE_VALIDITY_DAYS,
    label: 'Délai de validité des devis (jours)',
    description: 'Nombre de jours de validité inscrit par défaut sur les devis émis aux clients (15 jours recommandés).',
    type: 'string',
    default: '15',
  },
  {
    key: SETTINGS.DEFAULT_OPENING_FLOAT,
    label: 'Fond de caisse suggéré à l’ouverture',
    description: 'Montant en espèces pré-rempli lors de l’ouverture d’une nouvelle session de caisse.',
    type: 'string',
    default: '0',
  },
  {
    key: SETTINGS.ALLOW_MANUAL_DISCOUNTS,
    label: 'Autoriser les remises manuelles en caisse',
    description: 'Permet au vendeur d’accorder une remise exceptionnelle sur le total du panier lors de l’encaissement.',
    type: 'boolean',
    default: true,
  },
  {
    key: SETTINGS.MAX_MANUAL_DISCOUNT_PERCENT,
    label: 'Plafond maximal de remise manuelle (%)',
    description: 'Pourcentage maximum de réduction que le vendeur a le droit d’appliquer sans validation gérant.',
    type: 'string',
    default: '20',
  },
  {
    key: SETTINGS.DISCOUNT_MAX_SELLER_PERCENT,
    label: 'Remise maximale Vendeur (%)',
    description: 'Plafond de remise commerciale accordable par un vendeur (défaut: 5%).',
    type: 'string',
    default: '5',
  },
  {
    key: SETTINGS.DISCOUNT_MAX_MANAGER_PERCENT,
    label: 'Remise maximale Responsable / Gérant (%)',
    description: 'Plafond de remise commerciale accordable par un responsable (défaut: 15%).',
    type: 'string',
    default: '15',
  },
  {
    key: SETTINGS.ALLOW_SALE_BELOW_COST,
    label: 'Autoriser la vente sous le coût de revient avec dérogation',
    description: 'Bloque par défaut toute vente sous le coût de revient (anti-vente à perte). Nécessite une dérogation explicite si activé.',
    type: 'boolean',
    default: false,
  },
  {
    key: SETTINGS.DEFAULT_CREDIT_TERM_DAYS,
    label: 'Délai d’échéance du crédit client (jours)',
    description: 'Délai accordé par défaut pour le règlement complet d’une créance avant relance.',
    type: 'string',
    default: '30',
  },
  {
    key: SETTINGS.INVENTORY_VALUATION_METHOD,
    label: 'Méthode de valorisation comptable du stock',
    description: 'CUMP (Coût Unitaire Moyen Pondéré) ou FIFO (Premier entré, premier sorti). Détermine le coût de revient des sorties.',
    type: 'string',
    default: 'CUMP',
    allowedValues: ['CUMP', 'FIFO'],
  },
  {
    key: SETTINGS.INVENTORY_REORDER_LEAD_DAYS,
    label: 'Délai moyen de livraison fournisseur (jours)',
    description: 'Nombre moyen de jours entre la commande fournisseur et la réception, utilisé pour calculer le point de réapprovisionnement automatique.',
    type: 'string',
    default: '7',
  },
  {
    key: SETTINGS.CREDIT_AMORTIZATION_METHOD,
    label: 'Méthode d’amortissement du crédit',
    description: 'Méthode de calcul des échéances : FREE_SCHEDULE (échéance libre/comptoir), CONSTANT_ANNUITY (mensualités constantes), CONSTANT_CAPITAL (capital fixe).',
    type: 'string',
    default: 'FREE_SCHEDULE',
    allowedValues: ['FREE_SCHEDULE', 'CONSTANT_ANNUITY', 'CONSTANT_CAPITAL'],
  },
  {
    key: SETTINGS.CREDIT_MAX_DEBT_RATIO_PERCENT,
    label: 'Taux d’endettement maximal autorisé (%)',
    description: 'Pourcentage maximum de la capacité financière client autorisé en encours de dette avant blocage préventif (0 = désactivé par défaut).',
    type: 'string',
    default: '0',
  },
  {
    key: SETTINGS.CREDIT_LATE_PENALTY_DAILY_RATE,
    label: 'Taux journalier de pénalité de retard (%)',
    description: 'Taux d’intérêt ou de pénalité appliqué par jour de retard sur les créances échues.',
    type: 'string',
    default: '0.1',
  },
  {
    key: SETTINGS.FESTIVE_MODE,
    label: 'Thèmes & Animations Festives (Noël, Nouvel An...)',
    description: 'AUTO (selon les dates du calendrier, sans blocage), DISABLED (désactivé pour l’entreprise), CHRISTMAS (Noël forcé), NEW_YEAR (Nouvel An forcé).',
    type: 'string',
    default: 'AUTO',
    allowedValues: ['AUTO', 'DISABLED', 'CHRISTMAS', 'NEW_YEAR'],
  },
];

export function getSettingDefinition(key: SettingKey): SettingDefinition {
  const def = SETTINGS_CATALOG.find((d) => d.key === key);
  if (!def) throw new Error(`Clé de configuration inconnue : ${key}`);
  return def;
}

export function getSettingDefault(key: SettingKey): unknown {
  return getSettingDefinition(key).default;
}

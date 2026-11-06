/**
 * Catalogue des permissions atomiques — source de vérité unique, codée et versionnée.
 * Décision architecturale : docs/architecture/02-moteurs.md §4 et
 * docs/architecture/08-roles-permissions.md §1.1 — ce catalogue n'est PAS une table
 * librement éditable en base, précisément pour garantir que toute permission vérifiée
 * dans le code existe réellement ici, et inversement.
 *
 * Format : module.ressource.action (ou module.action pour les ressources transverses).
 */
export const PERMISSIONS = {
  // Catalogue produits
  CATALOG_READ: 'catalog.product.read',
  CATALOG_WRITE: 'catalog.product.write',
  CATALOG_ARCHIVE: 'catalog.product.archive',

  // Stock
  INVENTORY_STOCK_READ: 'inventory.stock.read',
  INVENTORY_STOCK_ADJUST: 'inventory.stock.adjust',
  INVENTORY_TRANSFER_CREATE: 'inventory.transfer.create',

  // Clients
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_WRITE: 'customers.write',

  // Ventes
  SALES_CREATE: 'sales.create',
  SALES_READ: 'sales.read',
  SALES_CANCEL: 'sales.cancel',
  // Réservé : la remise manuelle en ligne de vente est PLANNED (Pricing Engine avancé,
  // cf docs/architecture/02-moteurs.md §8) — la clé existe déjà pour ne pas casser les
  // rôles qui l'attribueront quand la fonctionnalité sera implémentée.
  SALES_DISCOUNT: 'sales.discount',

  // Paiements
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_READ: 'payments.read',

  // Crédit client (Credit / Debt Engine)
  CREDIT_READ: 'credit.account.read',
  CREDIT_MANAGE: 'credit.payment.record',

  // Prix (Pricing Engine simplifié : prix négocié par client, paliers de quantité)
  PRICING_MANAGE: 'pricing.rule.manage',

  // Rapports
  REPORTS_SALES_READ: 'reports.sales.read',
  REPORTS_FINANCIAL_READ: 'reports.financial.read',

  // Administration tenant
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  DEVICES_MANAGE: 'devices.manage',

  // Audit
  AUDIT_READ: 'audit.read',

  // Configuration tenant (Configuration Engine)
  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage',

  // Caisse (Cash Register Engine)
  CASH_SESSION_READ: 'cash.session.read',
  CASH_SESSION_MANAGE: 'cash.session.manage',

  // Commandes (Order Engine)
  ORDERS_READ: 'orders.read',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update', // faire progresser le statut (confirmer, préparer, prête, compléter)
  ORDERS_CANCEL: 'orders.cancel',

  // Fournisseurs (Purchase Engine)
  SUPPLIERS_READ: 'suppliers.read',
  SUPPLIERS_WRITE: 'suppliers.write',
  PURCHASES_READ: 'purchases.read',
  PURCHASES_CREATE: 'purchases.create',
  PURCHASES_UPDATE: 'purchases.update', // confirmer, réceptionner
  PURCHASES_CANCEL: 'purchases.cancel',
  SUPPLIER_PAYMENT_MANAGE: 'suppliers.payment.record',

  // Retours / remboursements (Returns Engine)
  RETURNS_READ: 'returns.read',
  RETURNS_CREATE: 'returns.create',

  // Garanties (Phase 12, Warranty Engine) — variantes et numéros de série
  // réutilisent volontairement CATALOG_READ/WRITE (ce sont des données de
  // catalogue, pas un moteur métier distinct avec son propre cycle de vie).
  WARRANTIES_READ: 'warranties.read',
  WARRANTIES_MANAGE: 'warranties.policy.manage', // créer/modifier la politique de garantie d'un produit
  WARRANTIES_CLAIM: 'warranties.claim',
  PROGRESSIVE_PURCHASES_READ: 'progressive_purchases.read',
  PROGRESSIVE_PURCHASES_CREATE: 'progressive_purchases.create',
  PROGRESSIVE_PURCHASES_DEPOSIT: 'progressive_purchases.deposit',
  PROGRESSIVE_PURCHASES_MANAGE: 'progressive_purchases.manage',
  PROGRESSIVE_PURCHASES_REDEEM: 'progressive_purchases.redeem',
  PROGRESSIVE_PURCHASES_REFUND: 'progressive_purchases.refund',

  // Documents à la demande (Phase 14) — facture/devis émis manuellement ;
  // reçu/avoir/bon de livraison restent automatiques (pas de permission
  // dédiée, comme le reçu depuis la Phase 3), consultés via SALES_READ déjà
  // utilisé par DocumentsController.
  DOCUMENTS_ISSUE: 'documents.issue',

  // Livraisons (Phase 14, Delivery Engine)
  DELIVERIES_READ: 'deliveries.read',
  DELIVERIES_CREATE: 'deliveries.create',
  DELIVERIES_UPDATE: 'deliveries.update', // faire progresser (en cours de livraison, livrée, échouée)
  DELIVERIES_CANCEL: 'deliveries.cancel',

  // Alias catalogue & Recherche ultra-rapide
  CATALOG_ALIASES_MANAGE: 'catalog.alias.manage',

  // Relevés clients activables
  CUSTOMER_REPORTS_READ: 'customers.reports.read',

  // Réseaux sociaux & Boîte de réception unifiée
  SOCIAL_READ: 'social.inbox.read',
  SOCIAL_REPLY: 'social.inbox.reply',
  SOCIAL_MANAGE: 'social.accounts.manage',

  // Dépenses opérationnelles (Partie 3)
  EXPENSES_READ: 'expenses.read',
  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_APPROVE: 'expenses.approve',
  EXPENSES_DELETE: 'expenses.delete',

  // Stockage de fichiers & Médias (Partie 4)
  FILES_READ: 'files.read',
  FILES_UPLOAD: 'files.upload',
  FILES_DELETE: 'files.delete',

  // Moteur d'automatisation (Partie 7 & 14)
  AUTOMATION_READ: 'automation.read',
  AUTOMATION_MANAGE: 'automation.manage',

  // Diagnostic & Réparation sûre (Partie 6)
  DIAGNOSTICS_RUN: 'diagnostics.run',

  // Prestations & Services (Partie 26)
  SERVICES_READ: 'services.read',
  SERVICES_CREATE: 'services.create',
  SERVICES_UPDATE: 'services.update',
  SERVICES_BILL: 'services.bill',

  // Rendez-vous & Réservations (CAPABILITIES.RESERVATIONS)
  APPOINTMENTS_READ: 'appointments.read',
  APPOINTMENTS_CREATE: 'appointments.create',
  APPOINTMENTS_UPDATE: 'appointments.update',
  APPOINTMENTS_DELETE: 'appointments.delete',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(PERMISSIONS);


/**
 * Libellés lisibles pour l'interface de gestion des rôles (cf Phase 8.4) —
 * même principe que capabilities.catalog.ts/settings.catalog.ts : un
 * commerçant ne doit jamais voir une clé technique brute ("sales.discount")
 * sans un minimum de contexte humain. Regroupé par module pour l'affichage.
 */
export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  group: string;
}

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  { key: PERMISSIONS.CATALOG_READ, label: 'Consulter le catalogue', group: 'Catalogue' },
  { key: PERMISSIONS.CATALOG_WRITE, label: 'Créer/modifier des produits', group: 'Catalogue' },
  { key: PERMISSIONS.CATALOG_ARCHIVE, label: 'Archiver un produit', group: 'Catalogue' },

  { key: PERMISSIONS.INVENTORY_STOCK_READ, label: 'Consulter le stock', group: 'Stock' },
  { key: PERMISSIONS.INVENTORY_STOCK_ADJUST, label: 'Ajuster le stock', group: 'Stock' },
  { key: PERMISSIONS.INVENTORY_TRANSFER_CREATE, label: 'Transférer du stock entre emplacements', group: 'Stock' },

  { key: PERMISSIONS.CUSTOMERS_READ, label: 'Consulter les clients', group: 'Clients' },
  { key: PERMISSIONS.CUSTOMERS_WRITE, label: 'Créer/modifier des clients', group: 'Clients' },

  { key: PERMISSIONS.SALES_CREATE, label: 'Enregistrer une vente', group: 'Ventes' },
  { key: PERMISSIONS.SALES_READ, label: "Consulter l'historique des ventes", group: 'Ventes' },
  { key: PERMISSIONS.SALES_CANCEL, label: 'Annuler une vente', group: 'Ventes' },
  { key: PERMISSIONS.SALES_DISCOUNT, label: 'Appliquer une remise (PLANNED)', group: 'Ventes' },

  { key: PERMISSIONS.PAYMENTS_CREATE, label: 'Encaisser un paiement', group: 'Paiements' },
  { key: PERMISSIONS.PAYMENTS_READ, label: 'Consulter les paiements', group: 'Paiements' },

  { key: PERMISSIONS.CREDIT_READ, label: 'Consulter les comptes crédit', group: 'Crédit clients' },
  { key: PERMISSIONS.CREDIT_MANAGE, label: 'Enregistrer un remboursement', group: 'Crédit clients' },

  { key: PERMISSIONS.PRICING_MANAGE, label: 'Gérer les prix négociés/paliers', group: 'Tarification' },

  { key: PERMISSIONS.REPORTS_SALES_READ, label: 'Consulter les rapports de ventes', group: 'Rapports' },
  { key: PERMISSIONS.REPORTS_FINANCIAL_READ, label: 'Consulter les rapports financiers', group: 'Rapports' },

  { key: PERMISSIONS.USERS_MANAGE, label: 'Gérer les utilisateurs', group: 'Administration' },
  { key: PERMISSIONS.ROLES_MANAGE, label: 'Gérer les rôles', group: 'Administration' },
  { key: PERMISSIONS.DEVICES_MANAGE, label: 'Gérer les appareils (PLANNED)', group: 'Administration' },

  { key: PERMISSIONS.AUDIT_READ, label: "Consulter le journal d'audit", group: 'Audit' },

  { key: PERMISSIONS.SETTINGS_READ, label: 'Consulter la configuration', group: 'Configuration' },
  { key: PERMISSIONS.SETTINGS_MANAGE, label: 'Modifier la configuration', group: 'Configuration' },

  { key: PERMISSIONS.CASH_SESSION_READ, label: 'Consulter les sessions de caisse', group: 'Caisse' },
  { key: PERMISSIONS.CASH_SESSION_MANAGE, label: 'Ouvrir/fermer une session de caisse', group: 'Caisse' },

  { key: PERMISSIONS.ORDERS_READ, label: 'Consulter les commandes', group: 'Commandes' },
  { key: PERMISSIONS.ORDERS_CREATE, label: 'Créer une commande', group: 'Commandes' },
  { key: PERMISSIONS.ORDERS_UPDATE, label: 'Faire progresser une commande', group: 'Commandes' },
  { key: PERMISSIONS.ORDERS_CANCEL, label: 'Annuler une commande', group: 'Commandes' },

  { key: PERMISSIONS.SUPPLIERS_READ, label: 'Consulter les fournisseurs', group: 'Achats' },
  { key: PERMISSIONS.SUPPLIERS_WRITE, label: 'Créer/modifier un fournisseur', group: 'Achats' },
  { key: PERMISSIONS.PURCHASES_READ, label: 'Consulter les commandes fournisseur', group: 'Achats' },
  { key: PERMISSIONS.PURCHASES_CREATE, label: 'Créer une commande fournisseur', group: 'Achats' },
  { key: PERMISSIONS.PURCHASES_UPDATE, label: 'Confirmer/réceptionner une commande fournisseur', group: 'Achats' },
  { key: PERMISSIONS.PURCHASES_CANCEL, label: 'Annuler une commande fournisseur', group: 'Achats' },
  { key: PERMISSIONS.SUPPLIER_PAYMENT_MANAGE, label: 'Enregistrer un paiement fournisseur', group: 'Achats' },

  { key: PERMISSIONS.RETURNS_READ, label: 'Consulter les retours', group: 'Retours' },
  { key: PERMISSIONS.RETURNS_CREATE, label: 'Traiter un retour', group: 'Retours' },

  { key: PERMISSIONS.WARRANTIES_READ, label: 'Consulter les garanties', group: 'Garanties' },
  { key: PERMISSIONS.WARRANTIES_MANAGE, label: 'Définir la politique de garantie d\'un produit', group: 'Garanties' },
  { key: PERMISSIONS.WARRANTIES_CLAIM, label: 'Traiter une réclamation de garantie', group: 'Garanties' },
  { key: PERMISSIONS.PROGRESSIVE_PURCHASES_READ, label: 'Consulter les dossiers de versements progressifs', group: 'Versements progressifs' },
  { key: PERMISSIONS.PROGRESSIVE_PURCHASES_CREATE, label: 'Ouvrir un dossier de versements progressifs', group: 'Versements progressifs' },
  { key: PERMISSIONS.PROGRESSIVE_PURCHASES_DEPOSIT, label: 'Enregistrer un versement progressif', group: 'Versements progressifs' },
  { key: PERMISSIONS.PROGRESSIVE_PURCHASES_MANAGE, label: 'Modifier ou annuler un dossier progressif', group: 'Versements progressifs' },
  { key: PERMISSIONS.PROGRESSIVE_PURCHASES_REDEEM, label: 'Remettre un achat progressif au client', group: 'Versements progressifs' },
  { key: PERMISSIONS.PROGRESSIVE_PURCHASES_REFUND, label: 'Rembourser un dossier progressif', group: 'Versements progressifs' },

  { key: PERMISSIONS.DOCUMENTS_ISSUE, label: 'Émettre une facture ou un devis', group: 'Documents' },

  { key: PERMISSIONS.DELIVERIES_READ, label: 'Consulter les livraisons', group: 'Livraisons' },
  { key: PERMISSIONS.DELIVERIES_CREATE, label: 'Planifier une livraison', group: 'Livraisons' },
  { key: PERMISSIONS.DELIVERIES_UPDATE, label: 'Faire progresser une livraison', group: 'Livraisons' },
  { key: PERMISSIONS.DELIVERIES_CANCEL, label: 'Annuler une livraison', group: 'Livraisons' },

  { key: PERMISSIONS.CATALOG_ALIASES_MANAGE, label: 'Gérer les alias de recherche des produits', group: 'Catalogue' },
  { key: PERMISSIONS.CUSTOMER_REPORTS_READ, label: 'Consulter et exporter les relevés clients', group: 'Clients' },
  { key: PERMISSIONS.SOCIAL_READ, label: 'Consulter la boîte de réception sociale', group: 'Réseaux sociaux' },
  { key: PERMISSIONS.SOCIAL_REPLY, label: 'Répondre aux messages et commentaires sociaux', group: 'Réseaux sociaux' },
  { key: PERMISSIONS.SOCIAL_MANAGE, label: 'Configurer les comptes et connexions officielles', group: 'Réseaux sociaux' },

  { key: PERMISSIONS.EXPENSES_READ, label: 'Consulter les dépenses opérationnelles', group: 'Dépenses' },
  { key: PERMISSIONS.EXPENSES_CREATE, label: 'Enregistrer une dépense', group: 'Dépenses' },
  { key: PERMISSIONS.EXPENSES_APPROVE, label: 'Valider ou rejeter une dépense', group: 'Dépenses' },
  { key: PERMISSIONS.EXPENSES_DELETE, label: 'Supprimer une dépense non validée', group: 'Dépenses' },

  { key: PERMISSIONS.FILES_READ, label: 'Consulter les fichiers et pièces jointes', group: 'Stockage & Fichiers' },
  { key: PERMISSIONS.FILES_UPLOAD, label: 'Téléverser des justificatifs et médias', group: 'Stockage & Fichiers' },
  { key: PERMISSIONS.FILES_DELETE, label: 'Supprimer un fichier', group: 'Stockage & Fichiers' },

  { key: PERMISSIONS.AUTOMATION_READ, label: 'Consulter les règles d\'automatisation', group: 'Automatisation' },
  { key: PERMISSIONS.AUTOMATION_MANAGE, label: 'Créer et configurer des automatisations', group: 'Automatisation' },

  { key: PERMISSIONS.DIAGNOSTICS_RUN, label: 'Lancer un diagnostic et réparations sûres', group: 'Système & Diagnostic' },

  { key: PERMISSIONS.SERVICES_READ, label: 'Consulter les interventions et prestations', group: 'Prestations & Services' },
  { key: PERMISSIONS.SERVICES_CREATE, label: 'Créer un dossier d\'intervention', group: 'Prestations & Services' },
  { key: PERMISSIONS.SERVICES_UPDATE, label: 'Mettre à jour, planifier et ajouter des pièces', group: 'Prestations & Services' },
  { key: PERMISSIONS.SERVICES_BILL, label: 'Facturer et clôturer une prestation', group: 'Prestations & Services' },

  { key: PERMISSIONS.APPOINTMENTS_READ, label: 'Consulter les rendez-vous et réservations', group: 'Rendez-vous' },
  { key: PERMISSIONS.APPOINTMENTS_CREATE, label: 'Prendre un rendez-vous / réservation', group: 'Rendez-vous' },
  { key: PERMISSIONS.APPOINTMENTS_UPDATE, label: 'Modifier ou replanifier un rendez-vous', group: 'Rendez-vous' },
  { key: PERMISSIONS.APPOINTMENTS_DELETE, label: 'Annuler un rendez-vous', group: 'Rendez-vous' },
];


export function isValidPermissionKey(key: string): key is PermissionKey {
  return (ALL_PERMISSION_KEYS as string[]).includes(key);
}

/**
 * Scopes de localisation applicables à une attribution de rôle
 * (docs/architecture/08-roles-permissions.md §1.3).
 */
export const SCOPE_TYPES = {
  ALL_LOCATIONS: 'ALL_LOCATIONS',
  LOCATIONS: 'LOCATIONS',
  OWN_RECORDS: 'OWN_RECORDS',
  TEAM: 'TEAM',
} as const;

export type ScopeType = (typeof SCOPE_TYPES)[keyof typeof SCOPE_TYPES];

/**
 * Rôles-modèles fournis par la plateforme (docs/architecture/08-roles-permissions.md §1.2).
 * Clonables et personnalisables par tenant ; ceux-ci servent aussi de données de
 * démonstration/seed pour les 6 profils de test demandés (Owner/Manager/Sales/Warehouse/Finance).
 */
export const ROLE_TEMPLATES: Record<
  string,
  { key: string; name: string; permissions: PermissionKey[] }
> = {
  TENANT_OWNER: {
    key: 'tenant_owner',
    name: 'Propriétaire',
    permissions: ALL_PERMISSION_KEYS,
  },
  MANAGER: {
    key: 'manager',
    name: 'Gestionnaire',
    permissions: [
      PERMISSIONS.CATALOG_READ,
      PERMISSIONS.CATALOG_WRITE,
      PERMISSIONS.CATALOG_ARCHIVE,
      PERMISSIONS.INVENTORY_STOCK_READ,
      PERMISSIONS.INVENTORY_STOCK_ADJUST,
      PERMISSIONS.INVENTORY_TRANSFER_CREATE,
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.CUSTOMERS_WRITE,
      PERMISSIONS.SALES_CREATE,
      PERMISSIONS.SALES_READ,
      PERMISSIONS.SALES_CANCEL,
      PERMISSIONS.PAYMENTS_CREATE,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.CREDIT_READ,
      PERMISSIONS.CREDIT_MANAGE,
      PERMISSIONS.PRICING_MANAGE,
      PERMISSIONS.REPORTS_SALES_READ,
      PERMISSIONS.REPORTS_FINANCIAL_READ,
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.CASH_SESSION_READ,
      PERMISSIONS.CASH_SESSION_MANAGE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_CREATE,
      PERMISSIONS.ORDERS_UPDATE,
      PERMISSIONS.ORDERS_CANCEL,
      PERMISSIONS.SUPPLIERS_READ,
      PERMISSIONS.SUPPLIERS_WRITE,
      PERMISSIONS.PURCHASES_READ,
      PERMISSIONS.PURCHASES_CREATE,
      PERMISSIONS.PURCHASES_UPDATE,
      PERMISSIONS.PURCHASES_CANCEL,
      PERMISSIONS.SUPPLIER_PAYMENT_MANAGE,
      PERMISSIONS.RETURNS_READ,
      PERMISSIONS.RETURNS_CREATE,
      PERMISSIONS.WARRANTIES_READ,
      PERMISSIONS.WARRANTIES_MANAGE,
      PERMISSIONS.WARRANTIES_CLAIM,
      PERMISSIONS.PROGRESSIVE_PURCHASES_READ,
      PERMISSIONS.PROGRESSIVE_PURCHASES_CREATE,
      PERMISSIONS.PROGRESSIVE_PURCHASES_DEPOSIT,
      PERMISSIONS.PROGRESSIVE_PURCHASES_MANAGE,
      PERMISSIONS.PROGRESSIVE_PURCHASES_REDEEM,
      PERMISSIONS.PROGRESSIVE_PURCHASES_REFUND,
      PERMISSIONS.DOCUMENTS_ISSUE,
      PERMISSIONS.DELIVERIES_READ,
      PERMISSIONS.DELIVERIES_CREATE,
      PERMISSIONS.DELIVERIES_UPDATE,
      PERMISSIONS.DELIVERIES_CANCEL,
      PERMISSIONS.CATALOG_ALIASES_MANAGE,
      PERMISSIONS.CUSTOMER_REPORTS_READ,
      PERMISSIONS.SOCIAL_READ,
      PERMISSIONS.SOCIAL_REPLY,
      PERMISSIONS.SOCIAL_MANAGE,
      PERMISSIONS.EXPENSES_READ,
      PERMISSIONS.EXPENSES_CREATE,
      PERMISSIONS.EXPENSES_APPROVE,
      PERMISSIONS.FILES_READ,
      PERMISSIONS.FILES_UPLOAD,
      PERMISSIONS.AUTOMATION_READ,
      PERMISSIONS.DIAGNOSTICS_RUN,
      PERMISSIONS.SERVICES_READ,
      PERMISSIONS.SERVICES_CREATE,
      PERMISSIONS.SERVICES_UPDATE,
      PERMISSIONS.SERVICES_BILL,
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.APPOINTMENTS_CREATE,
      PERMISSIONS.APPOINTMENTS_UPDATE,
      PERMISSIONS.APPOINTMENTS_DELETE,
    ],
  },
  SALES_USER: {
    key: 'sales_user',
    name: 'Vendeur',
    permissions: [
      PERMISSIONS.CATALOG_READ,
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.CUSTOMERS_WRITE,
      PERMISSIONS.SALES_CREATE,
      PERMISSIONS.SALES_READ,
      PERMISSIONS.PAYMENTS_CREATE,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.CREDIT_READ, // pour vérifier le solde d'un client avant une vente à crédit
      // Un vendeur ouvre/ferme sa propre caisse au quotidien (scope LOCATIONS
      // déjà restreint à son emplacement à l'attribution du rôle) — ce n'est
      // pas une opération réservée à l'encadrement.
      PERMISSIONS.CASH_SESSION_READ,
      PERMISSIONS.CASH_SESSION_MANAGE,
      // Un vendeur crée et fait progresser une commande (même logique que la
      // vente) mais ne l'annule pas — l'annulation reste au niveau encadrement.
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_CREATE,
      PERMISSIONS.ORDERS_UPDATE,
      // Un vendeur traite les retours au comptoir au quotidien.
      PERMISSIONS.RETURNS_READ,
      PERMISSIONS.RETURNS_CREATE,
      // Idem pour une réclamation de garantie apportée par un client — un
      // vendeur la traite, mais ne définit pas la politique du produit.
      PERMISSIONS.WARRANTIES_READ,
      PERMISSIONS.WARRANTIES_CLAIM,
      PERMISSIONS.PROGRESSIVE_PURCHASES_READ,
      PERMISSIONS.PROGRESSIVE_PURCHASES_CREATE,
      PERMISSIONS.PROGRESSIVE_PURCHASES_DEPOSIT,
      PERMISSIONS.PROGRESSIVE_PURCHASES_REDEEM,
      // Un vendeur émet une facture/un devis pour un client, et planifie une
      // livraison — il ne l'exécute pas lui-même (cf WAREHOUSE_USER).
      PERMISSIONS.DOCUMENTS_ISSUE,
      PERMISSIONS.DELIVERIES_READ,
      PERMISSIONS.DELIVERIES_CREATE,
      PERMISSIONS.SOCIAL_READ,
      PERMISSIONS.SOCIAL_REPLY,
      PERMISSIONS.SERVICES_READ,
      PERMISSIONS.SERVICES_CREATE,
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.APPOINTMENTS_CREATE,
      PERMISSIONS.APPOINTMENTS_UPDATE,
    ],
  },
  WAREHOUSE_USER: {
    key: 'warehouse_user',
    name: 'Gestionnaire de dépôt',
    permissions: [
      PERMISSIONS.CATALOG_READ,
      PERMISSIONS.INVENTORY_STOCK_READ,
      PERMISSIONS.INVENTORY_STOCK_ADJUST,
      PERMISSIONS.INVENTORY_TRANSFER_CREATE,
      // Le magasinier réceptionne une commande fournisseur (ça fait bouger SON
      // stock) mais ne décide pas d'acheter et ne gère pas le paiement fournisseur.
      PERMISSIONS.SUPPLIERS_READ,
      PERMISSIONS.PURCHASES_READ,
      PERMISSIONS.PURCHASES_UPDATE,
      // Symétrique : le magasinier/livreur EXÉCUTE une livraison planifiée
      // (en cours, livrée, échouée) mais ne décide pas de la planifier ni de
      // l'annuler — ces décisions restent au niveau vente/encadrement.
      PERMISSIONS.DELIVERIES_READ,
      PERMISSIONS.DELIVERIES_UPDATE,
    ],
  },
  FINANCE_USER: {
    key: 'finance_user',
    name: 'Finance',
    permissions: [
      PERMISSIONS.SALES_READ,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.CREDIT_READ,
      PERMISSIONS.CREDIT_MANAGE,
      PERMISSIONS.REPORTS_SALES_READ,
      PERMISSIONS.REPORTS_FINANCIAL_READ,
      PERMISSIONS.AUDIT_READ,
      // Consultation/rapprochement des sessions de caisse, pas de gestion
      // opérationnelle (ouverture/fermeture/mouvements) — cf CASH_SESSION_MANAGE.
      PERMISSIONS.CASH_SESSION_READ,
      PERMISSIONS.ORDERS_READ,
      // Symétrique de CREDIT_MANAGE côté achats : la Finance règle les
      // fournisseurs, elle ne décide pas des commandes elles-mêmes.
      PERMISSIONS.SUPPLIERS_READ,
      PERMISSIONS.PURCHASES_READ,
      PERMISSIONS.SUPPLIER_PAYMENT_MANAGE,
      PERMISSIONS.RETURNS_READ,
      PERMISSIONS.WARRANTIES_READ,
      PERMISSIONS.PROGRESSIVE_PURCHASES_READ,
      PERMISSIONS.PROGRESSIVE_PURCHASES_REFUND,
      PERMISSIONS.DELIVERIES_READ,
      PERMISSIONS.EXPENSES_READ,
      PERMISSIONS.EXPENSES_CREATE,
      PERMISSIONS.EXPENSES_APPROVE,
      PERMISSIONS.FILES_READ,
      PERMISSIONS.FILES_UPLOAD,
    ],
  },
};

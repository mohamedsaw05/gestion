export interface AppModule {
  key: string;
  name: string;
  category: 'VENTES' | 'GESTION' | 'LOGISTIQUE' | 'COLLABORATION' | 'COMMERCIAL';
  description: string;
  icon: string;
  path: string;
  isCore?: boolean; // Core modules cannot be disabled (e.g. Dashboard, Settings)
}

export const ALL_APP_MODULES: AppModule[] = [
  {
    key: 'dashboard',
    name: 'Tableau de bord',
    category: 'VENTES',
    description: 'Indicateurs clés, ventes du jour, alertes de rupture et graphiques de performance',
    icon: '📊',
    path: '/',
    isCore: true,
  },
  {
    key: 'sales',
    name: 'Ventes & Caisse POS',
    category: 'VENTES',
    description: 'Interface de caisse rapide, paniers, remises, encaissement multi-devises et tickets thermiques',
    icon: '🛒',
    path: '/sales',
    isCore: true,
  },
  {
    key: 'catalog',
    name: 'Catalogue Produits',
    category: 'GESTION',
    description: 'Gestion des articles, codes-barres, catégories, prix d’achat et prix de vente',
    icon: '🏷️',
    path: '/catalog',
    isCore: true,
  },
  {
    key: 'inventory',
    name: 'Stock & Entrepôt',
    category: 'GESTION',
    description: 'Suivi des stocks en direct, seuils de réapprovisionnement (ROP), inventaires et transferts',
    icon: '📦',
    path: '/inventory',
  },
  {
    key: 'orders',
    name: 'Commandes & Devis',
    category: 'COMMERCIAL',
    description: 'Gestion des bons de commande clients, devis proforma et suivi des statuts',
    icon: '📋',
    path: '/orders',
  },
  {
    key: 'deliveries',
    name: 'Livraisons & Expéditions',
    category: 'LOGISTIQUE',
    description: 'Attribution des chauffeurs, tournées, bordereaux de livraison et suivi des colis',
    icon: '🚚',
    path: '/deliveries',
  },
  {
    key: 'invoices',
    name: 'Factures & Reçus',
    category: 'VENTES',
    description: '3 modèles de factures A4/A5 et 3 modèles de reçus thermiques 80mm/58mm continus',
    icon: '🧾',
    path: '/documents',
  },
  {
    key: 'discharges',
    name: 'Décharges & Attestations SAV',
    category: 'GESTION',
    description: '5 modèles uniques de décharges avec texte modifiable en direct et impression A4',
    icon: '🛡️',
    path: '/discharges',
  },
  {
    key: 'customers',
    name: 'Clients & Fidélité',
    category: 'COMMERCIAL',
    description: 'Fichier clients, historique d’achats, encours de crédit et programmes de fidélité',
    icon: '👥',
    path: '/customers',
  },
  {
    key: 'suppliers',
    name: 'Fournisseurs & Réassort',
    category: 'GESTION',
    description: 'Fiches grossistes, gestion spacieuse des articles approvisionnés et bons d’achat',
    icon: '🏭',
    path: '/suppliers',
  },
  {
    key: 'market',
    name: 'Marché B2B Grossistes',
    category: 'COMMERCIAL',
    description: 'Centrale d’achat réservée aux abonnés : catalogues de gros, prix dégressifs et contact direct',
    icon: '🏛️',
    path: '/market',
  },
  {
    key: 'promotions',
    name: 'Promotions & Rabais',
    category: 'COMMERCIAL',
    description: 'Campagnes promotionnelles automatiques, remises en pourcentage ou montant fixe appliquées à la caisse',
    icon: '🎁',
    path: '/pricing',
  },
  {
    key: 'partners',
    name: 'Partenaires & Affiliés',
    category: 'COMMERCIAL',
    description: 'Réseau d’apporteurs d’affaires, commissions d’affiliation et suivi des prescripteurs',
    icon: '🤝',
    path: '/partners',
  },
  {
    key: 'services',
    name: 'Services & Prestations SAV',
    category: 'GESTION',
    description: 'Ordres de réparation technique, main-d’œuvre, diagnostics et suivi d’atelier',
    icon: '🔧',
    path: '/services',
  },
  {
    key: 'appointments',
    name: 'Rendez-vous & Agenda',
    category: 'COLLABORATION',
    description: 'Planning des rendez-vous clients, réservations de créneaux et rappels',
    icon: '📅',
    path: '/appointments',
  },
  {
    key: 'staff_attendance',
    name: 'Pointage & Présences RH',
    category: 'COLLABORATION',
    description: 'Pointage d’arrivée/départ individuel strict, heures travaillées et suivi des retards',
    icon: '⏱️',
    path: '/staff-attendance',
  },
  {
    key: 'expenses',
    name: 'Dépenses & Trésorerie',
    category: 'GESTION',
    description: 'Enregistrement des charges d’exploitation, loyers, salaires et sorties de caisse',
    icon: '💸',
    path: '/expenses',
  },
  {
    key: 'reports',
    name: 'Rapports, Bilan & Clôtures',
    category: 'GESTION',
    description: 'Rapports X/Z de caisse, marges brutes, chiffres d’affaires et exports comptables',
    icon: '📈',
    path: '/reports',
  },
  {
    key: 'multistore',
    name: 'Multi-Store & Boutiques',
    category: 'GESTION',
    description: 'Configuration dédiée de chaque point de vente physique, devises et imprimantes locales',
    icon: '🏪',
    path: '/settings/config?tab=multistore',
  },
  {
    key: 'settings',
    name: 'Paramètres & Configuration',
    category: 'GESTION',
    description: 'Logo, nom légal, multi-rôles, sauvegardes et gestion des modules activés',
    icon: '⚙️',
    path: '/settings/config',
    isCore: true,
  },
];

const STORAGE_KEY = 'vtm_enabled_modules';

export function getEnabledModules(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Garantir que les modules core sont toujours activés
        const coreKeys = ALL_APP_MODULES.filter((m) => m.isCore).map((m) => m.key);
        return Array.from(new Set([...coreKeys, ...parsed]));
      }
    }
  } catch {
    // En cas d'erreur, activer tous les modules par défaut
  }
  return ALL_APP_MODULES.map((m) => m.key);
}

export function setEnabledModules(moduleKeys: string[]): void {
  const coreKeys = ALL_APP_MODULES.filter((m) => m.isCore).map((m) => m.key);
  const finalKeys = Array.from(new Set([...coreKeys, ...moduleKeys]));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalKeys));
    // Émettre un événement personnalisé pour que Layout et les autres composants réagissent sans rechargement
    window.dispatchEvent(new CustomEvent('vtm_modules_changed', { detail: finalKeys }));
  } catch {
    // Ignore
  }
}

export function isModuleEnabled(moduleKey: string): boolean {
  const enabled = getEnabledModules();
  return enabled.includes(moduleKey);
}

import type { MenuItem } from '../context/AuthContext';

export interface DomainConfig {
  key: string;
  label: string;
  icon: string;
  description: string;
  moduleKeys: string[];
}

export const DOMAINS: DomainConfig[] = [
  {
    key: 'sales',
    label: 'Ventes & Caisse',
    icon: '💳',
    description: 'Encaissements, commandes, livraisons et documents commerciaux',
    moduleKeys: [
      'cash',
      'sell',
      'sales',
      'services',
      'appointments',
      'orders',
      'progressive-purchases',
      'deliveries',
      'documents',
      'returns',
      'warranties',
      'reseller-receipts',
      'staff-attendance',
    ],
  },
  {
    key: 'catalog_stock',
    label: 'Catalogue & Stocks',
    icon: '📦',
    description: 'Articles, variantes, niveaux de stock et grilles tarifaires',
    moduleKeys: ['catalog', 'inventory', 'pricing'],
  },
  {
    key: 'procurement',
    label: 'Achats & Fournisseurs',
    icon: '🚚',
    description: 'Approvisionnements, commandes d\'achat et réceptions de stock',
    moduleKeys: ['suppliers'],
  },
  {
    key: 'crm',
    label: 'Clients & Partenaires',
    icon: '👥',
    description: 'Comptes clients, partenaires investisseurs/dépôt et réseaux sociaux',
    moduleKeys: ['customers', 'credit', 'partners', 'social'],
  },
  {
    key: 'analytics',
    label: 'Rapports & Contrôle',
    icon: '📊',
    description: 'Analyses consolidées des ventes, marges, dépenses et journal d\'audit',
    moduleKeys: ['reports', 'stock_valuation', 'expenses', 'audit'],
  },
  {
    key: 'settings',
    label: 'Paramètres & Outils',
    icon: '⚙️',
    description: 'Utilisateurs, permissions, automatisation, diagnostic et assistance',
    moduleKeys: [
      'settings-users',
      'staff-attendance',
      'settings-config',
      'settings-peripherals',
      'settings-business-profile',
      'settings-subscription',
      'automation',
      'diagnostics',
      'help',
    ],
  },
];

export interface DomainWithItems extends DomainConfig {
  items: MenuItem[];
}

export function getVisibleDomains(menu: MenuItem[]): DomainWithItems[] {
  const menuMap = new Map<string, MenuItem>();
  for (const item of menu) {
    menuMap.set(item.key, item);
  }

  const result: DomainWithItems[] = [];

  for (const domain of DOMAINS) {
    const visibleItems: MenuItem[] = [];
    for (const key of domain.moduleKeys) {
      const item = menuMap.get(key);
      if (item && !visibleItems.some((v) => v.key === item.key)) {
        visibleItems.push(item);
      }
    }
    if (visibleItems.length > 0) {
      result.push({
        ...domain,
        items: visibleItems,
      });
    }
  }

  return result;
}

export function findCurrentContext(pathname: string, menu: MenuItem[]) {
  if (pathname === '/' || pathname === '') {
    return {
      domain: null,
      module: { key: 'dashboard', label: 'Tableau de bord', path: '/' },
      breadcrumbs: [{ label: 'Accueil', path: '/' }],
    };
  }

  const visibleDomains = getVisibleDomains(menu);

  for (const domain of visibleDomains) {
    for (const item of domain.items) {
      if (
        pathname === item.path ||
        (item.path !== '/' && pathname.startsWith(item.path + '/'))
      ) {
        return {
          domain,
          module: item,
          breadcrumbs: [
            { label: 'Accueil', path: '/' },
            { label: domain.label, path: domain.items[0]?.path ?? '/' },
            { label: item.label, path: item.path },
          ],
        };
      }
    }
  }

  return {
    domain: null,
    module: null,
    breadcrumbs: [{ label: 'Accueil', path: '/' }],
  };
}

import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CommandPalette } from './CommandPalette';
import { ToastProvider } from './ToastContext';
import { FestiveTheme } from './FestiveTheme';
import { ContextualHelpModal } from './ContextualHelpModal';
import { checkAndAutoPurgeCache } from '../lib/cacheManager';
import { getEnabledModules } from '../lib/modules.config';

export function Layout() {
  const { profile, menu, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Gestion de la langue source officielle (Français 🇫🇷) & compatibilité traduction automatique navigateur
  useEffect(() => {
    document.documentElement.lang = 'fr';
    try {
      localStorage.setItem('vtm_lang', 'fr');
    } catch {
      // Ignore
    }
  }, []);

  const handleShowLangInfo = () => {
    alert(
      "🌐 Traduction Universelle par le Navigateur\n\nLe Gestionnaire Commercial VTM est nativement en français standard avec des balises HTML conformes.\n\nPour l'utiliser en anglais, arabe, espagnol ou toute autre langue, utilisez simplement la fonction de traduction intégrée de votre navigateur (icône Traduire dans la barre d'adresse de Google Chrome / Edge, ou Clic droit > « Traduire cette page »).",
    );
  };

  // Modules activés dynamiquement par l'organisation
  const [enabledModules, setEnabledModulesState] = useState<string[]>(() => getEnabledModules());

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string[]>;
      if (custom.detail) setEnabledModulesState(custom.detail);
      else setEnabledModulesState(getEnabledModules());
    };
    window.addEventListener('vtm_modules_changed', handler);
    return () => window.removeEventListener('vtm_modules_changed', handler);
  }, []);

  // Background auto-purge cache check on boot
  useEffect(() => {
    checkAndAutoPurgeCache();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Keyboard shortcut Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keyboard shortcut F1 for contextual help modal
  useEffect(() => {
    const handleHelpKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' || (e.shiftKey && e.key === '?')) {
        e.preventDefault();
        setIsHelpModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleHelpKeyDown);
    return () => window.removeEventListener('keydown', handleHelpKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Menu unifié complet intégrant tous les modules bilingues (Français 🇫🇷 / Anglais 🇬🇧)
  const menuItems = [
    {
      labelFr: 'Tableau de bord',
      labelEn: 'Dashboard',
      path: '/',
      key: 'dashboard',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      labelFr: 'Ventes & Caisse',
      labelEn: 'Sales & POS',
      path: '/sales',
      key: 'sales',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      ),
    },
    {
      labelFr: 'Catalogue Produits',
      labelEn: 'Product Catalog',
      path: '/catalog',
      key: 'catalog',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="9" y1="7" x2="15" y2="7" />
          <line x1="9" y1="11" x2="13" y2="11" />
        </svg>
      ),
    },
    {
      labelFr: 'Stock & Entrepôt',
      labelEn: 'Stock & Inventory',
      path: '/inventory',
      key: 'stock',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
    },
    {
      labelFr: 'Commandes & Devis',
      labelEn: 'Orders & Quotes',
      path: '/orders',
      key: 'orders',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      ),
    },
    {
      labelFr: 'Livraisons & Colis',
      labelEn: 'Deliveries',
      path: '/deliveries',
      key: 'deliveries',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      labelFr: 'Factures & Reçus',
      labelEn: 'Invoices & Receipts',
      path: '/documents',
      key: 'invoices',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="14" y2="17" />
        </svg>
      ),
    },
    {
      labelFr: 'Décharges Clients SAV',
      labelEn: 'Discharges & Warranty',
      path: '/discharges',
      key: 'discharges',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      labelFr: 'Fichier Clients',
      labelEn: 'Customers',
      path: '/customers',
      key: 'customers',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      labelFr: 'Fournisseurs',
      labelEn: 'Suppliers',
      path: '/suppliers',
      key: 'suppliers',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <circle cx="7" cy="15" r="1.5" />
          <line x1="12" y1="15" x2="17" y2="15" />
        </svg>
      ),
    },
    {
      labelFr: 'Marché B2B Grossistes',
      labelEn: 'B2B Wholesale Market',
      path: '/market',
      key: 'market',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      labelFr: 'Promotions & Rabais',
      labelEn: 'Promotions & Pricing',
      path: '/pricing',
      key: 'promotions',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      ),
    },
    {
      labelFr: 'Partenaires & Affiliés',
      labelEn: 'Partners',
      path: '/partners',
      key: 'partners',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      labelFr: 'Services & Atelier',
      labelEn: 'Services & Repairs',
      path: '/services',
      key: 'services',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      labelFr: 'Rendez-vous',
      labelEn: 'Appointments',
      path: '/appointments',
      key: 'appointments',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      labelFr: 'Pointage & Présences RH',
      labelEn: 'Staff & Attendance',
      path: '/staff-attendance',
      key: 'staff_attendance',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      labelFr: 'Dépenses & Frais',
      labelEn: 'Expenses',
      path: '/expenses',
      key: 'expenses',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v12" />
          <path d="M15 9.5a2.5 2.5 0 0 0-5 0c0 3 5 2 5 5a2.5 2.5 0 0 1-5 0" />
        </svg>
      ),
    },
    {
      labelFr: 'Rapports & Audit',
      labelEn: 'Reports & Audit',
      path: '/reports',
      key: 'reports',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      labelFr: 'Équipe & Multi-Rôles',
      labelEn: 'Team & Roles',
      path: '/settings/users',
      key: 'team',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      labelFr: 'Multi-Store & Boutiques',
      labelEn: 'Multi-Store',
      path: '/settings/config?tab=multistore',
      key: 'multistore',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      labelFr: 'Paramètres & Réglages',
      labelEn: 'Settings & Setup',
      path: '/settings/config',
      key: 'settings',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  // FILTRAGE DYNAMIQUE DU MENU : Le menu n'affiche QUE les modules activés par l'organisation
  const visibleMenuItems = menuItems.filter((item) => {
    if (item.key === 'dashboard' || item.key === 'settings' || item.key === 'team') return true;
    return enabledModules.includes(item.key) || enabledModules.includes(item.key.replace('_', ''));
  });

  return (
    <ToastProvider>
      <FestiveTheme />

      <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Mobile backdrop */}
        {isMobileMenuOpen && (
          <div
            className="mobile-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            1. BARRE LATÉRALE DE NAVIGATION (Sidebar modèle unique et épuré)
           ═══════════════════════════════════════════════════════════════════════ */}
        <aside
          className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}
          style={{
            width: isSidebarCollapsed ? '72px' : '230px',
            background: '#0a1128',
            color: '#94a3b8',
            borderRight: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
            transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 30,
          }}
        >
          {/* En-tête : Logo de l'entreprise */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
              padding: '1.25rem 1.15rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <NavLink
              to="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textDecoration: 'none',
              }}
              title={profile?.organizationName || "Informations de l'entreprise à compléter"}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: profile?.logoUrl ? '#ffffff' : 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 10px rgba(37,99,235,0.4)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  padding: profile?.logoUrl ? '2px' : 0,
                }}
              >
                {profile?.logoUrl ? (
                  <img
                    src={profile.logoUrl}
                    alt={profile.organizationName || 'Logo'}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem' }}>
                    {(profile?.organizationName || '…').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              {!isSidebarCollapsed && (
                <span
                  style={{
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '1rem',
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '175px',
                  }}
                  title={profile?.organizationName || "Informations de l'entreprise à compléter"}
                >
                  {profile?.organizationName || "Informations de l'entreprise à compléter"}
                </span>
              )}
            </NavLink>

            {!isSidebarCollapsed && (
              <button
                type="button"
                className="desktop-only"
                onClick={() => setIsSidebarCollapsed(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Réduire le menu"
              >
                ←
              </button>
            )}
          </div>

          {/* Bouton pour réagrandir si réduit */}
          {isSidebarCollapsed && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: '#cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                }}
                title="Agrandir le menu"
              >
                →
              </button>
            </div>
          )}

          {/* Menu Vertical Unique (Style épuré, zéro duplication, zéro double modèle) */}
          <nav
            style={{
              padding: '0.85rem 0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              flex: 1,
            }}
          >
            {visibleMenuItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                title={isSidebarCollapsed ? item.labelFr : undefined}
                className={({ isActive }) => `vtm-nav-btn ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '0.85rem',
                  padding: isSidebarCollapsed ? '0.7rem 0' : '0.62rem 0.85rem',
                  borderRadius: '10px',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  fontWeight: isActive ? 600 : 450,
                  fontSize: '0.92rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  border: 'none',
                  outline: 'none',
                })}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'currentColor',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                {!isSidebarCollapsed && (
                  <span style={{ letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                    {item.labelFr}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Pied de la barre latérale : Utilisateur & Déconnexion */}
          <div
            style={{
              padding: '0.85rem 0.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                gap: '0.65rem',
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'A'}
              </div>
              {!isSidebarCollapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ color: '#ffffff', fontSize: '0.84rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {profile?.fullName || 'Super Admin'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {profile?.email || 'admin@vtm.com'}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                borderRadius: '8px',
                padding: '0.45rem',
                fontSize: '0.78rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Se déconnecter"
            >
              {isSidebarCollapsed ? '⏻' : 'Déconnexion'}
            </button>
          </div>
        </aside>

        {/* ═══════════════════════════════════════════════════════════════════════
            2. CONTENU ET BARRE SUPÉRIEURE (Header blanc conforme à l'image)
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="app-main-wrapper" style={{ flex: 1, minWidth: 0, background: '#f4f6fa' }}>
          <header
            style={{
              background: '#ffffff',
              borderBottom: '1px solid #edf2f7',
              padding: '0.75rem 2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
              position: 'sticky',
              top: 0,
              zIndex: 20,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            }}
          >
            {/* Gauche : Bouton menu mobile + Sélecteur de Boutique */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="topbar-menu-btn mobile-only"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Ouvrir le menu de navigation"
                style={{
                  background: 'transparent',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.35rem 0.6rem',
                  cursor: 'pointer',
                }}
              >
                ☰
              </button>

              {/* Identité réelle de l'organisation; le sélecteur de boutique est réservé aux pages qui appliquent réellement ce filtre. */}
              <div
                aria-label="Organisation active"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.45rem 0.95rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    maxWidth: 'min(36vw, 260px)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {profile?.organizationName?.trim() || 'Espace de gestion'}
                </span>
              </div>
            </div>

            {/* Centre : Barre de recherche arrondie (Suchen... / Rechercher...) */}
            <div style={{ flex: 1, maxWidth: '480px' }}>
              <div
                onClick={() => setIsCommandPaletteOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '9999px',
                  padding: '0.45rem 1.15rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span style={{ color: '#94a3b8', fontSize: '0.88rem', flex: 1 }}>
                  Rechercher...
                </span>
                <kbd
                  style={{
                    fontSize: '0.7rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    color: '#94a3b8',
                  }}
                >
                  Ctrl+K
                </kbd>
              </div>
            </div>

            {/* Droite : Sélecteur Langue + Accès Modules + Profil Admin */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              {/* Indicateur de langue source officielle & traducteur navigateur */}
              <button
                type="button"
                onClick={handleShowLangInfo}
                title="Langue officielle : Français (🇫🇷). Cliquez pour afficher l'aide sur la traduction universelle automatique par votre navigateur."
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '9999px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🇫🇷</span>
                <span>FR</span>
              </button>

              {/* Raccourci vers les Modules activés */}
              <NavLink
                to="/settings/config?tab=modules"
                title="Gérer les modules activés par votre organisation"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '9999px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#1d4ed8',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>🧩</span>
                <span>{enabledModules.length} Modules</span>
              </NavLink>

              {/* Bouton d'aide contextuelle dynamique */}
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(true)}
                title="Aide et guide pas-à-pas sur cette page (Raccourci F1)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '9999px',
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#92400e',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>💡</span>
                <span>Aide sur cette page</span>
                <kbd style={{ fontSize: '0.68rem', background: '#fff', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 4px', color: '#b45309' }}>F1</kbd>
              </button>

              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  whiteSpace: 'nowrap',
                }}
              >
                {profile?.fullName || 'Utilisateur'} {profile?.organizationName ? `• ${profile.organizationName}` : ''}
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  flexShrink: 0,
                  background: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                }}
              >
                {/* Image avatar réaliste ou initiales */}
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="Admin Avatar"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>
          </header>

          {/* 3. Contenu Principal de la Page */}
          <main style={{ padding: 0 }}>
            <Outlet />
          </main>
        </div>

        {/* Global Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          menu={menu}
        />

        {/* Dynamic Contextual In-App Help Modal */}
        <ContextualHelpModal
          isOpen={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
        />

        {/* Global Developer & Debug Mode Ribbon */}
      </div>
    </ToastProvider>
  );
}

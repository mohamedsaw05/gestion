import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ToastContext';

const SCOPE_TYPES = ['ALL_LOCATIONS', 'LOCATIONS', 'OWN_RECORDS', 'TEAM'] as const;
type ScopeType = (typeof SCOPE_TYPES)[number];

const SCOPE_LABELS: Record<ScopeType, string> = {
  ALL_LOCATIONS: 'Toutes les boutiques',
  LOCATIONS: 'Boutiques spécifiques',
  OWN_RECORDS: 'Ses propres opérations',
  TEAM: 'Son équipe directe',
};

interface UserRoleRow {
  userRoleId: string;
  roleId: string;
  roleName: string;
  scopeType: ScopeType;
  scopeLocationIds: string[];
}

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  status: 'ACTIVE' | 'DISABLED';
  roles: UserRoleRow[];
}

interface RoleRow {
  id: string;
  key: string;
  name: string;
  isTemplate: boolean;
  permissions: string[];
}

interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

interface Location {
  id: string;
  name: string;
}

// Profils de prestige pour les 4 rôles fondamentaux
interface CoreRoleArchetype {
  key: string;
  name: string;
  icon: string;
  badge: string;
  tagline: string;
  gradient: string;
  accentColor: string;
  responsibilities: string[];
  securityLevel: string;
}

const CORE_ROLES: CoreRoleArchetype[] = [
  {
    key: 'admin',
    name: 'Super Administrateur',
    icon: '👑',
    badge: 'Contrôle Total (Niveau 1)',
    tagline: 'Direction générale, finances, configuration système et audit global',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    accentColor: '#818cf8',
    responsibilities: [
      'Accès illimité à toutes les boutiques et caisses',
      'Clôture comptable, marges et résultats financiers',
      'Activation/Désactivation des modules et licences',
      'Gestion des utilisateurs et des permissions',
    ],
    securityLevel: 'Accès Intégral',
  },
  {
    key: 'manager',
    name: 'Gérant de Magasin',
    icon: '👔',
    badge: 'Pilotage Opérationnel (Niveau 2)',
    tagline: 'Gestion des approvisionnements, validation des remises et supervision des équipes',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
    accentColor: '#34d399',
    responsibilities: [
      'Validation des commandes fournisseurs et réceptions',
      'Autorisation des remises exceptionnelles et crédits clients',
      'Suivi des inventaires, ajustements de stocks et ROP',
      'Supervision des caissiers et clôture de journée',
    ],
    securityLevel: 'Périmètre Établissement',
  },
  {
    key: 'cashier',
    name: 'Caissier & Vendeur Comptoir',
    icon: '⚡',
    badge: 'Encaissement Rapide (Niveau 3)',
    tagline: 'Vente au comptoir, tickets thermiques, encaissements et fidélité client',
    gradient: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)',
    accentColor: '#fbbf24',
    responsibilities: [
      'Création des paniers de vente et encaissement multi-moyens',
      'Édition directe des tickets de caisse 80mm/58mm thermiques',
      'Consultation des stocks disponibles en rayon',
      'Sans accès aux marges brutes ni suppression de factures',
    ],
    securityLevel: 'Caisse & Comptoir',
  },
  {
    key: 'stock',
    name: 'Magasinier & Gestionnaire Logistique',
    icon: '📦',
    badge: 'Logistique & Stocks (Niveau 4)',
    tagline: 'Entrepôt, réceptions de marchandises, bons de livraison et décharges',
    gradient: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
    accentColor: '#94a3b8',
    responsibilities: [
      'Pointage des arrivages fournisseurs et saisie des entrées',
      'Préparation des colis et édition des bons de livraison',
      'Gestion et signature des décharges de responsabilité',
      'Sans accès aux données de vente ni à la trésorerie',
    ],
    securityLevel: 'Entrepôt & Stocks',
  },
];

export function SettingsUsersPage() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<'users' | 'roles' | 'matrix'>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionDef[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Users state
  const [showUserForm, setShowUserForm] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState('');
  const [scopeType, setScopeType] = useState<ScopeType>('ALL_LOCATIONS');
  const [scopeLocationIds, setScopeLocationIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Roles state
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [roleName, setRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [matrixFilterGroup, setMatrixFilterGroup] = useState<string>('ALL');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<UserRow[]>('/users'),
      api.get<RoleRow[]>('/roles'),
      api.get<PermissionDef[]>('/roles/permissions-catalog').catch(() => []),
      api.get<Location[]>('/locations').catch(() => []),
    ])
      .then(([u, r, p, l]) => {
        setUsers(u);
        setRoles(r);
        setPermissionsCatalog(p);
        setLocations(l);
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des données', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;
    try {
      const created = await api.post<UserRow & { temporaryPassword?: string }>('/users', {
        email: email.trim(),
        fullName: fullName.trim(),
        password: password || undefined,
      });
      setEmail('');
      setFullName('');
      setPassword('');
      setShowUserForm(false);
      addToast(
        created.temporaryPassword
          ? `Collaborateur invité ! Mot de passe temporaire : ${created.temporaryPassword}`
          : 'Compte collaborateur créé avec succès.',
        'success',
      );
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la création du compte', 'error');
    }
  };

  const toggleUserStatus = async (u: UserRow) => {
    try {
      await api.post(`/users/${u.id}/${u.status === 'ACTIVE' ? 'disable' : 'enable'}`);
      addToast(`Le compte de ${u.fullName} est désormais ${u.status === 'ACTIVE' ? 'suspendu' : 'actif'}.`, 'success');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors du changement de statut', 'error');
    }
  };

  const startAssign = (u: UserRow) => {
    setAssigningUserId(u.id);
    setRoleId(roles[0]?.id ?? '');
    setScopeType('ALL_LOCATIONS');
    setScopeLocationIds([]);
  };

  const handleAssignRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!assigningUserId || !roleId) return;
    try {
      await api.post(`/users/${assigningUserId}/roles`, { roleId, scopeType, scopeLocationIds });
      addToast('Rôle attribué avec succès au collaborateur.', 'success');
      setAssigningUserId(null);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'attribution du rôle", 'error');
    }
  };

  const handleRemoveRole = async (userId: string, userRoleId: string) => {
    try {
      await api.delete(`/users/${userId}/roles/${userRoleId}`);
      addToast('Rôle retiré.', 'info');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors du retrait du rôle', 'error');
    }
  };

  const groups = useMemo(() => {
    return Array.from(new Set(permissionsCatalog.map((p) => p.group)));
  }, [permissionsCatalog]);

  const startCreateRole = () => {
    setEditingRole({ id: '', key: '', name: '', isTemplate: false, permissions: [] });
    setRoleName('');
    setSelectedPermissions(new Set());
  };

  const startEditRole = (r: RoleRow) => {
    setEditingRole(r);
    setRoleName(r.name);
    setSelectedPermissions(new Set(r.permissions));
  };

  const handleSaveRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingRole || !roleName.trim()) return;
    try {
      const permissions = Array.from(selectedPermissions);
      if (editingRole.id) {
        await api.put(`/roles/${editingRole.id}`, { name: roleName.trim(), permissions });
        addToast(`Rôle « ${roleName.trim()} » mis à jour.`, 'success');
      } else {
        await api.post('/roles', { name: roleName.trim(), permissions });
        addToast(`Nouveau rôle « ${roleName.trim()} » créé.`, 'success');
      }
      setEditingRole(null);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement du rôle", 'error');
    }
  };

  const handleCloneRole = async (r: RoleRow) => {
    try {
      await api.post(`/roles/${r.id}/clone`, { name: `${r.name} (copie)` });
      addToast(`Rôle « ${r.name} » dupliqué avec succès.`, 'success');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors du clonage du rôle', 'error');
    }
  };

  const confirmDeleteRole = async () => {
    if (!deleteRoleId) return;
    try {
      await api.delete(`/roles/${deleteRoleId}`);
      addToast('Rôle supprimé.', 'success');
      setDeleteRoleId(null);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la suppression du rôle', 'error');
    }
  };

  const filteredUsers = useMemo(() => {
    let list = users;
    if (statusFilter !== 'ALL') {
      list = list.filter((u) => u.status === statusFilter);
    }
    const q = userSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.roles.some((r) => r.roleName.toLowerCase().includes(q)),
    );
  }, [users, userSearch, statusFilter]);

  // Statistiques
  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const assignedCount = users.filter((u) => u.roles.length > 0).length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Gouvernance, Équipe & Multi-Rôles"
        subtitle="Architecture de sécurité d'entreprise : gestion des collaborateurs, périmètres par boutique et matrice des permissions"
        badges={[
          { label: `👥 ${users.length} collaborateurs (${activeCount} actifs)`, variant: 'info' },
          { label: `🛡️ ${assignedCount}/${users.length} affectés (${roles.length} profils)`, variant: 'success' },
          { label: `🏪 ${locations.length} boutique${locations.length > 1 ? 's' : ''}`, variant: 'warning' },
        ]}
        primaryAction={{
          label:
            tab === 'users'
              ? showUserForm
                ? '✕ Fermer le formulaire'
                : '+ Nouveau Collaborateur'
              : editingRole
              ? '✕ Fermer l’éditeur'
              : '+ Nouveau Profil de Rôle',
          onClick: () => {
            if (tab === 'users') setShowUserForm((p) => !p);
            else if (editingRole) setEditingRole(null);
            else startCreateRole();
          },
          variant: (tab === 'users' && showUserForm) || (tab === 'roles' && editingRole) ? 'secondary' : 'primary',
        }}
      />

      {/* 4 GRANDES CARTES DE PRESTIGE POUR LES RÔLES PILIERS */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
              Architecture des 4 Rôles Piliers
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Structure hiérarchique recommandée pour séparer les pouvoirs et sécuriser les encaissements de l'entreprise
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {CORE_ROLES.map((role) => {
            // Nombre d'utilisateurs qui ont ce rôle
            const assignedUsers = users.filter((u) =>
              u.roles.some((r) => r.roleName.toLowerCase().includes(role.name.toLowerCase().split(' ')[0])),
            );

            return (
              <div
                key={role.key}
                style={{
                  background: 'var(--surface)',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Header dégradé du rôle */}
                <div
                  style={{
                    background: role.gradient,
                    padding: '1.25rem',
                    color: '#ffffff',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '2rem' }}>{role.icon}</span>
                    <span
                      style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(4px)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      {role.securityLevel}
                    </span>
                  </div>
                  <h4 style={{ margin: '0.75rem 0 0.15rem', fontSize: '1.1rem', fontWeight: 800 }}>
                    {role.name}
                  </h4>
                  <div style={{ fontSize: '0.74rem', opacity: 0.85, fontWeight: 500 }}>
                    {role.badge}
                  </div>
                </div>

                {/* Corps de la carte */}
                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.45, margin: '0 0 1rem' }}>
                    {role.tagline}
                  </p>

                  <div style={{ marginBottom: '1.25rem', flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.45rem', letterSpacing: '0.5px' }}>
                      Attributions Clés :
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.77rem', color: '#334155', lineHeight: 1.55 }}>
                      {role.responsibilities.map((resp, i) => (
                        <li key={i}>{resp}</li>
                      ))}
                    </ul>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      <strong>{assignedUsers.length}</strong> membre{assignedUsers.length > 1 ? 's' : ''} actif{assignedUsers.length > 1 ? 's' : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab('roles')}
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', fontWeight: 600 }}
                    >
                      Voir permissions →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Onglets de navigation principaux */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setTab('users')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: tab === 'users' ? '3px solid #2563eb' : '3px solid transparent',
            color: tab === 'users' ? '#2563eb' : '#64748b',
            fontWeight: 800,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>👥</span> Équipe & Collaborateurs ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('roles')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: tab === 'roles' ? '3px solid #2563eb' : '3px solid transparent',
            color: tab === 'roles' ? '#2563eb' : '#64748b',
            fontWeight: 800,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🛡️</span> Rôles Personnalisés ({roles.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('matrix')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: tab === 'matrix' ? '3px solid #2563eb' : '3px solid transparent',
            color: tab === 'matrix' ? '#2563eb' : '#64748b',
            fontWeight: 800,
            fontSize: '0.94rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>📊</span> Matrice Globale des Droits
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Chargement de l'organigramme et des droits d'accès...
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET 1 : ÉQUIPE & COLLABORATEURS
         ══════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'users' && (
        <div>
          {/* Formulaire création utilisateur moderne */}
          {showUserForm && (
            <div
              style={{
                background: '#ffffff',
                border: '2px solid #2563eb',
                borderRadius: '14px',
                padding: '1.75rem',
                marginBottom: '2rem',
                boxShadow: '0 10px 25px -5px rgba(37,99,235,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '1.5rem' }}>👤</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                    Créer un Nouveau Compte Collaborateur
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    L'utilisateur recevra ses identifiants pour se connecter à son espace caisse ou gestionnaire
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateUser}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Seydou Ouédraogo"
                      required
                      style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                      Adresse Email professionnelle *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seydou@votre-boutique.com"
                      required
                      style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                      Mot de passe initial (optionnel)
                    </label>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Généré automatiquement si vide"
                      style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowUserForm(false)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                    Annuler
                  </button>
                  <button type="submit" className="primary" style={{ padding: '0.6rem 1.4rem', fontWeight: 700 }}>
                    Créer le compte collaborateur
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Formulaire modal attribution de rôle */}
          {assigningUserId && (
            <div
              style={{
                background: '#f8fafc',
                border: '2px solid #2563eb',
                borderRadius: '14px',
                padding: '1.75rem',
                marginBottom: '2rem',
                boxShadow: '0 10px 25px -5px rgba(37,99,235,0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🛡️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                    Confier un rôle à {users.find((u) => u.id === assigningUserId)?.fullName}
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Sélectionnez le rôle métier ainsi que le périmètre des boutiques autorisées
                  </p>
                </div>
              </div>

              <form onSubmit={handleAssignRole}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                      Rôle métier à affecter *
                    </label>
                    <select
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.isTemplate ? '(Standard)' : '(Personnalisé)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                      Périmètre géographique (Scope) *
                    </label>
                    <select
                      value={scopeType}
                      onChange={(e) => setScopeType(e.target.value as ScopeType)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                    >
                      {SCOPE_TYPES.map((s) => (
                        <option key={s} value={s}>
                          {SCOPE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {scopeType === 'LOCATIONS' && (
                  <div style={{ marginBottom: '1.25rem', background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>
                      Cochez les boutiques autorisées pour ce rôle :
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {locations.map((loc) => {
                        const checked = scopeLocationIds.includes(loc.id);
                        return (
                          <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) setScopeLocationIds((prev) => [...prev, loc.id]);
                                else setScopeLocationIds((prev) => prev.filter((id) => id !== loc.id));
                              }}
                            />
                            <span>{loc.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setAssigningUserId(null)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                    Annuler
                  </button>
                  <button type="submit" className="primary" style={{ padding: '0.6rem 1.4rem', fontWeight: 700 }}>
                    Valider l'attribution
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filtres et recherche */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
              <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>🔍</span>
              <input
                type="text"
                placeholder="Rechercher par nom, email ou rôle..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Filtrer par statut :</span>
              {(['ALL', 'ACTIVE', 'DISABLED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: statusFilter === st ? '#2563eb' : '#cbd5e1',
                    background: statusFilter === st ? '#eff6ff' : '#ffffff',
                    color: statusFilter === st ? '#2563eb' : '#475569',
                    fontWeight: statusFilter === st ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {st === 'ALL' ? 'Tous' : st === 'ACTIVE' ? 'Actifs' : 'Suspendus'}
                </button>
              ))}
            </div>
          </div>

          {/* Grille aérée des collaborateurs */}
          {filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
              <span style={{ fontSize: '2.5rem' }}>👥</span>
              <h4 style={{ margin: '0.75rem 0 0.25rem', color: '#0f172a' }}>Aucun collaborateur trouvé</h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                Ajustez votre recherche ou invitez un nouveau collaborateur avec le bouton en haut à droite.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {filteredUsers.map((u) => {
                const isActive = u.status === 'ACTIVE';
                const initials = u.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={u.id}
                    style={{
                      background: 'var(--surface)',
                      borderRadius: '12px',
                      border: isActive ? '1px solid var(--border)' : '1px solid #fecaca',
                      padding: '1.25rem',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: isActive ? 1 : 0.75,
                    }}
                  >
                    <div>
                      {/* En-tête collaborateur */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              background: isActive ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : '#94a3b8',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '1rem',
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>
                              {u.fullName}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            background: isActive ? '#dcfce7' : '#fee2e2',
                            color: isActive ? '#15803d' : '#b91c1c',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#16a34a' : '#dc2626' }} />
                          {isActive ? 'Actif' : 'Suspendu'}
                        </span>
                      </div>

                      {/* Rôles attribués */}
                      <div style={{ marginBottom: '1rem', minHeight: '52px' }}>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
                          Rôles & Périmètre d'Accès :
                        </div>
                        {u.roles.length === 0 ? (
                          <div style={{ fontSize: '0.8rem', color: '#eab308', background: '#fef9c3', padding: '0.4rem 0.65rem', borderRadius: '6px', display: 'inline-block' }}>
                            ⚠️ Aucun rôle attribué (Accès restreint)
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {u.roles.map((r) => (
                              <div
                                key={r.userRoleId}
                                style={{
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.76rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                }}
                              >
                                <span style={{ fontWeight: 700, color: '#1e40af' }}>{r.roleName}</span>
                                <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                  ({SCOPE_LABELS[r.scopeType] ?? r.scopeType})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRole(u.id, r.userRoleId)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '0 2px',
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                  }}
                                  title="Retirer ce rôle"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions sur le collaborateur */}
                    <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
                      <button
                        type="button"
                        onClick={() => startAssign(u)}
                        className="primary"
                        style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.82rem', fontWeight: 700 }}
                      >
                        + Attribuer Rôle
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleUserStatus(u)}
                        className="btn-secondary"
                        style={{
                          padding: '0.45rem 0.75rem',
                          fontSize: '0.82rem',
                          color: isActive ? '#dc2626' : '#16a34a',
                          fontWeight: 600,
                        }}
                      >
                        {isActive ? 'Suspendre' : 'Réactiver'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET 2 : RÔLES & PERMISSIONS
         ══════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'roles' && (
        <div>
          {/* Éditeur de rôle */}
          {editingRole && (
            <div
              style={{
                background: '#ffffff',
                border: '2px solid #2563eb',
                borderRadius: '14px',
                padding: '1.75rem',
                marginBottom: '2rem',
                boxShadow: '0 10px 25px -5px rgba(37,99,235,0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                {editingRole.id ? `Modifier le Profil « ${editingRole.name} »` : 'Créer un Nouveau Profil de Rôle Sur-Mesure'}
              </h3>
              <form onSubmit={handleSaveRole}>
                <div style={{ marginBottom: '1.5rem', maxWidth: '480px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Désignation du rôle *
                  </label>
                  <input
                    type="text"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Ex: Responsable des Achats & Gros"
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0f172a' }}>
                    Permissions incluses dans ce rôle ({selectedPermissions.size} sélectionnées) :
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedPermissions(new Set(permissionsCatalog.map((p) => p.key)))}
                      className="btn-secondary"
                      style={{ fontSize: '0.76rem', padding: '0.3rem 0.6rem' }}
                    >
                      Tout cocher
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPermissions(new Set())}
                      className="btn-secondary"
                      style={{ fontSize: '0.76rem', padding: '0.3rem 0.6rem' }}
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.25rem',
                    background: '#f8fafc',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    marginBottom: '1.5rem',
                  }}
                >
                  {groups.map((group) => {
                    const groupPerms = permissionsCatalog.filter((p) => p.group === group);
                    const allChecked = groupPerms.length > 0 && groupPerms.every((p) => selectedPermissions.has(p.key));
                    return (
                      <div key={group} style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid #e2e8f0',
                            paddingBottom: '0.45rem',
                            marginBottom: '0.65rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              color: '#2563eb',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Module : {group}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPermissions((prev) => {
                                const next = new Set(prev);
                                if (allChecked) {
                                  groupPerms.forEach((p) => next.delete(p.key));
                                } else {
                                  groupPerms.forEach((p) => next.add(p.key));
                                }
                                return next;
                              });
                            }}
                            className="btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', fontWeight: 600 }}
                          >
                            {allChecked ? '✕ Décocher module' : '✓ Tout autoriser'}
                          </button>
                        </div>

                        {groupPerms.map((p) => (
                          <label
                            key={p.key}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.45rem', fontSize: '0.82rem', cursor: 'pointer' }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissions.has(p.key)}
                              onChange={(e) => {
                                setSelectedPermissions((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(p.key);
                                  else next.delete(p.key);
                                  return next;
                                });
                              }}
                              style={{ marginTop: '2px' }}
                            />
                            <span style={{ color: '#334155' }}>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setEditingRole(null)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                    Annuler
                  </button>
                  <button type="submit" className="primary" style={{ padding: '0.6rem 1.4rem', fontWeight: 700 }}>
                    Enregistrer le rôle
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Liste des rôles sous forme de cartes structurées */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {roles.map((r) => (
              <div
                key={r.id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  padding: '1.25rem',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 800 }}>
                        {r.name}
                      </h4>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b' }}>
                        Clé système : {r.key}
                      </div>
                    </div>
                    <span
                      style={{
                        background: r.isTemplate ? '#eff6ff' : '#fef3c7',
                        color: r.isTemplate ? '#1e40af' : '#92400e',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                      }}
                    >
                      {r.isTemplate ? 'Modèle Standard' : 'Personnalisé'}
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      <strong>{r.permissions.length}</strong> permission(s) active(s) sur ce profil
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={() => handleCloneRole(r)}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '0.45rem 0.65rem', fontSize: '0.78rem', fontWeight: 600 }}
                  >
                    📑 Dupliquer
                  </button>
                  {!r.isTemplate && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEditRole(r)}
                        className="primary"
                        style={{ flex: 1, padding: '0.45rem 0.65rem', fontSize: '0.78rem', fontWeight: 700 }}
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteRoleId(r.id)}
                        className="btn-secondary"
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.78rem', color: '#dc2626' }}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET 3 : MATRICE GLOBALE DES DROITS
         ══════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'matrix' && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                Matrice Complète des Permissions par Rôle
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Vision d'ensemble pour auditer les habilitations de chaque rôle métier
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Filtrer le groupe :</span>
              <select
                value={matrixFilterGroup}
                onChange={(e) => setMatrixFilterGroup(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', borderRadius: '6px' }}
              >
                <option value="ALL">Tous les domaines</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Permission & Domaine</th>
                  {roles.map((r) => (
                    <th key={r.id} style={{ textAlign: 'center', minWidth: '130px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{r.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {r.isTemplate ? 'Standard' : 'Custom'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionsCatalog
                  .filter((p) => matrixFilterGroup === 'ALL' || p.group === matrixFilterGroup)
                  .map((perm) => (
                    <tr key={perm.key}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{perm.label}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          [{perm.group}] • <code style={{ fontSize: '0.7rem' }}>{perm.key}</code>
                        </div>
                      </td>
                      {roles.map((r) => {
                        const hasPerm = r.permissions.includes(perm.key);
                        return (
                          <td key={r.id} style={{ textAlign: 'center' }}>
                            {hasPerm ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '24px',
                                  height: '24px',
                                  lineHeight: '24px',
                                  borderRadius: '50%',
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  fontWeight: 800,
                                }}
                              >
                                ✓
                              </span>
                            ) : (
                              <span style={{ color: '#cbd5e1', fontSize: '1rem' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal suppression rôle */}
      <ConfirmModal
        isOpen={Boolean(deleteRoleId)}
        title="Supprimer le profil de rôle"
        message="Êtes-vous certain de vouloir supprimer ce rôle ? Les collaborateurs qui en bénéficiaient perdront immédiatement ces accès."
        confirmLabel="Oui, supprimer définitivement"
        variant="danger"
        onConfirm={confirmDeleteRole}
        onCancel={() => setDeleteRoleId(null)}
      />
    </div>
  );
}

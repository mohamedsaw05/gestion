import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { Pagination } from '../components/Pagination';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface Location {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  fullName?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  basePrice: string;
  costPrice?: string | null;
  isStocked: boolean;
}

interface ServiceOrderItem {
  id: string;
  itemType: 'LABOR' | 'PART' | 'OTHER';
  name: string;
  quantity: string;
  unitCost: string;
  unitPrice: string;
  lineTotal: string;
  stockDeducted: boolean;
  productId: string | null;
}

interface ServiceOrder {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  diagnosisNotes: string | null;
  resolutionNotes: string | null;
  status: 'DRAFT' | 'QUALIFIED' | 'SCHEDULED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'BILLED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  customerId: string | null;
  customer: Customer | null;
  locationId: string;
  location: Location | null;
  assignedUserId: string | null;
  assignedUser: User | null;
  scheduledDate: string | null;
  estimatedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  hourlyLaborRate: string | null;
  laborCost: string;
  partsCost: string;
  otherCost: string;
  totalCost: string;
  quotedPrice: string;
  finalPrice: string;
  grossMargin: string;
  saleId: string | null;
  completedAt: string | null;
  createdAt: string;
  items: ServiceOrderItem[];
}

interface ServiceStats {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  billedOrders: number;
  totalRevenue: number;
  totalMargin: number;
  totalCost: number;
  marginRate: number;
}

const STATUS_LABELS: Record<ServiceOrder['status'], { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'Brouillon', bg: '#f1f5f9', color: '#475569' },
  QUALIFIED: { label: 'Qualifié / Devis', bg: '#e0e7ff', color: '#3730a3' },
  SCHEDULED: { label: 'Planifié', bg: '#e0f2fe', color: '#0369a1' },
  IN_PROGRESS: { label: 'En cours', bg: '#fef3c7', color: '#b45309' },
  ON_HOLD: { label: 'En attente', bg: '#fee2e2', color: '#b91c1c' },
  COMPLETED: { label: 'Terminé', bg: '#dcfce7', color: '#15803d' },
  BILLED: { label: 'Facturé & Payé', bg: '#dbeafe', color: '#1e40af' },
  CANCELLED: { label: 'Annulé', bg: '#f3f4f6', color: '#9ca3af' },
};

const PRIORITY_LABELS: Record<ServiceOrder['priority'], { label: string; color: string }> = {
  LOW: { label: 'Basse', color: '#64748b' },
  NORMAL: { label: 'Normale', color: '#0284c7' },
  HIGH: { label: 'Haute', color: '#ea580c' },
  URGENT: { label: 'Urgente', color: '#dc2626' },
};

export function ServicesPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtres
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal Nouveau Dossier
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCustomerId, setCreateCustomerId] = useState('');
  const [createLocationId, setCreateLocationId] = useState('');
  const [createAssignedUserId, setCreateAssignedUserId] = useState('');
  const [createPriority, setCreatePriority] = useState<ServiceOrder['priority']>('NORMAL');
  const [createScheduledDate, setCreateScheduledDate] = useState('');
  const [createEstimatedMinutes, setCreateEstimatedMinutes] = useState('60');
  const [createQuotedPrice, setCreateQuotedPrice] = useState('0');

  // Modal Ajout Élément (Pièce ou Main-d'œuvre)
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemType, setItemType] = useState<'LABOR' | 'PART' | 'OTHER'>('LABOR');
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemUnitPrice, setItemUnitPrice] = useState('0');
  const [itemUnitCost, setItemUnitCost] = useState('0');
  const [itemProductId, setItemProductId] = useState('');

  // Modal Facturation
  const [billingOrder, setBillingOrder] = useState<ServiceOrder | null>(null);
  const [billingMethod, setBillingMethod] = useState('CASH');
  const [billingAmount, setBillingAmount] = useState('0');

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      if (locationFilter !== 'ALL') queryParams.set('locationId', locationFilter);
      if (search.trim()) queryParams.set('search', search.trim());
      queryParams.set('page', String(page));
      queryParams.set('limit', '20');

      const [ordersRes, statsRes, custRes, locRes, prodRes, usersRes] = await Promise.all([
        api.get<{ data: ServiceOrder[]; total: number; totalPages: number }>(`/services?${queryParams.toString()}`),
        api.get<ServiceStats>('/services/stats').catch(() => null),
        customers.length === 0 ? api.get<Customer[]>('/customers').catch(() => []) : Promise.resolve(customers),
        locations.length === 0 ? api.get<Location[]>('/locations').catch(() => []) : Promise.resolve(locations),
        products.length === 0 ? api.get<Product[]>('/products').catch(() => []) : Promise.resolve(products),
        users.length === 0 ? api.get<User[]>('/users').catch(() => []) : Promise.resolve(users),
      ]);

      setOrders(ordersRes.data);
      setTotalCount(ordersRes.total);
      if (statsRes) setStats(statsRes);
      if (custRes.length > 0) setCustomers(custRes);
      if (locRes.length > 0) {
        setLocations(locRes);
        if (!createLocationId) setCreateLocationId(locRes[0].id);
      }
      if (prodRes.length > 0) setProducts(prodRes);
      if (usersRes.length > 0) setUsers(usersRes);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur de chargement des prestations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, statusFilter, locationFilter]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleCreateOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createLocationId) {
      showToast('Titre et lieu obligatoires', 'error');
      return;
    }
    try {
      await api.post('/services', {
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        locationId: createLocationId,
        customerId: createCustomerId || undefined,
        assignedUserId: createAssignedUserId || undefined,
        priority: createPriority,
        scheduledDate: createScheduledDate ? new Date(createScheduledDate).toISOString() : undefined,
        estimatedDurationMinutes: parseInt(createEstimatedMinutes, 10) || 60,
        quotedPrice: createQuotedPrice || '0',
      });
      showToast('Dossier d’intervention créé avec succès', 'success');
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateQuotedPrice('0');
      loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur de création', 'error');
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: ServiceOrder['status']) => {
    try {
      await api.patch(`/services/${orderId}`, { status: newStatus });
      showToast(`Statut mis à jour : ${STATUS_LABELS[newStatus].label}`, 'success');
      loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur de changement de statut', 'error');
    }
  };

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!expandedId) return;
    if (!itemName.trim() || Number(itemQuantity) <= 0) {
      showToast('Nom et quantité valide requis', 'error');
      return;
    }
    try {
      await api.post(`/services/${expandedId}/items`, {
        itemType,
        name: itemName.trim(),
        quantity: itemQuantity,
        unitPrice: itemUnitPrice || '0',
        unitCost: itemUnitCost || '0',
        productId: itemProductId || undefined,
      });
      showToast('Élément ajouté à l’intervention (stock mis à jour)', 'success');
      setShowItemModal(false);
      setItemName('');
      setItemQuantity('1');
      setItemUnitPrice('0');
      setItemUnitCost('0');
      setItemProductId('');
      loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur d’ajout de l’élément', 'error');
    }
  };

  const handleRemoveItem = async (orderId: string, itemId: string) => {
    if (!confirm('Supprimer cet élément ? Le stock consommé éventuel sera restitué.')) return;
    try {
      await api.delete(`/services/${orderId}/items/${itemId}`);
      showToast('Élément retiré du dossier', 'info');
      loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur de suppression', 'error');
    }
  };

  const handleOpenBilling = (order: ServiceOrder) => {
    setBillingOrder(order);
    setBillingAmount(order.finalPrice);
  };

  const handleConfirmBilling = async (e: FormEvent) => {
    e.preventDefault();
    if (!billingOrder) return;
    try {
      await api.post(`/services/${billingOrder.id}/bill`, {
        paymentMethod: billingMethod,
        amountPaid: billingAmount,
      });
      showToast(`Intervention ${billingOrder.referenceNumber} facturée avec succès !`, 'success');
      setBillingOrder(null);
      loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur lors de la facturation', 'error');
    }
  };

  const onSelectProduct = (productId: string) => {
    setItemProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setItemName(prod.name);
      setItemUnitPrice(prod.basePrice);
      setItemUnitCost(prod.costPrice ?? '0');
    }
  };

  return (
    <div className="page-container" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <PageHeader
        title="Prestations & Services"
        subtitle="Gestion des réparations, interventions d'atelier, consommation de pièces et facturation des services"
        badge={stats ? <span className="badge badge-info">{stats.totalOrders} dossier{stats.totalOrders > 1 ? 's' : ''}</span> : undefined}
        primaryAction={{
          label: '➕ Nouveau dossier d\'intervention',
          onClick: () => setShowCreateModal(true),
        }}
      />

      {/* Cartes statistiques consolidées */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Dossiers Actifs</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {stats.pendingOrders + stats.inProgressOrders}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              {stats.inProgressOrders} en cours d'atelier
            </div>
          </div>

          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Prêts à Facturer</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {stats.completedOrders}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '0.2rem' }}>
              Interventions terminées
            </div>
          </div>

          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Total Facturé</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
              {stats.totalRevenue.toLocaleString('fr-FR')} <span style={{ fontSize: '0.9rem' }}>XOF</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
              {stats.billedOrders} dossier(s) réglé(s)
            </div>
          </div>

          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Marge Brute Services</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
              {stats.totalMargin.toLocaleString('fr-FR')} <span style={{ fontSize: '0.9rem' }}>XOF</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
              Taux moyen : {Math.round(stats.marginRate)}%
            </div>
          </div>
        </div>
      )}

      {/* Barre d'outils et recherche */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Rechercher par référence, titre, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {locations.length > 1 && (
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="ALL">Tous les ateliers / boutiques</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          <button type="submit" className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
            🔍 Filtrer
          </button>
        </form>

        {/* Badges de statuts */}
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {['ALL', 'SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'BILLED'].map((st) => (
            <button
              key={st}
              type="button"
              className={statusFilter === st ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', borderRadius: '4px' }}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
            >
              {st === 'ALL' ? 'Tous les statuts' : STATUS_LABELS[st as ServiceOrder['status']]?.label || st}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau des interventions */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Chargement des dossiers...</div>
        ) : orders.length === 0 ? (
          <EmptyState
            type="no-data"
            title="Aucune prestation trouvée"
            description="Créez votre première intervention de réparation, diagnostic ou maintenance."
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Réf & Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Titre & Client</th>
                <th style={{ padding: '0.75rem 1rem' }}>Priorité</th>
                <th style={{ padding: '0.75rem 1rem' }}>Statut</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Coût Revient</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Prix Final</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Marge</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const isExpanded = expandedId === o.id;
                const statusMeta = STATUS_LABELS[o.status] || { label: o.status, bg: '#f1f5f9', color: '#475569' };
                const priorityMeta = PRIORITY_LABELS[o.priority] || { label: o.priority, color: '#64748b' };
                const grossMarginNum = Number(o.grossMargin);

                return (
                  <Fragment key={o.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isExpanded ? '#f8fafc' : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : o.id)}
                    >
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <code style={{ background: '#e2e8f0', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
                          {o.referenceNumber}
                        </code>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                          {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{o.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                          👤 {o.customer ? `${o.customer.name} (${o.customer.phone || 'Sans tel'})` : 'Client au comptant'}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: priorityMeta.color }}>
                          ● {priorityMeta.label}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            background: statusMeta.bg,
                            color: statusMeta.color,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>
                        {Number(o.totalCost).toLocaleString('fr-FR')} XOF
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {Number(o.finalPrice).toLocaleString('fr-FR')} XOF
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: grossMarginNum >= 0 ? '#16a34a' : '#dc2626' }}>
                        {grossMarginNum.toLocaleString('fr-FR')} XOF
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                          onClick={() => setExpandedId(isExpanded ? null : o.id)}
                        >
                          {isExpanded ? '▲ Fermer' : '⚙️ Gérer'}
                        </button>
                      </td>
                    </tr>

                    {/* Ligne dépliée : Détails, progression et pièces */}
                    {isExpanded && (
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <td colSpan={8} style={{ padding: '1.25rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                            {/* Colonne 1 : Statuts et Infos */}
                            <div>
                              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.92rem', color: '#0f172a' }}>
                                Évolution du dossier & Actions
                              </h4>

                              {/* Stepper de statuts */}
                              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                {o.status !== 'BILLED' && (
                                  <>
                                    {o.status !== 'IN_PROGRESS' && (
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                                        onClick={() => handleStatusChange(o.id, 'IN_PROGRESS')}
                                      >
                                        ▶ Passer en cours
                                      </button>
                                    )}
                                    {o.status !== 'ON_HOLD' && (
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                                        onClick={() => handleStatusChange(o.id, 'ON_HOLD')}
                                      >
                                        ⏸ Mettre en attente
                                      </button>
                                    )}
                                    {o.status !== 'COMPLETED' && (
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                                        onClick={() => handleStatusChange(o.id, 'COMPLETED')}
                                      >
                                        ✓ Marquer terminé
                                      </button>
                                    )}
                                  </>
                                )}
                                {o.status !== 'BILLED' && (
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', background: '#16a34a' }}
                                    onClick={() => handleOpenBilling(o)}
                                  >
                                    💰 Facturer & Encaisser
                                  </button>
                                )}
                                {o.status === 'BILLED' && (
                                  <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 700 }}>
                                    ✓ Dossier facturé (Vente n° {o.saleId?.slice(0, 8)}...)
                                  </span>
                                )}
                              </div>

                              <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                                <div><strong>Description :</strong> {o.description || 'Aucune description fournie.'}</div>
                                {o.diagnosisNotes && (
                                  <div style={{ marginTop: '0.35rem', color: '#b45309' }}>
                                    <strong>Diagnostic initial :</strong> {o.diagnosisNotes}
                                  </div>
                                )}
                                <div style={{ marginTop: '0.35rem', color: '#64748b' }}>
                                  <strong>Atelier / Emplacement :</strong> {o.location?.name ?? 'Non spécifié'}
                                </div>
                              </div>
                            </div>

                            {/* Colonne 2 : Pièces et main-d'œuvre */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#0f172a' }}>
                                  Pièces consommées & Main-d'œuvre
                                </h4>
                                {o.status !== 'BILLED' && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                    onClick={() => setShowItemModal(true)}
                                  >
                                    ➕ Ajouter élément
                                  </button>
                                )}
                              </div>

                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', background: '#fff', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                <thead>
                                  <tr style={{ background: '#f1f5f9', color: '#475569' }}>
                                    <th style={{ padding: '0.4rem 0.6rem' }}>Type</th>
                                    <th style={{ padding: '0.4rem 0.6rem' }}>Libellé</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Qté</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Prix</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Total</th>
                                    {o.status !== 'BILLED' && <th style={{ padding: '0.4rem 0.6rem' }}></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {o.items.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8' }}>
                                        Aucune pièce ni main-d'œuvre ajoutée
                                      </td>
                                    </tr>
                                  ) : (
                                    o.items.map((it) => (
                                      <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.4rem 0.6rem' }}>
                                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: it.itemType === 'PART' ? '#e0f2fe' : '#f3e8ff', color: it.itemType === 'PART' ? '#0369a1' : '#7e22ce' }}>
                                            {it.itemType === 'PART' ? 'Pièce (Stock)' : it.itemType === 'LABOR' ? 'Main-d\'œuvre' : 'Autre'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{it.name}</td>
                                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{Number(it.quantity)}</td>
                                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{Number(it.unitPrice).toLocaleString('fr-FR')}</td>
                                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>
                                          {Number(it.lineTotal).toLocaleString('fr-FR')} XOF
                                        </td>
                                        {o.status !== 'BILLED' && (
                                          <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                                            <button
                                              type="button"
                                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.9rem' }}
                                              onClick={() => handleRemoveItem(o.id, it.id)}
                                              title="Supprimer l'élément"
                                            >
                                              ✕
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>

                              {/* Bilan financier de l'intervention */}
                              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.5rem', background: '#e2e8f0', borderRadius: '4px' }}>
                                <span>Coût total : <strong>{Number(o.totalCost).toLocaleString('fr-FR')} XOF</strong></span>
                                <span>Facturation : <strong>{Number(o.finalPrice).toLocaleString('fr-FR')} XOF</strong></span>
                                <span>Marge réalisée : <strong style={{ color: '#16a34a' }}>{Number(o.grossMargin).toLocaleString('fr-FR')} XOF</strong></span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Pagination currentPage={page} totalItems={totalCount} pageSize={20} onPageChange={setPage} itemName="interventions" />
      </div>

      {/* Modal Création Dossier d'Intervention Ergonomique & Centré */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '640px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <span>🛠️</span>
                Nouveau Dossier d'Intervention & Réparation
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.55rem', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Titre / Objet de la prestation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Remplacement écran OLED iPhone 14 Pro, Révision complète..."
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Client bénéficiaire
                  </label>
                  <select
                    value={createCustomerId}
                    onChange={(e) => setCreateCustomerId(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Client au comptant (non enregistré)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Atelier / Emplacement *
                  </label>
                  <select
                    required
                    value={createLocationId}
                    onChange={(e) => setCreateLocationId(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Technicien responsable
                  </label>
                  <select
                    value={createAssignedUserId}
                    onChange={(e) => setCreateAssignedUserId(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Atelier général (non assigné)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Niveau d'urgence / Priorité
                  </label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value as ServiceOrder['priority'])}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="LOW">Basse — Standard (2 à 5 jours)</option>
                    <option value="NORMAL">Normale — Priorité classique (24-48h)</option>
                    <option value="HIGH">Haute — À traiter sous 24h</option>
                    <option value="URGENT">🚨 Urgente — Express / Client en attente</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Date & Heure de restitution prévue
                  </label>
                  <input
                    type="date"
                    value={createScheduledDate}
                    onChange={(e) => setCreateScheduledDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Durée estimée d'intervention (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={createEstimatedMinutes}
                    onChange={(e) => setCreateEstimatedMinutes(e.target.value)}
                    placeholder="Ex: 60 min"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Devis estimatif communiqué (XOF)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createQuotedPrice}
                    onChange={(e) => setCreateQuotedPrice(e.target.value)}
                    placeholder="Ex: 25000"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Garantie SAV sur la réparation
                  </label>
                  <select
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="30">Garantie 30 jours (Pièces & Main-d'œuvre)</option>
                    <option value="90">Garantie 3 mois (Pièces & Main-d'œuvre)</option>
                    <option value="180">Garantie 6 mois</option>
                    <option value="0">Aucune garantie (Prestation brute)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Symptômes constatés & Diagnostic initial
                </label>
                <textarea
                  rows={2}
                  placeholder="Détails du problème décrit par le client, numéro IMEI ou numéro de série du matériel..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Pied de modal épinglé pour enregistrer immédiatement sans chercher */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.5rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '0.55rem 1.25rem' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="primary"
                  style={{ padding: '0.6rem 1.6rem', fontSize: '0.9rem', fontWeight: 700 }}
                >
                  ✓ Enregistrer le dossier d'intervention
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajout Pièce / Main-d'œuvre */}
      {showItemModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Ajouter un élément à l'intervention</h3>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.5rem', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Type d'élément</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {(['LABOR', 'PART', 'OTHER'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={itemType === t ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, padding: '0.4rem' }}
                      onClick={() => setItemType(t)}
                    >
                      {t === 'LABOR' ? 'Main-d\'œuvre' : t === 'PART' ? 'Pièce (Stock)' : 'Autre'}
                    </button>
                  ))}
                </div>
              </div>

              {itemType === 'PART' && (
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Sélectionner une pièce en stock</label>
                  <select
                    value={itemProductId}
                    onChange={(e) => onSelectProduct(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Sélectionner une référence...</option>
                    {products
                      .filter((p) => p.isStocked)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {Number(p.basePrice).toLocaleString('fr-FR')} XOF
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Libellé / Désignation *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Remplacement nappe, Heure de technicien..."
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Quantité *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Prix facturé unitaire (XOF) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={itemUnitPrice}
                    onChange={(e) => setItemUnitPrice(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Coût unitaire d'achat / revient (XOF)</label>
                <input
                  type="number"
                  min="0"
                  value={itemUnitCost}
                  onChange={(e) => setItemUnitCost(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowItemModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Valider & Déduire du stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Facturation */}
      {billingOrder && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Facturation de l'intervention</h3>
              <button
                type="button"
                onClick={() => setBillingOrder(null)}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.5rem', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
              Dossier <strong>{billingOrder.referenceNumber}</strong> ({billingOrder.title})
            </p>

            <form onSubmit={handleConfirmBilling} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Total prestation facturée :</span>
                  <strong style={{ fontSize: '1.1rem', color: '#16a34a' }}>
                    {Number(billingOrder.finalPrice).toLocaleString('fr-FR')} XOF
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                  <span>Marge brute estimée :</span>
                  <strong>{Number(billingOrder.grossMargin).toLocaleString('fr-FR')} XOF</strong>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Moyen d'encaissement</label>
                <select
                  value={billingMethod}
                  onChange={(e) => setBillingMethod(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                >
                  <option value="CASH">Espèces</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="CARD">Carte Bancaire</option>
                  <option value="TRANSFER">Virement Bancaire</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Montant encaissé (XOF)</label>
                <input
                  type="number"
                  min="0"
                  max={billingOrder.finalPrice}
                  value={billingAmount}
                  onChange={(e) => setBillingAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Si inférieur au montant total, le solde restant sera imputé au crédit du client.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setBillingOrder(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#16a34a' }}>
                  Confirmer l'encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

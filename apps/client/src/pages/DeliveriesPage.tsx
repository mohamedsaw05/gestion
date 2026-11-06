import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/ToastContext';

interface Order {
  id: string;
  status: string;
  subtotal: string;
  currency: string;
  createdAt: string;
}
interface Delivery {
  id: string;
  orderId: string;
  status: 'PENDING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  address: string;
  scheduledDate: string | null;
  failureReason: string | null;
  createdAt: string;
  order: Order | null;
}

const STATUS_LABELS: Record<Delivery['status'], string> = {
  PENDING: 'Planifiée',
  OUT_FOR_DELIVERY: 'En cours de tournée',
  DELIVERED: 'Livrée',
  FAILED: 'Échouée',
  CANCELLED: 'Annulée',
};
const STATUS_BADGE: Record<Delivery['status'], string> = {
  PENDING: 'badge-warning',
  OUT_FOR_DELIVERY: 'badge-info',
  DELIVERED: 'badge-success',
  FAILED: 'badge-danger',
  CANCELLED: 'badge-danger',
};

export function DeliveriesPage() {
  const { addToast } = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [orderId, setOrderId] = useState('');
  const [address, setAddress] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [failReasonById, setFailReasonById] = useState<Record<string, string>>({});
  const [cancelDeliveryId, setCancelDeliveryId] = useState<string | null>(null);

  // Filter & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    api
      .get<Delivery[]>('/deliveries')
      .then(setDeliveries)
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des livraisons', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api
      .get<Order[]>('/orders')
      .then((all) => setOrders(all.filter((o) => o.status !== 'DRAFT' && o.status !== 'CANCELLED')))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderId || !address.trim()) return;
    try {
      await api.post('/deliveries', {
        orderId,
        address: address.trim(),
        scheduledDate: scheduledDate || undefined,
        operationId: crypto.randomUUID(),
      });
      addToast('Livraison planifiée avec succès.', 'success');
      setOrderId('');
      setAddress('');
      setScheduledDate('');
      setShowForm(false);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la planification', 'error');
    }
  };

  const action = async (id: string, path: string, body?: unknown, successMsg?: string) => {
    try {
      await api.post(`/deliveries/${id}/${path}`, body ?? {});
      addToast(successMsg ?? 'Statut de livraison mis à jour.', 'success');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'action", 'error');
    }
  };

  const handleCancelDelivery = async () => {
    if (!cancelDeliveryId) return;
    try {
      await api.post(`/deliveries/${cancelDeliveryId}/cancel`, {});
      addToast('Livraison annulée.', 'success');
      setCancelDeliveryId(null);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'annulation", 'error');
    }
  };

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        d.orderId.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q)
      );
    });
  }, [deliveries, statusFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const paginatedDeliveries = useMemo(() => {
    const start = (page - 1) * 20;
    return filteredDeliveries.slice(start, start + 20);
  }, [filteredDeliveries, page]);

  const stats = useMemo(() => {
    return {
      total: deliveries.length,
      pending: deliveries.filter((d) => d.status === 'PENDING').length,
      out: deliveries.filter((d) => d.status === 'OUT_FOR_DELIVERY').length,
      delivered: deliveries.filter((d) => d.status === 'DELIVERED').length,
    };
  }, [deliveries]);

  return (
    <div>
      <PageHeader
        title="Suivi des Livraisons"
        subtitle="Planification des expéditions de commandes et suivi de l'acheminement"
        badges={[
          { label: `${stats.pending} en attente`, variant: 'warning' },
          { label: `${stats.out} en cours de tournée`, variant: 'info' },
          { label: `${stats.delivered} livrée(s)`, variant: 'success' },
        ]}
        primaryAction={{
          label: showForm ? 'Fermer le formulaire' : '+ Planifier une livraison',
          onClick: () => setShowForm((p) => !p),
          variant: showForm ? 'secondary' : 'primary',
        }}
      />

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{stats.pending}</div>
          <div className="kpi-label">Colis à Préparer</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{stats.out}</div>
          <div className="kpi-label">Actuellement en Tournée</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{stats.delivered}</div>
          <div className="kpi-label">Livraisons Réussies</div>
        </div>
      </div>

      {/* Formulaire collapsible de planification */}
      {showForm && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Planifier une nouvelle expédition</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Commande associée *
                </label>
                <select value={orderId} onChange={(e) => setOrderId(e.target.value)} required style={{ width: '100%' }}>
                  <option value="">Sélectionner une commande...</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.id.slice(0, 8)} — {o.subtotal} {o.currency} ({o.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Adresse complète de livraison *
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Quartier Ouaga 2000, Porte 45"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Date d'expédition planifiée
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Annuler
              </button>
              <button type="submit" className="primary">
                Enregistrer la livraison
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar avec filtres et recherche */}
      <div className="table-toolbar">
        <div className="table-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par adresse ou commande..."
          />
        </div>
        <div className="segmented-control">
          <button
            className={`segmented-button ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Toutes ({deliveries.length})
          </button>
          <button
            className={`segmented-button ${statusFilter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('PENDING')}
          >
            Planifiées ({deliveries.filter((d) => d.status === 'PENDING').length})
          </button>
          <button
            className={`segmented-button ${statusFilter === 'OUT_FOR_DELIVERY' ? 'active' : ''}`}
            onClick={() => setStatusFilter('OUT_FOR_DELIVERY')}
          >
            En cours ({deliveries.filter((d) => d.status === 'OUT_FOR_DELIVERY').length})
          </button>
          <button
            className={`segmented-button ${statusFilter === 'DELIVERED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DELIVERED')}
          >
            Livrées ({deliveries.filter((d) => d.status === 'DELIVERED').length})
          </button>
        </div>
      </div>

      {/* Tableau des livraisons */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Chargement des livraisons...
        </div>
      ) : filteredDeliveries.length === 0 ? (
        deliveries.length === 0 ? (
          <EmptyState
            title="Aucune livraison enregistrée"
            description="Toutes les commandes sont remises au comptoir ou en attente d'expédition."
            action={{
              label: '+ Planifier une première livraison',
              onClick: () => setShowForm(true),
            }}
          />
        ) : (
          <EmptyState
            title="Aucun résultat"
            description="Aucune livraison ne correspond à vos filtres actuels."
            action={{
              label: 'Réinitialiser les filtres',
              onClick: () => {
                setSearch('');
                setStatusFilter('ALL');
              },
            }}
          />
        )
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Réf. Commande</th>
                <th>Adresse de destination</th>
                <th>Date planifiée</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDeliveries.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                      #{d.orderId.slice(0, 8)}
                    </span>
                    {d.order && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {d.order.subtotal} {d.order.currency}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{d.address}</div>
                  </td>
                  <td>
                    {d.scheduledDate ? (
                      new Date(d.scheduledDate).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Non définie</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                    {d.status === 'FAILED' && d.failureReason && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.2rem' }}>
                        Motif : {d.failureReason}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {d.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => action(d.id, 'out-for-delivery', {}, 'Départ en livraison enregistré.')}
                            className="primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                          >
                            Départ tournée
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelDeliveryId(d.id)}
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', color: 'var(--danger)' }}
                          >
                            Annuler
                          </button>
                        </>
                      )}
                      {d.status === 'OUT_FOR_DELIVERY' && (
                        <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => action(d.id, 'delivered', {}, 'Colis marqué comme livré !')}
                            className="primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                          >
                            ✓ Livrée
                          </button>
                          <input
                            value={failReasonById[d.id] ?? ''}
                            onChange={(e) => setFailReasonById((prev) => ({ ...prev, [d.id]: e.target.value }))}
                            placeholder="Motif si échec..."
                            style={{ width: '110px', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              action(
                                d.id,
                                'failed',
                                { reason: failReasonById[d.id] || 'Client absent / adresse introuvable' },
                                'Livraison marquée comme échouée.',
                              )
                            }
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', color: 'var(--danger)' }}
                          >
                            Échec
                          </button>
                        </div>
                      )}
                      {d.status === 'DELIVERED' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>Terminée</span>
                      )}
                      {d.status === 'CANCELLED' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Annulée</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={page}
            totalItems={filteredDeliveries.length}
            pageSize={20}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Confirmation d'annulation */}
      <ConfirmModal
        isOpen={Boolean(cancelDeliveryId)}
        title="Annuler la livraison"
        message="Êtes-vous sûr de vouloir annuler cette expédition ? La commande restera confirmée mais son bon de livraison sera annulé."
        confirmLabel="Oui, annuler"
        variant="danger"
        onConfirm={handleCancelDelivery}
        onCancel={() => setCancelDeliveryId(null)}
      />
    </div>
  );
}

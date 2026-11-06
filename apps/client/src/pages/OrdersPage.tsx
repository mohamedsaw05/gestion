import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { Pagination } from '../components/Pagination';

interface Location {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  basePrice: string;
}
interface Customer {
  id: string;
  name: string;
}
interface LineDraft {
  productId: string;
  quantity: string;
}
interface OrderLine {
  id: string;
  productNameSnapshot: string;
  quantity: string;
  lineTotal: string;
}
interface Order {
  id: string;
  status: 'DRAFT' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  subtotal: string;
  depositPaid: string;
  currency: string;
  saleId: string | null;
  lines: OrderLine[];
  createdAt: string;
}

const STATUS_LABELS: Record<Order['status'], string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  READY: 'Prête à livrer / retirer',
  COMPLETED: 'Terminée (Vente)',
  CANCELLED: 'Annulée',
};

const STATUS_BADGES: Record<Order['status'], string> = {
  DRAFT: 'badge-warning',
  CONFIRMED: 'badge-info',
  PREPARING: 'badge-info',
  READY: 'badge-success',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-danger',
};

const NEXT_LABEL: Partial<Record<Order['status'], string>> = {
  DRAFT: 'Confirmer',
  CONFIRMED: 'Démarrer la préparation',
  PREPARING: 'Marquer comme prête',
};

export function OrdersPage() {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ productId: '', quantity: '1' }]);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [depositFor, setDepositFor] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [completeFor, setCompleteFor] = useState<string | null>(null);
  const [completeAmount, setCompleteAmount] = useState('');

  const load = () => {
    api.get<Order[]>('/orders').then(setOrders).catch((e) => setError(e instanceof ApiError ? e.message : 'Erreur'));
  };

  useEffect(() => {
    load();
    api
      .get<Location[]>('/locations')
      .then((l) => {
        setLocations(l);
        if (l[0]) setLocationId(l[0].id);
      })
      .catch(() => {});
    api.get<Product[]>('/products').then(setProducts).catch(() => {});
    api.get<Customer[]>('/customers').then(setCustomers).catch(() => {});
  }, []);

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { productId: '', quantity: '1' }]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === 'ACTIVE' && ['COMPLETED', 'CANCELLED'].includes(o.status)) return false;
      if (statusFilter === 'READY' && o.status !== 'READY') return false;
      if (statusFilter === 'COMPLETED' && o.status !== 'COMPLETED') return false;
      if (statusFilter === 'CANCELLED' && o.status !== 'CANCELLED') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        o.lines.some((l) => l.productNameSnapshot.toLowerCase().includes(q))
      );
    });
  }, [orders, statusFilter, searchQuery]);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * 20;
    return filteredOrders.slice(start, start + 20);
  }, [filteredOrders, currentPage]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/orders', {
        locationId,
        customerId: customerId || undefined,
        operationId: crypto.randomUUID(),
        lines: lines.filter((l) => l.productId && Number(l.quantity) > 0),
      });
      showToast('Commande enregistrée avec succès', 'success');
      setLines([{ productId: '', quantity: '1' }]);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création');
    }
  };

  const handleAdvance = async (id: string) => {
    setError(null);
    try {
      await api.post(`/orders/${id}/advance`);
      showToast('Statut de la commande avancé', 'info');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleCancel = async (id: string) => {
    setError(null);
    try {
      await api.post(`/orders/${id}/cancel`, {});
      showToast('Commande annulée', 'warning');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'annulation");
    }
  };

  const handleDeposit = async (e: FormEvent, id: string) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/orders/${id}/deposit`, { amount: depositAmount, method: 'CASH' });
      showToast(`Acompte de ${depositAmount} XOF enregistré`, 'success');
      setDepositFor(null);
      setDepositAmount('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'acompte");
    }
  };

  const handleComplete = async (e: FormEvent, order: Order) => {
    e.preventDefault();
    setError(null);
    try {
      const remaining = Number(order.subtotal) - Number(order.depositPaid);
      const amount = completeAmount || String(remaining);
      await api.post(`/orders/${order.id}/complete`, {
        payments: Number(amount) > 0 ? [{ method: 'CASH', amount }] : [],
      });
      showToast('Commande finalisée et convertie en vente réelle !', 'success');
      setCompleteFor(null);
      setCompleteAmount('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la finalisation');
    }
  };

  return (
    <div className="orders-page">
      <PageHeader
        title="Commandes Clients"
        subtitle="Suivi des commandes en attente, acomptes perçus et transformation en ventes réelles"
        badge={<span className="badge badge-info">{orders.length} commande{orders.length > 1 ? 's' : ''}</span>}
        primaryAction={{
          label: showCreate ? 'Fermer formulaire' : '+ Nouvelle commande',
          onClick: () => setShowCreate(!showCreate),
        }}
      />

      {error && <div className="error-banner">{error}</div>}

      {/* Creation form modal / card */}
      {showCreate && (
        <div className="dashboard-section" style={{ animation: 'fadeIn 0.15s ease' }}>
          <div className="sale-form" style={{ maxWidth: 580, marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Créer une nouvelle commande</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label>Emplacement de délivrance *</label>
                  <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Client rattaché</label>
                  <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Comptoir / Client occasionnel</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label style={{ marginTop: '0.5rem' }}>Articles commandés</label>
              {lines.map((l, i) => (
                <div key={i} className="sale-line" style={{ marginBottom: '0.5rem' }}>
                  <select
                    value={l.productId}
                    onChange={(e) => updateLine(i, { productId: e.target.value })}
                    required
                  >
                    <option value="">Choisir un article...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.basePrice} XOF)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={l.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    style={{ width: 80 }}
                    required
                  />
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} aria-label="Supprimer ligne">
                      ×
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addLine}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', marginBottom: '1rem' }}
              >
                + Ajouter une ligne
              </button>

              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button type="submit" className="primary">
                  Valider la commande
                </button>
                <button type="button" onClick={() => setShowCreate(false)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toolbar: Search and Status tabs */}
      <div className="table-toolbar" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
        <div className="table-toolbar-left">
          <div className="table-search-box">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="table-search-input"
              placeholder="Rechercher par article ou référence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="table-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
              >
                ×
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[
              { key: 'ALL', label: 'Toutes' },
              { key: 'ACTIVE', label: 'En cours' },
              { key: 'READY', label: 'Prêtes' },
              { key: 'COMPLETED', label: 'Livrées / Vente' },
              { key: 'CANCELLED', label: 'Annulées' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={statusFilter === tab.key ? 'primary' : ''}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                onClick={() => setStatusFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState
          type={orders.length === 0 ? 'no-data' : 'no-results'}
          title={orders.length === 0 ? 'Aucune commande enregistrée' : 'Aucune commande correspondante'}
          description={
            orders.length === 0
              ? 'Créez une commande pour réserver des articles avant leur encaissement définitif.'
              : 'Aucune commande ne correspond aux filtres appliqués.'
          }
          action={
            orders.length === 0
              ? {
                  label: '+ Nouvelle commande',
                  onClick: () => setShowCreate(true),
                }
              : {
                  label: 'Réinitialiser les filtres',
                  onClick: () => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                  },
                }
          }
        />
      ) : (
        <>
          <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Statut</th>
              <th>Articles commandés</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Acompte perçu</th>
              <th style={{ textAlign: 'right' }}>Reste dû</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map((o) => {
              const remaining = Number(o.subtotal) - Number(o.depositPaid);
              return (
                <tr key={o.id}>
                  <td>{new Date(o.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGES[o.status] ?? ''}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.86rem' }}>
                      {o.lines.map((l) => (
                        <li key={l.id}>
                          {l.productNameSnapshot} × {Number(l.quantity).toLocaleString('fr-FR')}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {Number(o.subtotal).toLocaleString('fr-FR')} {o.currency}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {Number(o.depositPaid) > 0 ? (
                      <span className="badge badge-success">
                        {Number(o.depositPaid).toLocaleString('fr-FR')} {o.currency}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: remaining > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {remaining.toLocaleString('fr-FR')} {o.currency}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      {NEXT_LABEL[o.status] && (
                        <button
                          type="button"
                          className="primary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => handleAdvance(o.id)}
                        >
                          {NEXT_LABEL[o.status]}
                        </button>
                      )}

                      {['DRAFT', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status) && remaining > 0 && (
                        <button
                          type="button"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => setDepositFor(depositFor === o.id ? null : o.id)}
                        >
                          + Acompte
                        </button>
                      )}

                      {o.status === 'READY' && (
                        <button
                          type="button"
                          className="primary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'var(--success)', borderColor: 'var(--success)' }}
                          onClick={() => setCompleteFor(completeFor === o.id ? null : o.id)}
                        >
                          Finaliser vente
                        </button>
                      )}

                      {['DRAFT', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status) && (
                        <button
                          type="button"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--danger-text)' }}
                          onClick={() => handleCancel(o.id)}
                        >
                          Annuler
                        </button>
                      )}
                    </div>

                    {depositFor === o.id && (
                      <form
                        onSubmit={(e) => handleDeposit(e, o.id)}
                        className="inline-form"
                        style={{ marginTop: '0.5rem', justifyContent: 'flex-end' }}
                      >
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Montant acompte"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          style={{ width: 140 }}
                          required
                        />
                        <button type="submit" className="primary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}>
                          Enregistrer
                        </button>
                        <button type="button" onClick={() => setDepositFor(null)} style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}>
                          Fermer
                        </button>
                      </form>
                    )}

                    {completeFor === o.id && (
                      <form
                        onSubmit={(e) => handleComplete(e, o)}
                        className="inline-form"
                        style={{ marginTop: '0.5rem', justifyContent: 'flex-end' }}
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={`Solde (${remaining.toFixed(2)})`}
                          value={completeAmount}
                          onChange={(e) => setCompleteAmount(e.target.value)}
                          style={{ width: 140 }}
                        />
                        <button type="submit" className="primary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: 'var(--success)', borderColor: 'var(--success)' }}>
                          Encaisser & Clôturer
                        </button>
                        <button type="button" onClick={() => setCompleteFor(null)} style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}>
                          Fermer
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination commandes */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredOrders.length}
          pageSize={20}
          onPageChange={setCurrentPage}
          itemName="commandes"
        />
        </>
      )}
    </div>
  );
}

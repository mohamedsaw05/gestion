import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { Pagination } from '../components/Pagination';

interface Location {
  id: string;
  name: string;
  type: string;
}
interface StockRow {
  id: string;
  quantityOnHand: string;
  quantityReserved: string;
  product: { id: string; name: string; sku: string } | null;
}
interface Product {
  id: string;
  name: string;
}
interface TransferLine {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantity: string;
}
interface Transfer {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  status: string;
  createdAt: string;
  lines: TransferLine[];
}

interface StockMovement {
  id: string;
  locationId: string;
  productId: string;
  movementType: string;
  quantity: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  product: { id: string; name: string; sku: string; unit: string } | null;
  location: { id: string; name: string } | null;
}

interface ValuationSummary {
  valuationMethod?: string;
  reorderLeadDays?: number;
  lowStockThreshold?: number;
  totalSkus: number;
  totalOnHand: string;
  totalReserved: string;
  totalCostValue?: string;
  estimatedRetailValue: string;
  currency: string;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-warning',
  CONFIRMED: 'badge-info',
  RECEIVED: 'badge-success',
  CANCELLED: 'badge-danger',
};

const MOVEMENT_BADGE: Record<string, { label: string; badge: string }> = {
  sale: { label: 'Vente', badge: 'badge-danger' },
  sale_cancellation: { label: 'Annulation Vente', badge: 'badge-success' },
  manual_adjustment: { label: 'Ajustement Manuel', badge: 'badge-warning' },
  inventory_reconciliation: { label: 'Inventaire Physique', badge: 'badge-info' },
  purchase_receipt: { label: 'Réception Achat', badge: 'badge-success' },
  transfer_out: { label: 'Transfert Sortant', badge: 'badge-warning' },
  transfer_in: { label: 'Transfert Entrant', badge: 'badge-success' },
  return: { label: 'Retour Client', badge: 'badge-success' },
  batch_registration: { label: 'Entrée Lot', badge: 'badge-info' },
};

export function InventoryPage() {
  const { profile } = useAuth();
  const hasCapability = (key: string) => profile?.enabledCapabilities.includes(key) ?? false;
  const { addToast } = useToast();

  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [stock, setStock] = useState<StockRow[]>([]);
  const [valuation, setValuation] = useState<ValuationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'STOCK' | 'MOVEMENTS' | 'RECONCILIATION' | 'TRANSFERS'>('STOCK');
  const [stockSearch, setStockSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  // Movements state
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Reconciliation state
  const [reconciliationCounts, setReconciliationCounts] = useState<Record<string, string>>({});
  const [reconciliationReason, setReconciliationReason] = useState('Inventaire physique périodique');
  const [reconciling, setReconciling] = useState(false);

  // Transfers state
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showCreateTransfer, setShowCreateTransfer] = useState(false);
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('1');

  const loadStock = () => {
    if (!locationId) return;
    api
      .get<StockRow[]>(`/inventory/stock?locationId=${locationId}`)
      .then((data) => {
        setStock(data);
        // Pre-fill reconciliation with current quantities as starting base
        const initialCounts: Record<string, string> = {};
        for (const item of data) {
          if (item.product?.id) {
            initialCounts[item.product.id] = item.quantityOnHand;
          }
        }
        setReconciliationCounts(initialCounts);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erreur de chargement du stock'));

    api
      .get<ValuationSummary>(`/inventory/valuation?locationId=${locationId}`)
      .then(setValuation)
      .catch(() => {});
  };

  const loadMovements = () => {
    setMovementsLoading(true);
    api
      .get<{ total: number; items: StockMovement[] }>(
        `/inventory/movements?locationId=${locationId || ''}&limit=50`,
      )
      .then((res) => setMovements(res.items))
      .catch(() => {})
      .finally(() => setMovementsLoading(false));
  };

  const loadTransfers = () =>
    api
      .get<Transfer[]>('/stock-transfers')
      .then(setTransfers)
      .catch(() => {});

  useEffect(() => {
    api
      .get<Location[]>('/inventory/locations')
      .then((list) => {
        setLocations(list);
        if (list[0]) {
          setLocationId(list[0].id);
          setFromLocationId(list[0].id);
        }
        if (list[1]) setToLocationId(list[1].id);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erreur de chargement des dépôts'));
    api.get<Product[]>('/products').then(setProducts).catch(() => {});
    if (hasCapability('multiple_locations')) loadTransfers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStock();
    if (activeTab === 'MOVEMENTS') loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, activeTab]);

  const [stockPage, setStockPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);

  useEffect(() => {
    setStockPage(1);
  }, [locationId, stockSearch, stockFilter]);

  const filteredStock = useMemo(() => {
    return stock.filter((s) => {
      const reserved = Number(s.quantityReserved);
      const available = Number(s.quantityOnHand) - reserved;

      if (stockFilter === 'OUT' && available > 0) return false;
      if (stockFilter === 'LOW' && (available <= 0 || available > 5)) return false;

      if (!stockSearch.trim()) return true;
      const q = stockSearch.toLowerCase();
      return (
        (s.product?.name && s.product.name.toLowerCase().includes(q)) ||
        (s.product?.sku && s.product.sku.toLowerCase().includes(q))
      );
    });
  }, [stock, stockSearch, stockFilter]);

  const paginatedStock = useMemo(() => {
    const start = (stockPage - 1) * 20;
    return filteredStock.slice(start, start + 20);
  }, [filteredStock, stockPage]);

  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * 20;
    return movements.slice(start, start + 20);
  }, [movements, movementPage]);

  const handleApplyReconciliation = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationId) return;

    const itemsToReconcile = stock
      .filter((s) => s.product?.id && reconciliationCounts[s.product.id] !== undefined)
      .map((s) => ({
        productId: s.product!.id,
        countedQuantity: reconciliationCounts[s.product!.id] || '0',
      }));

    if (itemsToReconcile.length === 0) {
      addToast('Aucun article à réconcilier.', 'error');
      return;
    }

    setReconciling(true);
    try {
      const res = await api.post<{ items: { discrepancyDelta: string }[] }>('/inventory/reconcile', {
        locationId,
        reason: reconciliationReason,
        items: itemsToReconcile,
      });

      const discrepancies = res.items.filter((i) => i.discrepancyDelta !== '0');
      addToast(
        `Inventaire validé ! ${discrepancies.length} écart(s) ajusté(s) avec succès.`,
        'success',
      );
      loadStock();
      setActiveTab('STOCK');
    } catch (err) {
      addToast(
        err instanceof ApiError ? err.message : "Erreur lors de l'ajustement d'inventaire",
        'error',
      );
    } finally {
      setReconciling(false);
    }
  };

  const handleCreateTransfer = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/stock-transfers', {
        fromLocationId,
        toLocationId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: transferProductId, quantity: transferQuantity }],
      });
      addToast('Transfert créé en brouillon', 'success');
      setTransferProductId('');
      setTransferQuantity('1');
      setShowCreateTransfer(false);
      loadTransfers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création du transfert');
    }
  };

  const confirmTransfer = async (id: string) => {
    try {
      await api.post(`/stock-transfers/${id}/confirm`);
      addToast('Transfert confirmé — stock sorti en transit', 'info');
      loadTransfers();
      loadStock();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la confirmation');
    }
  };

  const receiveTransfer = async (id: string) => {
    try {
      await api.post(`/stock-transfers/${id}/receive`);
      addToast('Transfert réceptionné avec succès', 'success');
      loadTransfers();
      loadStock();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la réception');
    }
  };

  const cancelTransfer = async (id: string) => {
    try {
      await api.post(`/stock-transfers/${id}/cancel`, {});
      addToast('Transfert annulé', 'warning');
      loadTransfers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'annulation");
    }
  };

  const currentLocation = locations.find((l) => l.id === locationId);
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="inventory-page">
      <PageHeader
        title="Gestion des Stocks & Mouvements"
        subtitle="Suivi des quantités réelles, valorisation, inventaires physiques et transferts inter-dépôts"
        badges={[
          currentLocation
            ? { label: `📍 ${currentLocation.name}`, variant: 'info' }
            : { label: 'Sélectionnez un dépôt', variant: 'warning' },
        ]}
        primaryAction={
          activeTab === 'TRANSFERS' && hasCapability('multiple_locations')
            ? {
                label: showCreateTransfer ? 'Fermer formulaire' : '+ Nouveau transfert',
                onClick: () => setShowCreateTransfer(!showCreateTransfer),
                variant: showCreateTransfer ? 'secondary' : 'primary',
              }
            : activeTab === 'RECONCILIATION'
              ? {
                  label: '← Retour aux stocks',
                  onClick: () => setActiveTab('STOCK'),
                  variant: 'secondary',
                }
              : {
                  label: '📋 Lancer un inventaire physique',
                  onClick: () => setActiveTab('RECONCILIATION'),
                  variant: 'primary',
                }
        }
      />

      {error && <div className="error-banner">{error}</div>}

      {/* KPI Cards: Valuation Summary avec méthode comptable CUMP/FIFO */}
      {valuation && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-value">{valuation.totalSkus}</div>
            <div className="kpi-label">Références en Stock</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{Number(valuation.totalOnHand).toLocaleString('fr-FR')}</div>
            <div className="kpi-label">Unités Physiques Totales</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value" style={{ color: '#059669' }}>
              {Number(valuation.totalCostValue || '0').toLocaleString('fr-FR')} {valuation.currency}
            </div>
            <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Valorisation Coût d’Achat</span>
              <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                {valuation.valuationMethod || 'CUMP'}
              </span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value" style={{ color: 'var(--primary)' }}>
              {Number(valuation.estimatedRetailValue).toLocaleString('fr-FR')} {valuation.currency}
            </div>
            <div className="kpi-label">Valeur Marchande (Vente)</div>
          </div>
        </div>
      )}

      {/* Navigation tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className={activeTab === 'STOCK' ? 'primary' : ''}
          onClick={() => setActiveTab('STOCK')}
        >
          📦 Niveaux de Stock ({stock.length})
        </button>
        <button
          type="button"
          className={activeTab === 'MOVEMENTS' ? 'primary' : ''}
          onClick={() => setActiveTab('MOVEMENTS')}
        >
          🔄 Historique des Mouvements
        </button>
        <button
          type="button"
          className={activeTab === 'RECONCILIATION' ? 'primary' : ''}
          onClick={() => setActiveTab('RECONCILIATION')}
        >
          📋 Inventaire Physique & Écarts
        </button>
        {hasCapability('multiple_locations') && (
          <button
            type="button"
            className={activeTab === 'TRANSFERS' ? 'primary' : ''}
            onClick={() => setActiveTab('TRANSFERS')}
          >
            🚚 Transferts Inter-Dépôts ({transfers.length})
          </button>
        )}
      </div>

      {/* ── TAB 1 : NIVEAUX DE STOCK ── */}
      {activeTab === 'STOCK' && (
        <>
          <div className="table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ margin: 0, fontWeight: 600 }}>Dépôt :</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                style={{ width: 'auto', minWidth: 200 }}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.type === 'STORE' ? 'Magasin' : 'Dépôt'})
                  </option>
                ))}
              </select>
            </div>

            <div className="table-search">
              <input
                type="search"
                placeholder="Filtrer par nom ou SKU..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
              />
            </div>

            <div className="segmented-control">
              <button
                className={`segmented-button ${stockFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStockFilter('ALL')}
              >
                Tous ({stock.length})
              </button>
              <button
                className={`segmented-button ${stockFilter === 'LOW' ? 'active' : ''}`}
                onClick={() => setStockFilter('LOW')}
              >
                Stock faible
              </button>
              <button
                className={`segmented-button ${stockFilter === 'OUT' ? 'active' : ''}`}
                onClick={() => setStockFilter('OUT')}
              >
                Rupture
              </button>
            </div>
          </div>

          {filteredStock.length === 0 ? (
            <EmptyState
              title={stock.length === 0 ? 'Aucun stock enregistré' : 'Aucun article trouvé'}
              description={
                stock.length === 0
                  ? 'Aucun stock disponible pour cet emplacement.'
                  : 'Aucun produit ne correspond à vos filtres pour cet emplacement.'
              }
              action={
                stockSearch || stockFilter !== 'ALL'
                  ? {
                      label: 'Effacer les filtres',
                      onClick: () => {
                        setStockSearch('');
                        setStockFilter('ALL');
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Physique en stock</th>
                    <th style={{ textAlign: 'right' }}>Réservé (commandes)</th>
                    <th style={{ textAlign: 'right' }}>Disponible à la vente</th>
                    <th>État</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStock.map((s) => {
                    const reserved = Number(s.quantityReserved);
                    const available = Number(s.quantityOnHand) - reserved;
                    const isOut = available <= 0;
                    const isLow = available > 0 && available <= 5;

                    return (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.product?.name ?? '—'}</strong>
                        </td>
                        <td>
                          <code>{s.product?.sku ?? '—'}</code>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(s.quantityOnHand).toLocaleString('fr-FR')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {reserved > 0 ? (
                            <span className="badge badge-warning">{reserved.toLocaleString('fr-FR')}</span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {available.toLocaleString('fr-FR')}
                        </td>
                        <td>
                          {isOut ? (
                            <span className="badge badge-danger">Rupture</span>
                          ) : isLow ? (
                            <span className="badge badge-warning">Stock faible</span>
                          ) : (
                            <span className="badge badge-success">Disponible</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination stock */}
              <Pagination
                currentPage={stockPage}
                totalItems={filteredStock.length}
                pageSize={20}
                onPageChange={setStockPage}
                itemName="articles"
              />
            </div>
          )}
        </>
      )}

      {/* ── TAB 2 : HISTORIQUE DES MOUVEMENTS ── */}
      {activeTab === 'MOVEMENTS' && (
        <div>
          <div className="table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ margin: 0, fontWeight: 600 }}>Filtrer par Dépôt :</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                style={{ width: 'auto', minWidth: 200 }}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={loadMovements} className="btn-secondary">
              🔄 Actualiser les mouvements
            </button>
          </div>

          {movementsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Chargement de l'historique des mouvements...
            </div>
          ) : movements.length === 0 ? (
            <EmptyState
              title="Aucun mouvement de stock"
              description="Aucun mouvement d'entrée, sortie ou inventaire n'a encore été enregistré sur cet emplacement."
            />
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Heure</th>
                    <th>Type de Mouvement</th>
                    <th>Produit</th>
                    <th style={{ textAlign: 'right' }}>Variation (Delta)</th>
                    <th>Référence & Contexte</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMovements.map((m) => {
                    const badgeInfo = MOVEMENT_BADGE[m.movementType] ?? {
                      label: m.movementType,
                      badge: 'badge-info',
                    };
                    const deltaNum = Number(m.quantity);
                    const isPositive = deltaNum > 0;

                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(m.createdAt).toLocaleTimeString('fr-FR')}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${badgeInfo.badge}`}>{badgeInfo.label}</span>
                        </td>
                        <td>
                          <strong>{m.product?.name ?? m.productId.slice(0, 8)}</strong>
                          {m.product?.sku && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Réf: {m.product.sku}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
                          }}
                        >
                          {isPositive ? `+${deltaNum}` : deltaNum} {m.product?.unit ?? 'U'}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>{m.referenceType}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ID: {m.referenceId.slice(0, 13)}...
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination mouvements */}
              <Pagination
                currentPage={movementPage}
                totalItems={movements.length}
                pageSize={20}
                onPageChange={setMovementPage}
                itemName="mouvements"
              />
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3 : INVENTAIRE PHYSIQUE & RÉCONCILIATION D'ÉCARTS ── */}
      {activeTab === 'RECONCILIATION' && (
        <form onSubmit={handleApplyReconciliation}>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
              Session d'inventaire physique — {currentLocation?.name}
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Saisissez la quantité physique réelle comptée pour chaque article. Le système calculera
              automatiquement les écarts et enregistrera les mouvements de réconciliation avec traçabilité.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Emplacement audité *
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.type === 'STORE' ? 'Magasin' : 'Dépôt'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Motif / Justification de l'inventaire *
                </label>
                <input
                  type="text"
                  value={reconciliationReason}
                  onChange={(e) => setReconciliationReason(e.target.value)}
                  placeholder="Ex: Inventaire tournant mensuel ou régularisation annuelle"
                  required
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {stock.length === 0 ? (
            <EmptyState
              title="Aucun article à compter"
              description="Aucun produit n'est actuellement suivi en stock sur cet emplacement."
            />
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Stock Théorique (Système)</th>
                    <th style={{ textAlign: 'center', width: '180px' }}>Stock Réel Constaté</th>
                    <th style={{ textAlign: 'right' }}>Écart Calculé</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => {
                    const prodId = s.product?.id ?? '';
                    const theoretical = Number(s.quantityOnHand);
                    const countedStr = reconciliationCounts[prodId] ?? s.quantityOnHand;
                    const countedNum = Number(countedStr) || 0;
                    const discrepancy = countedNum - theoretical;

                    return (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.product?.name ?? '—'}</strong>
                        </td>
                        <td>
                          <code>{s.product?.sku ?? '—'}</code>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {theoretical.toLocaleString('fr-FR')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={countedStr}
                            onChange={(e) =>
                              setReconciliationCounts((prev) => ({
                                ...prev,
                                [prodId]: e.target.value,
                              }))
                            }
                            style={{
                              width: '120px',
                              textAlign: 'right',
                              fontWeight: 700,
                              borderColor: discrepancy !== 0 ? 'var(--primary)' : undefined,
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {discrepancy === 0 ? (
                            <span className="badge badge-success">0 (Conforme)</span>
                          ) : discrepancy > 0 ? (
                            <span className="badge badge-info">+{discrepancy} (Surplus)</span>
                          ) : (
                            <span className="badge badge-danger">{discrepancy} (Perte)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setActiveTab('STOCK')} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={reconciling || stock.length === 0} className="primary">
              {reconciling ? 'Application de la réconciliation...' : '✅ Valider et Appliquer la Réconciliation'}
            </button>
          </div>
        </form>
      )}

      {/* ── TAB 4 : TRANSFERTS INTER-DÉPÔTS ── */}
      {activeTab === 'TRANSFERS' && (
        <>
          {showCreateTransfer && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <h3 style={{ margin: '0 0 1rem' }}>Initier un transfert de stock</h3>
              <form onSubmit={handleCreateTransfer}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Dépôt Source (Sortie) *
                    </label>
                    <select
                      value={fromLocationId}
                      onChange={(e) => setFromLocationId(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Dépôt Cible (Entrée) *
                    </label>
                    <select
                      value={toLocationId}
                      onChange={(e) => setToLocationId(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Article à transférer *
                    </label>
                    <select
                      value={transferProductId}
                      onChange={(e) => setTransferProductId(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="">Sélectionnez un article...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Quantité *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={transferQuantity}
                      onChange={(e) => setTransferQuantity(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {fromLocationId === toLocationId && (
                  <div className="error-banner" style={{ marginBottom: '1rem' }}>
                    Le dépôt source et la destination doivent être deux emplacements distincts.
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowCreateTransfer(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    disabled={fromLocationId === toLocationId || !transferProductId}
                  >
                    Enregistrer le transfert (Brouillon)
                  </button>
                </div>
              </form>
            </div>
          )}

          {transfers.length === 0 ? (
            <EmptyState
              title="Aucun transfert inter-dépôts"
              description="Aucun mouvement de transfert n'a été créé pour le moment."
              action={{
                label: '+ Créer un transfert',
                onClick: () => setShowCreateTransfer(true),
              }}
            />
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Origine</th>
                    <th>Destination</th>
                    <th>Articles transférés</th>
                    <th>Statut</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{locationName(t.fromLocationId)}</strong>
                      </td>
                      <td>
                        <strong>{locationName(t.toLocationId)}</strong>
                      </td>
                      <td>
                        {t.lines.map((l) => `${l.productNameSnapshot} ×${l.quantity}`).join(', ')}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[t.status] ?? ''}`}>{t.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {t.status === 'DRAFT' && (
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="primary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                              onClick={() => confirmTransfer(t.id)}
                            >
                              Confirmer la sortie
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                              onClick={() => cancelTransfer(t.id)}
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                        {t.status === 'CONFIRMED' && (
                          <button
                            type="button"
                            className="primary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                            onClick={() => receiveTransfer(t.id)}
                          >
                            Valider la réception
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

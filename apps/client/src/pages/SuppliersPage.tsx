import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ToastContext';
import { Pagination } from '../components/Pagination';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  balance: string;
}
interface Location {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
}
interface PurchaseOrderLine {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantityOrdered: string;
  quantityReceived: string;
  unitCostSnapshot: string;
}
interface PurchaseOrder {
  id: string;
  supplierId: string;
  status: 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  subtotal: string;
  currency: string;
  lines: PurchaseOrderLine[];
  createdAt?: string;
}
interface LineDraft {
  productId: string;
  quantity: string;
  unitCost: string;
}

const STATUS_LABELS: Record<PurchaseOrder['status'], string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmée',
  PARTIALLY_RECEIVED: 'Partiellement reçue',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

const STATUS_BADGES: Record<PurchaseOrder['status'], string> = {
  DRAFT: 'badge-warning',
  CONFIRMED: 'badge-info',
  PARTIALLY_RECEIVED: 'badge-warning',
  RECEIVED: 'badge-success',
  CANCELLED: 'badge-danger',
};

export function SuppliersPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms state
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poLocationId, setPoLocationId] = useState('');
  const [poLines, setPoLines] = useState<LineDraft[]>([{ productId: '', quantity: '1', unitCost: '0' }]);

  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [receiveFor, setReceiveFor] = useState<string | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});

  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Supplier[]>('/suppliers'),
      api.get<PurchaseOrder[]>('/purchase-orders'),
    ])
      .then(([s, o]) => {
        setSuppliers(s);
        setOrders(o);
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api
      .get<Location[]>('/locations')
      .then((l) => {
        setLocations(l);
        if (l[0]) setPoLocationId(l[0].id);
      })
      .catch(() => {});
    api.get<Product[]>('/products').then(setProducts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gestion des produits fournis par chaque fournisseur (Persistance & Mapping)
  const [supplierProductsMap, setSupplierProductsMap] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('vtm_supplier_products');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [managingProductsSupplier, setManagingProductsSupplier] = useState<Supplier | null>(null);
  const [modalProductSearch, setModalProductSearch] = useState('');
  const [modalFilterMode, setModalFilterMode] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [newSupplierProductIds, setNewSupplierProductIds] = useState<string[]>([]);

  const saveSupplierProducts = (supplierId: string, productIds: string[]) => {
    const updated = { ...supplierProductsMap, [supplierId]: productIds };
    setSupplierProductsMap(updated);
    try {
      localStorage.setItem('vtm_supplier_products', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const toggleProductForManagingSupplier = (productId: string) => {
    if (!managingProductsSupplier) return;
    const currentList = supplierProductsMap[managingProductsSupplier.id] || [];
    const nextList = currentList.includes(productId)
      ? currentList.filter((id) => id !== productId)
      : [...currentList, productId];
    saveSupplierProducts(managingProductsSupplier.id, nextList);
  };

  const handleCreateSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) return;
    try {
      const newSup = await api.post<Supplier>('/suppliers', { name: supplierName.trim(), phone: supplierPhone.trim() || undefined });
      if (newSupplierProductIds.length > 0 && newSup?.id) {
        saveSupplierProducts(newSup.id, newSupplierProductIds);
      }
      addToast(`Fournisseur « ${supplierName.trim()} » créé avec ${newSupplierProductIds.length} article(s) associé(s).`, 'success');
      setSupplierName('');
      setSupplierPhone('');
      setNewSupplierProductIds([]);
      setShowSupplierForm(false);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la création du fournisseur', 'error');
    }
  };

  const updatePoLine = (index: number, patch: Partial<LineDraft>) => {
    setPoLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const handleCreatePurchaseOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!poSupplierId || !poLocationId) return;
    try {
      await api.post('/purchase-orders', {
        supplierId: poSupplierId,
        locationId: poLocationId,
        operationId: crypto.randomUUID(),
        lines: poLines.filter((l) => l.productId && Number(l.quantity) > 0),
      });
      addToast('Commande fournisseur créée en brouillon.', 'success');
      setPoLines([{ productId: '', quantity: '1', unitCost: '0' }]);
      setShowOrderForm(false);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la création de la commande', 'error');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await api.post(`/purchase-orders/${id}/confirm`);
      addToast('Commande fournisseur confirmée.', 'success');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de confirmation', 'error');
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderId) return;
    try {
      await api.post(`/purchase-orders/${cancelOrderId}/cancel`, {});
      addToast('Commande fournisseur annulée.', 'success');
      setCancelOrderId(null);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'annulation", 'error');
    }
  };

  const handleReceive = async (e: FormEvent, order: PurchaseOrder) => {
    e.preventDefault();
    try {
      const lines = order.lines
        .map((l) => ({ purchaseOrderLineId: l.id, quantity: receiveQuantities[l.id] }))
        .filter((l) => l.quantity && Number(l.quantity) > 0);
      if (lines.length === 0) {
        addToast('Indiquez au moins une quantité reçue.', 'warning');
        return;
      }
      await api.post(`/purchase-orders/${order.id}/receive`, { lines });
      setReceiveFor(null);
      setReceiveQuantities({});
      addToast('Réception enregistrée avec succès — stock mis à jour.', 'success');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la réception', 'error');
    }
  };

  const handlePay = async (e: FormEvent, supplierId: string) => {
    e.preventDefault();
    if (!payAmount) return;
    try {
      await api.post(`/suppliers/${supplierId}/payments`, { amount: payAmount, method: 'BANK_TRANSFER' });
      addToast('Paiement fournisseur enregistré.', 'success');
      setPayFor(null);
      setPayAmount('');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors du paiement', 'error');
    }
  };

  const supplierName_ = (id: string) => suppliers.find((s) => s.id === id)?.name ?? '—';

  const totalDebt = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
  }, [suppliers]);

  const [supplierPage, setSupplierPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);

  useEffect(() => {
    setSupplierPage(1);
  }, [search]);

  useEffect(() => {
    setOrderPage(1);
  }, [search, orderStatusFilter]);

  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)));
  }, [suppliers, search]);

  const paginatedSuppliers = useMemo(() => {
    const start = (supplierPage - 1) * 20;
    return filteredSuppliers.slice(start, start + 20);
  }, [filteredSuppliers, supplierPage]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderStatusFilter !== 'ALL' && o.status !== orderStatusFilter) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const sName = supplierName_(o.supplierId).toLowerCase();
      return sName.includes(q) || o.id.toLowerCase().includes(q);
    });
  }, [orders, orderStatusFilter, search, suppliers]);

  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * 20;
    return filteredOrders.slice(start, start + 20);
  }, [filteredOrders, orderPage]);

  return (
    <div>
      <PageHeader
        title="Fournisseurs & Approvisionnements"
        subtitle="Gestion des partenaires d'approvisionnement, bons de commande d'achat et suivi des livraisons"
        badges={[
          { label: `${suppliers.length} fournisseur${suppliers.length > 1 ? 's' : ''}`, variant: 'info' },
          { label: `Dette totale : ${totalDebt.toLocaleString('fr-FR')} XOF`, variant: totalDebt > 0 ? 'warning' : 'success' },
        ]}
        primaryAction={{
          label: activeTab === 'suppliers'
            ? showSupplierForm ? 'Fermer le formulaire' : '+ Nouveau fournisseur'
            : showOrderForm ? 'Fermer le formulaire' : '+ Nouvelle commande',
          onClick: () => {
            if (activeTab === 'suppliers') setShowSupplierForm((p) => !p);
            else setShowOrderForm((p) => !p);
          },
          variant: (activeTab === 'suppliers' && showSupplierForm) || (activeTab === 'orders' && showOrderForm) ? 'secondary' : 'primary',
        }}
      />

      {/* Tabs */}
      <div className="segmented-control" style={{ marginBottom: '1.25rem', width: 'fit-content' }}>
        <button
          className={`segmented-button ${activeTab === 'suppliers' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('suppliers');
            setSearch('');
          }}
        >
          Fournisseurs & Dettes ({suppliers.length})
        </button>
        <button
          className={`segmented-button ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('orders');
            setSearch('');
          }}
        >
          Commandes Fournisseur ({orders.length})
        </button>
      </div>

      {/* TAB 1: FOURNISSEURS */}
      {activeTab === 'suppliers' && (
        <div>
          {showSupplierForm && (
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
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Ajouter un nouveau fournisseur</h3>
              <form onSubmit={handleCreateSupplier}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Raison sociale / Nom *
                    </label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Ex: Grossiste Import SA"
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      placeholder="+226 25 00 00 00"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Produits approvisionnés par ce fournisseur */}
                <div style={{ marginBottom: '1.25rem', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <label style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      📦 Articles approvisionnés par ce fournisseur ({newSupplierProductIds.length} sélectionné{newSupplierProductIds.length > 1 ? 's' : ''}) :
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => setNewSupplierProductIds(products.map((p) => p.id))}
                        style={{ fontSize: '0.72rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', color: '#1d4ed8', cursor: 'pointer' }}
                      >
                        Tout cocher
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewSupplierProductIds([])}
                        style={{ fontSize: '0.72rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', color: '#64748b', cursor: 'pointer' }}
                      >
                        Tout décocher
                      </button>
                    </div>
                  </div>
                  {products.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', padding: '0.5rem' }}>Aucun produit enregistré au catalogue pour le moment.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto', padding: '0.5rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      {products.map((p) => {
                        const isChecked = newSupplierProductIds.includes(p.id);
                        return (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: '6px', background: isChecked ? '#eff6ff' : '#f8fafc', border: `1px solid ${isChecked ? '#93c5fd' : '#e2e8f0'}` }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setNewSupplierProductIds((prev) =>
                                  isChecked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                                );
                              }}
                              style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                            />
                            <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? '#1d4ed8' : '#334155' }}>
                              {p.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowSupplierForm(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="primary">
                    Enregistrer le fournisseur
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="table-toolbar">
            <div className="table-search">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom ou téléphone..."
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Chargement des fournisseurs...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            suppliers.length === 0 ? (
              <EmptyState
                title="Aucun fournisseur enregistré"
                description="Ajoutez vos partenaires grossistes pour passer des commandes d'approvisionnement."
                action={{
                  label: '+ Ajouter un premier fournisseur',
                  onClick: () => setShowSupplierForm(true),
                }}
              />
            ) : (
              <EmptyState
                title="Aucun résultat"
                description={`Aucun fournisseur ne correspond à « ${search} ».`}
                action={{
                  label: 'Effacer la recherche',
                  onClick: () => setSearch(''),
                }}
              />
            )
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fournisseur</th>
                    <th>Téléphone</th>
                    <th>Articles Approvisionnés</th>
                    <th>Dette en cours</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSuppliers.map((s) => {
                    const debt = Number(s.balance) || 0;
                    const suppliedIds = supplierProductsMap[s.id] || [];
                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{s.id.slice(0, 8)}</div>
                        </td>
                        <td>{s.phone ? <span style={{ fontFamily: 'monospace' }}>{s.phone}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setManagingProductsSupplier(s)}
                            className="btn-secondary"
                            style={{
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: suppliedIds.length > 0 ? '#eff6ff' : '#f8fafc',
                              color: suppliedIds.length > 0 ? '#1d4ed8' : '#64748b',
                              border: `1px solid ${suppliedIds.length > 0 ? '#bfdbfe' : '#e2e8f0'}`,
                              fontWeight: 600,
                            }}
                          >
                            <span>📦</span>
                            <span>{suppliedIds.length} article{suppliedIds.length > 1 ? 's' : ''} approvisionné{suppliedIds.length > 1 ? 's' : ''}</span>
                            <span style={{ fontSize: '0.7rem', color: '#3b82f6' }}>✎</span>
                          </button>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: debt > 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {debt.toLocaleString('fr-FR')} XOF
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {debt > 0 ? (
                            payFor === s.id ? (
                              <form onSubmit={(e) => handlePay(e, s.id)} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  placeholder="Montant"
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  required
                                  style={{ width: '100px', padding: '0.25rem 0.4rem', fontSize: '0.8rem' }}
                                />
                                <button type="submit" className="primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}>
                                  Valider
                                </button>
                                <button type="button" onClick={() => setPayFor(null)} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}>
                                  Annuler
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayFor(s.id);
                                  setPayAmount(String(debt));
                                }}
                                className="primary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                              >
                                Payer la dette
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>À jour</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination fournisseurs */}
              <Pagination
                currentPage={supplierPage}
                totalItems={filteredSuppliers.length}
                pageSize={20}
                onPageChange={setSupplierPage}
                itemName="fournisseurs"
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMMANDES FOURNISSEUR */}
      {activeTab === 'orders' && (
        <div>
          {showOrderForm && (
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
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Nouvelle commande fournisseur</h3>
              <form onSubmit={handleCreatePurchaseOrder}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Fournisseur *
                    </label>
                    <select
                      value={poSupplierId}
                      onChange={(e) => setPoSupplierId(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="">Choisir un fournisseur...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Emplacement de livraison *
                    </label>
                    <select
                      value={poLocationId}
                      onChange={(e) => setPoLocationId(e.target.value)}
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
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Articles commandés :</span>
                    <button
                      type="button"
                      onClick={() => setPoLines((p) => [...p, { productId: '', quantity: '1', unitCost: '0' }])}
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem' }}
                    >
                      + Ajouter un article
                    </button>
                  </div>

                  {poLines.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 100px 120px 36px',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                        alignItems: 'center',
                      }}
                    >
                      <select
                        value={line.productId}
                        onChange={(e) => updatePoLine(i, { productId: e.target.value })}
                        required
                        style={{ width: '100%' }}
                      >
                        <option value="">Sélectionner un produit...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        placeholder="Qté"
                        value={line.quantity}
                        onChange={(e) => updatePoLine(i, { quantity: e.target.value })}
                        required
                        style={{ width: '100%' }}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Coût unitaire"
                        value={line.unitCost}
                        onChange={(e) => updatePoLine(i, { unitCost: e.target.value })}
                        required
                        style={{ width: '100%' }}
                      />
                      {poLines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setPoLines((p) => p.filter((_, idx) => idx !== i))}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}
                        >
                          ×
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowOrderForm(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="primary">
                    Créer le bon de commande
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="table-toolbar">
            <div className="table-search">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par fournisseur ou référence..."
              />
            </div>
            <div className="segmented-control">
              <button
                className={`segmented-button ${orderStatusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('ALL')}
              >
                Toutes ({orders.length})
              </button>
              <button
                className={`segmented-button ${orderStatusFilter === 'CONFIRMED' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('CONFIRMED')}
              >
                Confirmées ({orders.filter((o) => o.status === 'CONFIRMED').length})
              </button>
              <button
                className={`segmented-button ${orderStatusFilter === 'RECEIVED' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('RECEIVED')}
              >
                Reçues ({orders.filter((o) => o.status === 'RECEIVED').length})
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Chargement des commandes...
            </div>
          ) : filteredOrders.length === 0 ? (
            orders.length === 0 ? (
              <EmptyState
                title="Aucune commande d'achat"
                description="Créez votre première commande fournisseur pour réapprovisionner vos dépôts."
                action={{
                  label: '+ Passer une commande',
                  onClick: () => setShowOrderForm(true),
                }}
              />
            ) : (
              <EmptyState
                title="Aucun résultat"
                description="Aucune commande ne correspond aux filtres appliqués."
                action={{
                  label: 'Réinitialiser les filtres',
                  onClick: () => {
                    setSearch('');
                    setOrderStatusFilter('ALL');
                  },
                }}
              />
            )
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fournisseur & Réf.</th>
                    <th>Statut</th>
                    <th>Articles & Réceptions</th>
                    <th>Montant Total</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{supplierName_(o.supplierId)}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          #{o.id.slice(0, 8)}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGES[o.status]}`}>
                          {STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>
                          {o.lines.map((l) => (
                            <div key={l.id}>
                              {l.productNameSnapshot} : <strong>{l.quantityReceived}</strong>/{l.quantityOrdered}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700 }}>
                          {Number(o.subtotal).toLocaleString('fr-FR')} {o.currency}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {o.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleConfirm(o.id)}
                              className="primary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                            >
                              Confirmer
                            </button>
                          )}
                          {(o.status === 'CONFIRMED' || o.status === 'PARTIALLY_RECEIVED') && (
                            <button
                              type="button"
                              onClick={() => setReceiveFor(receiveFor === o.id ? null : o.id)}
                              className="primary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                            >
                              {receiveFor === o.id ? 'Fermer' : 'Réceptionner'}
                            </button>
                          )}
                          {(o.status === 'DRAFT' || o.status === 'CONFIRMED') && (
                            <button
                              type="button"
                              onClick={() => setCancelOrderId(o.id)}
                              className="btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', color: 'var(--danger)' }}
                            >
                              Annuler
                            </button>
                          )}
                        </div>

                        {/* Formulaire de réception inline */}
                        {receiveFor === o.id && (
                          <form
                            onSubmit={(e) => handleReceive(e, o)}
                            style={{
                              marginTop: '0.75rem',
                              padding: '0.75rem',
                              background: 'var(--surface-muted, #f8fafc)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                              Enregistrer la réception physique en stock :
                            </div>
                            {o.lines.map((l) => {
                              const remaining = Number(l.quantityOrdered) - Number(l.quantityReceived);
                              if (remaining <= 0) return null;
                              return (
                                <div
                                  key={l.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '0.35rem',
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  <span>{l.productNameSnapshot} (reste {remaining})</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={remaining}
                                    step="0.0001"
                                    placeholder="Qté reçue"
                                    value={receiveQuantities[l.id] ?? ''}
                                    onChange={(e) => setReceiveQuantities((prev) => ({ ...prev, [l.id]: e.target.value }))}
                                    style={{ width: '90px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                                  />
                                </div>
                              );
                            })}
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                              <button type="button" onClick={() => setReceiveFor(null)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                                Annuler
                              </button>
                              <button type="submit" className="primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                                Valider la réception
                              </button>
                            </div>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination commandes d'achat */}
              <Pagination
                currentPage={orderPage}
                totalItems={filteredOrders.length}
                pageSize={20}
                onPageChange={setOrderPage}
                itemName="commandes d'achat"
              />
            </div>
          )}
        </div>
      )}

      {/* ESPACE SPÉCIALISÉ & SPACIEUX POUR LA SÉLECTION DES ARTICLES DU FOURNISSEUR */}
      {managingProductsSupplier && (() => {
        const assignedIds = supplierProductsMap[managingProductsSupplier.id] || [];
        const visibleProducts = products.filter((p) => {
          const matchSearch =
            !modalProductSearch ||
            p.name.toLowerCase().includes(modalProductSearch.toLowerCase()) ||
            p.id.toLowerCase().includes(modalProductSearch.toLowerCase());
          const isAssigned = assignedIds.includes(p.id);
          if (modalFilterMode === 'ASSIGNED') return matchSearch && isAssigned;
          if (modalFilterMode === 'UNASSIGNED') return matchSearch && !isAssigned;
          return matchSearch;
        });

        const handleSelectAllVisible = () => {
          const newIds = new Set(assignedIds);
          visibleProducts.forEach((p) => newIds.add(p.id));
          saveSupplierProducts(managingProductsSupplier.id, Array.from(newIds));
        };

        const handleDeselectAllVisible = () => {
          const visibleIds = new Set(visibleProducts.map((p) => p.id));
          const newIds = assignedIds.filter((id) => !visibleIds.has(id));
          saveSupplierProducts(managingProductsSupplier.id, newIds);
        };

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1.5rem',
            }}
            onClick={() => setManagingProductsSupplier(null)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '20px',
                width: '92vw',
                maxWidth: '1240px',
                height: '88vh',
                maxHeight: '900px',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
                border: '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* EN-TÊTE SPACIEUX DE L'ESPACE FOURNISSEUR */}
              <div
                style={{
                  padding: '1.5rem 2rem',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '14px',
                      background: 'rgba(37, 99, 235, 0.25)',
                      border: '1.5px solid rgba(59, 130, 246, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.8rem',
                    }}
                  >
                    📦
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.2rem' }}>
                      <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                        {managingProductsSupplier.name}
                      </h2>
                      <span
                        style={{
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#93c5fd',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        Fournisseur Certifié
                      </span>
                      {managingProductsSupplier.phone && (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          📞 {managingProductsSupplier.phone}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>
                      Espace dédié de sélection : affectez les articles approvisionnés par ce fournisseur pour vos commandes et devis d'achat.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '0.5rem 1rem',
                      textAlign: 'right',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                      Articles Associés
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
                      {assignedIds.length} <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#94a3b8' }}>/ {products.length} au catalogue</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setManagingProductsSupplier(null)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '38px',
                      height: '38px',
                      color: '#ffffff',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* BARRE D'OUTILS, RECHERCHE & FILTRES RAPIDES */}
              <div
                style={{
                  padding: '1rem 2rem',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Recherche instantanée */}
                <div style={{ flex: 1, minWidth: '320px', position: 'relative' }}>
                  <input
                    type="search"
                    value={modalProductSearch}
                    onChange={(e) => setModalProductSearch(e.target.value)}
                    placeholder="Filtrer instantanément par nom d'article ou référence..."
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      background: '#ffffff',
                    }}
                  />
                </div>

                {/* Filtres par état */}
                <div style={{ display: 'flex', gap: '0.4rem', background: '#e2e8f0', padding: '3px', borderRadius: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalFilterMode('ALL')}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: modalFilterMode === 'ALL' ? '#ffffff' : 'transparent',
                      color: modalFilterMode === 'ALL' ? '#1e293b' : '#64748b',
                      fontWeight: modalFilterMode === 'ALL' ? 700 : 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: modalFilterMode === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    Tous ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalFilterMode('ASSIGNED')}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: modalFilterMode === 'ASSIGNED' ? '#ffffff' : 'transparent',
                      color: modalFilterMode === 'ASSIGNED' ? '#1d4ed8' : '#64748b',
                      fontWeight: modalFilterMode === 'ASSIGNED' ? 700 : 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: modalFilterMode === 'ASSIGNED' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    Sélectionnés ({assignedIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalFilterMode('UNASSIGNED')}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: modalFilterMode === 'UNASSIGNED' ? '#ffffff' : 'transparent',
                      color: modalFilterMode === 'UNASSIGNED' ? '#dc2626' : '#64748b',
                      fontWeight: modalFilterMode === 'UNASSIGNED' ? 700 : 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: modalFilterMode === 'UNASSIGNED' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    Non sélectionnés ({products.length - assignedIds.length})
                  </button>
                </div>

                {/* Actions groupées */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Tout cocher visibles
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllVisible}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Tout décocher
                  </button>
                </div>
              </div>

              {/* GRILLE SPACIEUSE D'ARTICLES */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1.5rem 2rem',
                  background: '#f1f5f9',
                }}
              >
                {visibleProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                      Aucun article ne correspond à votre filtre
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                      Essayez d'effacer la recherche ou de changer de filtre pour voir d'autres articles.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '0.85rem',
                    }}
                  >
                    {visibleProducts.map((p) => {
                      const isAssigned = assignedIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleProductForManagingSupplier(p.id)}
                          style={{
                            background: isAssigned ? '#eff6ff' : '#ffffff',
                            border: `2px solid ${isAssigned ? '#3b82f6' : '#e2e8f0'}`,
                            borderRadius: '12px',
                            padding: '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.65rem',
                            transition: 'all 0.15s ease',
                            boxShadow: isAssigned
                              ? '0 4px 12px rgba(59, 130, 246, 0.15)'
                              : '0 1px 3px rgba(0, 0, 0, 0.02)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => {}} // géré par le onClick du conteneur
                              style={{
                                width: '18px',
                                height: '18px',
                                marginTop: '2px',
                                cursor: 'pointer',
                                accentColor: '#2563eb',
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: isAssigned ? 800 : 600,
                                  fontSize: '0.92rem',
                                  color: isAssigned ? '#1e3a8a' : '#1e293b',
                                  lineHeight: 1.35,
                                  marginBottom: '0.25rem',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {p.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }}>
                                Réf: #{p.id.slice(0, 8)}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: '0.45rem',
                              borderTop: `1px solid ${isAssigned ? '#bfdbfe' : '#f1f5f9'}`,
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: isAssigned ? '#dbeafe' : '#f1f5f9',
                                color: isAssigned ? '#1d4ed8' : '#64748b',
                              }}
                            >
                              {isAssigned ? '✓ Fourni par ce grossiste' : '○ Non associé'}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                              Cliquez pour {isAssigned ? 'retirer' : 'ajouter'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PIED DE PAGE FIXE & CONFIRMATION */}
              <div
                style={{
                  padding: '1.25rem 2rem',
                  background: '#ffffff',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e40af' }}>
                    {assignedIds.length} article{assignedIds.length > 1 ? 's' : ''} affecté{assignedIds.length > 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '0.5rem' }}>
                    — Modifications sauvegardées en direct
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setManagingProductsSupplier(null)}
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '0.75rem 1.75rem',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                    }}
                  >
                    ✓ Valider & Fermer l'Espace
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de confirmation d'annulation */}
      <ConfirmModal
        isOpen={Boolean(cancelOrderId)}
        title="Annuler la commande fournisseur"
        message="Êtes-vous sûr de vouloir annuler ce bon de commande ? Cette action est irréversible."
        confirmLabel="Oui, annuler la commande"
        variant="danger"
        onConfirm={handleCancelOrder}
        onCancel={() => setCancelOrderId(null)}
      />
    </div>
  );
}

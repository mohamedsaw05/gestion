import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';

interface Product {
  id: string;
  name: string;
}
interface Customer {
  id: string;
  name: string;
}
interface CustomerOverride {
  id: string;
  customerId: string;
  productId: string;
  price: string;
}
interface QuantityTier {
  id: string;
  productId: string;
  minQuantity: string;
  price: string;
}

export function PricingPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overrides' | 'tiers'>('overrides');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [overrides, setOverrides] = useState<CustomerOverride[]>([]);
  const [tiers, setTiers] = useState<QuantityTier[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms state
  const [showForm, setShowForm] = useState(false);
  const [ovCustomerId, setOvCustomerId] = useState('');
  const [ovProductId, setOvProductId] = useState('');
  const [ovPrice, setOvPrice] = useState('');

  const [tierProductId, setTierProductId] = useState('');
  const [tierMinQty, setTierMinQty] = useState('');
  const [tierPrice, setTierPrice] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Product[]>('/products').catch(() => []),
      api.get<Customer[]>('/customers').catch(() => []),
      api.get<CustomerOverride[]>('/pricing/customer-overrides').catch(() => []),
      api.get<QuantityTier[]>('/pricing/quantity-tiers').catch(() => []),
    ])
      .then(([p, c, ov, t]) => {
        setProducts(p);
        setCustomers(c);
        setOverrides(ov);
        setTiers(t);
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des tarifs', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;

  const handleAddOverride = async (e: FormEvent) => {
    e.preventDefault();
    if (!ovCustomerId || !ovProductId || !ovPrice) return;
    setSubmitting(true);
    try {
      await api.post('/pricing/customer-overrides', {
        customerId: ovCustomerId,
        productId: ovProductId,
        price: ovPrice,
      });
      addToast('Tarif négocié enregistré avec succès.', 'success');
      setOvPrice('');
      setShowForm(false);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de l’enregistrement du tarif', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTier = async (e: FormEvent) => {
    e.preventDefault();
    if (!tierProductId || !tierMinQty || !tierPrice) return;
    setSubmitting(true);
    try {
      await api.post('/pricing/quantity-tiers', {
        productId: tierProductId,
        minQuantity: tierMinQty,
        price: tierPrice,
      });
      addToast('Palier de quantité enregistré.', 'success');
      setTierMinQty('');
      setTierPrice('');
      setShowForm(false);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de l’enregistrement du palier', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce tarif négocié ?')) return;
    try {
      await api.delete(`/pricing/customer-overrides/${id}`);
      addToast('Tarif négocié supprimé avec succès.', 'success');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la suppression', 'error');
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce palier de quantité ?')) return;
    try {
      await api.delete(`/pricing/quantity-tiers/${id}`);
      addToast('Palier de quantité supprimé avec succès.', 'success');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la suppression', 'error');
    }
  };

  const filteredOverrides = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return overrides;
    return overrides.filter((o) => {
      const cName = (customers.find((c) => c.id === o.customerId)?.name ?? o.customerId).toLowerCase();
      const pName = (products.find((p) => p.id === o.productId)?.name ?? o.productId).toLowerCase();
      return cName.includes(q) || pName.includes(q);
    });
  }, [overrides, search, customers, products]);

  const filteredTiers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tiers;
    return tiers.filter((t) => {
      const pName = (products.find((p) => p.id === t.productId)?.name ?? t.productId).toLowerCase();
      return pName.includes(q);
    });
  }, [tiers, search, products]);

  return (
    <div>
      <PageHeader
        title="Tarifs & Barèmes Négociés"
        subtitle="Règles tarifaires appliquées lors de la vente : Prix négocié client > Palier quantité > Prix de base"
        badges={[
          { label: `${overrides.length} tarif(s) client`, variant: 'info' },
          { label: `${tiers.length} palier(s) quantité`, variant: 'warning' },
        ]}
        primaryAction={{
          label: showForm ? 'Fermer le formulaire' : activeTab === 'overrides' ? '+ Nouveau prix client' : '+ Nouveau palier',
          onClick: () => setShowForm((p) => !p),
          variant: showForm ? 'secondary' : 'primary',
        }}
      />

      {/* Tabs */}
      <div className="segmented-control" style={{ marginBottom: '1.25rem', width: 'fit-content' }}>
        <button
          className={`segmented-button ${activeTab === 'overrides' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('overrides');
            setSearch('');
          }}
        >
          Prix Négociés par Client ({overrides.length})
        </button>
        <button
          className={`segmented-button ${activeTab === 'tiers' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('tiers');
            setSearch('');
          }}
        >
          Paliers de Quantité / Volume ({tiers.length})
        </button>
      </div>

      {/* TAB 1: PRIX NÉGOCIÉS CLIENT */}
      {activeTab === 'overrides' && (
        <div>
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
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Définir un prix spécial pour un client</h3>
              <form onSubmit={handleAddOverride}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Client bénéficiaire *
                    </label>
                    <select
                      value={ovCustomerId}
                      onChange={(e) => setOvCustomerId(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="">Sélectionner un client...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Produit concerné *
                    </label>
                    <select
                      value={ovProductId}
                      onChange={(e) => setOvProductId(e.target.value)}
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
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Prix unitaire négocié (XOF) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={ovPrice}
                      onChange={(e) => setOvPrice(e.target.value)}
                      placeholder="Prix spécial"
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" disabled={submitting} className="primary">
                    {submitting ? 'Enregistrement...' : 'Enregistrer le tarif'}
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
                placeholder="Rechercher par client ou produit..."
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Chargement des tarifs négociés...
            </div>
          ) : filteredOverrides.length === 0 ? (
            overrides.length === 0 ? (
              <EmptyState
                title="Aucun tarif spécial client"
                description="Tous les clients paient actuellement le tarif de base du catalogue."
                action={{
                  label: '+ Ajouter un tarif négocié',
                  onClick: () => setShowForm(true),
                }}
              />
            ) : (
              <EmptyState
                title="Aucun résultat"
                description={`Aucun tarif ne correspond à « ${search} ».`}
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
                    <th>Client</th>
                    <th>Article / Produit</th>
                    <th style={{ textAlign: 'right' }}>Prix négocié</th>
                    <th style={{ textAlign: 'right', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOverrides.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{customerName(o.customerId)}</span>
                      </td>
                      <td>{productName(o.productId)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                          {Number(o.price).toLocaleString('fr-FR')} XOF
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteOverride(o.id)}
                          className="danger"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.74rem' }}
                          title="Supprimer ce tarif négocié"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PALIERS DE QUANTITÉ */}
      {activeTab === 'tiers' && (
        <div>
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
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Ajouter un palier de prix sur volume</h3>
              <form onSubmit={handleAddTier}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Produit concerné *
                    </label>
                    <select
                      value={tierProductId}
                      onChange={(e) => setTierProductId(e.target.value)}
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
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Quantité minimale (seuil) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={tierMinQty}
                      onChange={(e) => setTierMinQty(e.target.value)}
                      placeholder="Ex: 10"
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Prix unitaire au palier (XOF) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={tierPrice}
                      onChange={(e) => setTierPrice(e.target.value)}
                      placeholder="Prix réduit"
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" disabled={submitting} className="primary">
                    {submitting ? 'Enregistrement...' : 'Enregistrer le palier'}
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
                placeholder="Rechercher par produit..."
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Chargement des paliers de quantité...
            </div>
          ) : filteredTiers.length === 0 ? (
            tiers.length === 0 ? (
              <EmptyState
                title="Aucun palier de volume défini"
                description="Configurez des remises sur quantité pour encourager les achats en gros."
                action={{
                  label: '+ Ajouter un premier palier',
                  onClick: () => setShowForm(true),
                }}
              />
            ) : (
              <EmptyState
                title="Aucun résultat"
                description={`Aucun palier ne correspond à « ${search} ».`}
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
                    <th>Article / Produit</th>
                    <th>À partir de (Quantité)</th>
                    <th style={{ textAlign: 'right' }}>Prix unitaire réduit</th>
                    <th style={{ textAlign: 'right', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTiers.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{productName(t.productId)}</span>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontWeight: 600 }}>
                          ≥ {t.minQuantity} unités
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                          {Number(t.price).toLocaleString('fr-FR')} XOF
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteTier(t.id)}
                          className="danger"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.74rem' }}
                          title="Supprimer ce palier de quantité"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

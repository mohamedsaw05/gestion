import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, fetchBlob } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';

type Customer = { id: string; name: string; phone?: string };
type Location = { id: string; name: string };
type Product = { id: string; name: string; basePrice: string; type: string };
type Movement = { id: string; kind: string; amount: string; currency: string; paymentMethod: string; receiptNumber?: string | null; createdAt: string };
type Purchase = { id: string; reference: string; status: string; locationId: string; customerId: string; customer?: Customer | null; productId?: string | null; productNameSnapshot?: string | null; productPriceSnapshot?: string | null; currency: string; availableBalance: string; createdAt: string; movements: Movement[] };
type Stats = { openCases: number; activeCustomers: number; fundedCases: number; redeemedCases: number; cancelledCases: number; totalDeposits: string; totalRefunds: string; totalAppliedToSales: string; depositsToday: string; availableBalance: string; weeklyDeposits: { date: string; amount: string }[] };

const statusLabels: Record<string, string> = { OPEN: 'En attente de versements', PRODUCT_SELECTED: 'Produit choisi', READY_FOR_PICKUP: 'Financé · prêt au retrait', REDEEMED: 'Remis au client', CANCELLED: 'Annulé', REFUNDED: 'Remboursé' };
const money = (amount: string | number, currency = 'XOF') => `${Number(amount).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${currency === 'XOF' ? 'FCFA' : currency}`;

export function ProgressivePurchasesPage() {
  const { showToast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('CASH');
  const [depositReference, setDepositReference] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async (search = query) => {
    setLoading(true);
    try {
      const [rows, summary] = await Promise.all([
        api.get<Purchase[]>(`/progressive-purchases${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`),
        api.get<Stats>(`/progressive-purchases/stats${fromDate || toDate ? `?${new URLSearchParams({ ...(fromDate ? { from: fromDate } : {}), ...(toDate ? { to: toDate } : {}) })}` : ''}`),
      ]);
      setPurchases(rows); setStats(summary);
      if (selected) setSelected(rows.find((row) => row.id === selected.id) ?? null);
    } catch (error) { showToast(error instanceof ApiError ? error.message : 'Chargement impossible', 'error'); }
    finally { setLoading(false); }
  }, [query, selected, showToast, fromDate, toDate]);

  useEffect(() => {
    void reload('');
    api.get<Customer[]>('/customers').then(setCustomers).catch(() => {});
    api.get<Location[]>('/locations').then((rows) => { setLocations(rows); if (rows[0]) setLocationId(rows[0].id); }).catch(() => {});
    api.get<Product[]>('/products').then(setProducts).catch(() => {});
  }, []);

  useEffect(() => { void reload(query); }, [fromDate, toDate]);

  const series = useMemo(() => {
    const totals = (stats?.weeklyDeposits ?? []).map((item) => ({ label: new Date(`${item.date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }), total: Number(item.amount) }));
    const max = Math.max(1, ...totals.map((item) => item.total));
    return totals.map((item) => ({ ...item, height: Math.max(6, item.total / max * 100) }));
  }, [stats?.weeklyDeposits]);

  const act = async (operation: () => Promise<unknown>, message: string) => {
    try { await operation(); showToast(message, 'success'); await reload(); }
    catch (error) { showToast(error instanceof ApiError ? error.message : 'Opération impossible', 'error'); }
  };

  const createCase = async (event: FormEvent) => {
    event.preventDefault();
    await act(() => api.post('/progressive-purchases', { locationId, customerId, notes }), 'Dossier ouvert');
    setShowCreate(false); setCustomerId(''); setNotes('');
  };

  const recordDeposit = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    const operationId = crypto.randomUUID();
    await act(() => api.post(`/progressive-purchases/${selected.id}/deposits`, { operationId, amount: depositAmount, method: depositMethod, reference: depositReference || undefined }), 'Versement enregistré — reçu individuel disponible');
    setDepositAmount(''); setDepositReference('');
  };

  const printReceipt = async (movement: Movement) => {
    try { const blob = await fetchBlob(`/progressive-purchases/receipts/${movement.id}/pdf`); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    catch (error) { showToast(error instanceof ApiError ? error.message : 'Téléchargement du reçu impossible', 'error'); }
  };

  return <div className="progressive-purchases-page">
    <PageHeader title="Versements progressifs" subtitle="Accumulez les versements d’un client avant son achat. Le chiffre d’affaires et le stock ne changent qu’à la vente réelle au retrait." primaryAction={{ label: showCreate ? 'Fermer' : '+ Ouvrir un dossier', onClick: () => setShowCreate((value) => !value) }} />

    <section className="dashboard-metrics" aria-label="Résumé des versements progressifs">
      {[
        ['Dossiers ouverts', stats?.openCases ?? '—'], ['Clients actifs', stats?.activeCustomers ?? '—'],
        ['Versements du jour', stats ? money(stats.depositsToday) : '—'], ['Total des versements', stats ? money(stats.totalDeposits) : '—'],
        ['Disponible sur les dossiers', stats ? money(stats.availableBalance) : '—'], ['Financés / à retirer', stats?.fundedCases ?? '—'],
        ['Remis / vendus', stats?.redeemedCases ?? '—'], ['Remboursés', stats ? money(stats.totalRefunds) : '—'],
      ].map(([label, value]) => <article className="dashboard-section" key={label}><span className="text-muted">{label}</span><strong style={{ display: 'block', fontSize: '1.25rem', marginTop: 8 }}>{value}</strong></article>)}
    </section>

    <section className="dashboard-section" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><h2 style={{ marginTop: 0, flex: 1 }}>Évolution des versements · 7 derniers jours</h2><label>Du <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>Au <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label><button className="btn btn-secondary" onClick={() => { setFromDate(''); setToDate(''); }}>Réinitialiser</button></div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', height: 120 }}>{series.map((day) => <div key={day.label} style={{ flex: 1, textAlign: 'center' }}><div title={money(day.total)} style={{ height: `${day.height}px`, minHeight: 6, background: '#4f46e5', borderRadius: '6px 6px 0 0' }} /><small>{day.label}</small></div>)}</div>
      <small className="text-muted">Totaux journaliers calculés côté serveur à partir du grand livre complet.</small>
    </section>

    {showCreate && <form className="dashboard-section" onSubmit={(event) => void createCase(event)} style={{ marginTop: 16, display: 'grid', gap: 12, maxWidth: 620 }}>
      <h2 style={{ margin: 0 }}>Nouveau dossier client</h2>
      <label>Boutique<select required value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Choisir une boutique</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
      <label>Client<select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Choisir un client existant</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}</select></label>
      <label>Note (facultative)<input value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} /></label>
      <button className="btn btn-primary" disabled={!locationId || !customerId}>Ouvrir le dossier</button>
    </form>}

    <section className="dashboard-section" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Dossiers et historique</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><select aria-label="Filtrer par statut" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Tous les statuts</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><form onSubmit={(event) => { event.preventDefault(); void reload(query); }} style={{ display: 'flex', gap: 8 }}><input aria-label="Recherche dossier" placeholder="Client, téléphone, reçu, produit…" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="btn btn-secondary">Rechercher</button></form></div>
      </div>
      {loading ? <p>Chargement…</p> : <div style={{ overflowX: 'auto', marginTop: 12 }}><table className="data-table"><thead><tr><th>Référence</th><th>Client</th><th>Produit</th><th>Cumul disponible</th><th>État</th><th>Ouvert le</th><th></th></tr></thead><tbody>
        {purchases.filter((purchase) => statusFilter === 'ALL' || purchase.status === statusFilter).map((purchase) => <tr key={purchase.id}><td><strong>{purchase.reference}</strong></td><td>{purchase.customer?.name ?? 'Client' }<small style={{ display: 'block' }}>{purchase.customer?.phone}</small></td><td>{purchase.productNameSnapshot || 'À choisir'}</td><td>{money(purchase.availableBalance, purchase.currency)}</td><td><span className="badge badge-info">{statusLabels[purchase.status] ?? purchase.status}</span></td><td>{new Date(purchase.createdAt).toLocaleDateString('fr-FR')}</td><td><button className="btn btn-secondary" onClick={() => setSelected(purchase)}>Ouvrir</button></td></tr>)}
        {!purchases.length && <tr><td colSpan={7}>Aucun dossier correspondant.</td></tr>}
      </tbody></table></div>}
    </section>

    {selected && <div role="dialog" aria-modal="true" aria-label={`Dossier ${selected.reference}`} className="modal-overlay" onClick={() => setSelected(null)}><section className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div><h2 style={{ margin: 0 }}>{selected.reference}</h2><p>{selected.customer?.name} · {selected.customer?.phone || 'Téléphone non renseigné'}</p></div><button className="btn btn-secondary" onClick={() => setSelected(null)}>Fermer</button></header>
      <p><strong>Solde disponible :</strong> {money(selected.availableBalance, selected.currency)} · <strong>Statut :</strong> {statusLabels[selected.status] ?? selected.status}</p>
      {!['REDEEMED', 'CANCELLED', 'REFUNDED'].includes(selected.status) && <form onSubmit={(event) => void recordDeposit(event)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 12, background: 'var(--surface-subtle, #f8fafc)', borderRadius: 8 }}><input required type="number" min="1" step="1" placeholder="Montant du versement" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} /><select value={depositMethod} onChange={(event) => setDepositMethod(event.target.value)}><option value="CASH">Espèces</option><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK_TRANSFER">Virement</option><option value="CARD">Carte</option><option value="CHECK">Chèque</option></select>{depositMethod === 'MOBILE_MONEY' && <input required placeholder="Référence transaction" value={depositReference} onChange={(event) => setDepositReference(event.target.value)} />}<button className="btn btn-primary">Enregistrer le versement</button></form>}
      {!['REDEEMED', 'CANCELLED', 'REFUNDED'].includes(selected.status) && <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><select aria-label="Produit catalogue" id="progressive-product"><option value="">Choisir un produit réel</option>{products.filter((product) => product.type !== 'SERVICE').map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.basePrice, selected.currency)}</option>)}</select><button className="btn btn-secondary" onClick={() => { const select = document.getElementById('progressive-product') as HTMLSelectElement; if (select.value) void act(() => api.post(`/progressive-purchases/${selected.id}/product`, { productId: select.value }), 'Produit et prix catalogue enregistrés'); }}>Enregistrer le produit</button>
        {selected.status === 'READY_FOR_PICKUP' && <button className="btn btn-primary" onClick={() => void act(() => api.post(`/progressive-purchases/${selected.id}/redeem`), 'Vente créée, stock décrémenté et retrait enregistré')}>Vérifier et remettre le produit</button>}
        <form onSubmit={(event) => { event.preventDefault(); if (refundAmount) void act(() => api.post(`/progressive-purchases/${selected.id}/refunds`, { operationId: crypto.randomUUID(), amount: refundAmount, method: refundMethod }), 'Remboursement tracé'); setRefundAmount(''); }} style={{ display: 'flex', gap: 6 }}><input type="number" min="1" step="1" placeholder="Montant à rembourser" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} /><select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}><option value="CASH">Espèces</option><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK_TRANSFER">Virement</option><option value="CARD">Carte</option><option value="CHECK">Chèque</option></select><button className="btn btn-secondary">Rembourser</button></form>
        <button className="btn btn-secondary" onClick={() => void act(() => api.post(`/progressive-purchases/${selected.id}/cancel`), 'Dossier annulé')}>Annuler le dossier (solde nul requis)</button></div>}
      <h3>Historique des mouvements</h3><div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Date et heure</th><th>Opération</th><th>Montant</th><th>Mode</th><th>Référence / reçu</th><th></th></tr></thead><tbody>{selected.movements.map((movement) => <tr key={movement.id}><td>{new Date(movement.createdAt).toLocaleString('fr-FR')}</td><td>{movement.kind === 'DEPOSIT' ? 'Versement' : movement.kind === 'APPLIED' ? 'Affecté à la vente' : 'Remboursement'}</td><td>{money(movement.amount, movement.currency)}</td><td>{movement.paymentMethod}</td><td>{movement.receiptNumber || '—'}</td><td>{movement.receiptNumber && <button className="btn btn-secondary" onClick={() => void printReceipt(movement)}>Imprimer / télécharger</button>}</td></tr>)}</tbody></table></div>
    </section></div>}
  </div>;
}

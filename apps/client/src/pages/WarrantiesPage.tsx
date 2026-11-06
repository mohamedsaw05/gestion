import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';

type Product = { id: string; name: string; sku: string; basePrice: string; type?: string; categoryId?: string | null; brand?: string | null };
type Customer = { id: string; name: string; phone?: string | null };
type Location = { id: string; name: string };
type Warranty = {
  id: string; reference: string; productId: string; productNameSnapshot: string; locationId?: string | null;
  customerId?: string | null; customerNameSnapshot?: string | null; customerPhoneSnapshot?: string | null;
  invoiceNumberSnapshot?: string | null; durationMonthsSnapshot: number; warrantyTypeSnapshot: string;
  termsSnapshot?: string | null; exclusionsSnapshot?: string | null; serialNumber?: string | null; lotNumber?: string | null;
  identifiers?: { type: string; value: string }[]; notes?: string | null; startDate: string; expiresAt: string;
  status: string; effectiveStatus: string; claimNotes?: string | null; claimedAt?: string | null; createdAt: string;
};
type WarrantyConfig = {
  defaultDurationMonths: number; allowedDurations: number[]; defaultType: string; types: string[];
  terms: string; exclusions: string; alertDays: number[]; requiredDocuments: string[];
  handlingModes: string[]; timeZone: string; categoryPolicies?: Record<string, { durationMonths?: number; type?: string; terms?: string; exclusions?: string }>;
};
type WarrantyStats = { total: number; active: number; expiringSoon: number; expired: number; claimed: number; inRepair: number; closed: number };

const labels: Record<string, string> = { ACTIVE: 'Active', EXPIRING_SOON: 'Échéance proche', EXPIRED: 'Expirée', CLAIMED: 'Réclamation ouverte', IN_REPAIR: 'En réparation', CLOSED: 'Clôturée', VOID: 'Annulée' };
const statusColors: Record<string, string> = { ACTIVE: '#15803d', EXPIRING_SOON: '#b45309', EXPIRED: '#b91c1c', CLAIMED: '#1d4ed8', IN_REPAIR: '#6d28d9', CLOSED: '#64748b', VOID: '#64748b' };
const fmtDate = (value: string, timeZone: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value));

export function WarrantiesPage() {
  const { addToast } = useToast();
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [config, setConfig] = useState<WarrantyConfig | null>(null);
  const [stats, setStats] = useState<WarrantyStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState<Warranty | null>(null);
  const [claimNotes, setClaimNotes] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickProductOpen, setQuickProductOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [clientMode, setClientMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [durationMonths, setDurationMonths] = useState('12');
  const [warrantyType, setWarrantyType] = useState('STANDARD');
  const [serialNumber, setSerialNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [saleId, setSaleId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [identifiers, setIdentifiers] = useState<Array<{ type: string; value: string }>>([]);

  const [quickName, setQuickName] = useState('');
  const [quickSku, setQuickSku] = useState('');
  const [quickPrice, setQuickPrice] = useState('0');
  const [quickUnit, setQuickUnit] = useState('pièce');

  const reload = useCallback(async (search = query) => {
    setLoading(true);
    try {
      const [rows, summary] = await Promise.all([
        api.get<Warranty[]>(`/warranties${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`),
        api.get<WarrantyStats>('/warranties/stats'),
      ]);
      setWarranties(rows); setStats(summary);
      if (selected) setSelected(rows.find((row) => row.id === selected.id) ?? null);
    } catch (error) { addToast(error instanceof ApiError ? error.message : 'Chargement des garanties impossible', 'error'); }
    finally { setLoading(false); }
  }, [query, selected, addToast]);

  useEffect(() => {
    void reload('');
    api.get<WarrantyConfig>('/warranties/configuration').then((value) => {
      setConfig(value); setDurationMonths(String(value.defaultDurationMonths)); setWarrantyType(value.defaultType); setTerms(value.terms);
    }).catch(() => {});
    api.get<Product[]>('/products').then(setProducts).catch(() => {});
    api.get<Customer[]>('/customers').then(setCustomers).catch(() => {});
    api.get<Location[]>('/locations').then((rows) => { setLocations(rows); if (rows[0]) setLocationId(rows[0].id); }).catch(() => {});
  }, []);

  const selectedProduct = products.find((product) => product.id === productId);
  const filtered = useMemo(() => warranties.filter((warranty) => statusFilter === 'ALL' || warranty.effectiveStatus === statusFilter || warranty.status === statusFilter), [warranties, statusFilter]);
  const totalBars = Math.max(1, stats?.total ?? 0);

  const resetForm = () => {
    setProductId(''); setCustomerId(''); setCustomerName(''); setCustomerPhone(''); setSerialNumber(''); setLotNumber('');
    setSaleId(''); setInvoiceNumber(''); setNotes(''); setIdentifiers([]);
    if (config) { setDurationMonths(String(config.defaultDurationMonths)); setWarrantyType(config.defaultType); setTerms(config.terms); }
  };

  const createWarranty = async (event: FormEvent) => {
    event.preventDefault();
    if (!productId || !locationId || (clientMode === 'EXISTING' && !customerId) || (clientMode === 'NEW' && !customerName.trim())) {
      addToast('Choisissez le produit, la boutique et le client.', 'error'); return;
    }
    setSaving(true);
    try {
      const warranty = await api.post<Warranty>('/warranties', {
        productId, locationId, customerId: clientMode === 'EXISTING' ? customerId : undefined,
        customerName: clientMode === 'NEW' ? customerName.trim() : undefined,
        customerPhone: clientMode === 'NEW' ? customerPhone.trim() : customers.find((item) => item.id === customerId)?.phone || undefined,
        saleId: saleId.trim() || undefined, invoiceNumber: invoiceNumber.trim() || undefined,
        durationMonths: Number(durationMonths), warrantyType, serialNumber: serialNumber.trim() || undefined,
        lotNumber: lotNumber.trim() || undefined, terms: terms.trim() || undefined, notes: notes.trim() || undefined,
        identifiers: identifiers.filter((item) => item.type.trim() && item.value.trim()),
      });
      setWarranties((items) => [warranty, ...items]); setSelected(warranty); setCreateOpen(false); resetForm();
      showSuccess('Garantie enregistrée. Le début et l’échéance ont été calculés par le serveur.');
      await reload('');
    } catch (error) { addToast(error instanceof ApiError ? error.message : 'Création de la garantie impossible', 'error'); }
    finally { setSaving(false); }
  };

  const showSuccess = (message: string) => addToast(message, 'success');

  const saveConfiguration = async (event: FormEvent) => {
    event.preventDefault(); if (!config) return;
    setSaving(true);
    const toInts = (value: string) => value.split(',').map((item) => Number(item.trim())).filter(Number.isFinite);
    const toLines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
    try {
      const saved = await api.put<any>('/warranties/configuration', {
        defaultDurationMonths: config.defaultDurationMonths, allowedDurations: config.allowedDurations,
        defaultType: config.defaultType, types: config.types, terms: config.terms, exclusions: config.exclusions,
        alertDays: config.alertDays, requiredDocuments: config.requiredDocuments,
        handlingModes: config.handlingModes, timeZone: config.timeZone,
      });
      setConfig(saved.config ? { ...config, ...saved.config } : { ...config, ...saved });
      showSuccess('Configuration des garanties enregistrée en base.');
    } catch (error) { addToast(error instanceof ApiError ? error.message : 'Enregistrement de la configuration impossible', 'error'); }
    finally { setSaving(false); }
    void toInts; void toLines;
  };

  const updateWarranty = async (path: 'claim' | 'repair' | 'close') => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.post<Warranty>(`/warranties/${selected.id}/${path}`, { notes: claimNotes.trim() || undefined });
      setSelected(updated); setClaimNotes(''); showSuccess(path === 'claim' ? 'Réclamation enregistrée' : path === 'repair' ? 'Garantie passée en réparation' : 'Dossier de garantie clôturé');
      await reload();
    } catch (error) { addToast(error instanceof ApiError ? error.message : 'Mise à jour impossible', 'error'); }
    finally { setSaving(false); }
  };

  const createQuickProduct = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      const product = await api.post<Product>('/products', { sku: quickSku.trim(), name: quickName.trim(), unit: quickUnit.trim() || 'pièce', basePrice: quickPrice || '0', type: 'PHYSICAL', isStocked: false });
      setProducts((items) => [product, ...items]); setProductId(product.id); setQuickProductOpen(false);
      setQuickName(''); setQuickSku(''); setQuickPrice('0'); showSuccess('Produit créé dans le catalogue et sélectionné pour la garantie.');
    } catch (error) { addToast(error instanceof ApiError ? error.message : 'Création du produit impossible', 'error'); }
    finally { setSaving(false); }
  };

  return <div className="warranties-page">
    <PageHeader title="Garanties & Après-vente" subtitle="Enregistrez les garanties à l’heure serveur, suivez les échéances et traitez les réclamations jusqu’à leur clôture." primaryAction={{ label: createOpen ? 'Fermer' : '+ Enregistrer une garantie', onClick: () => setCreateOpen((value) => !value) }} />

    <section className="dashboard-metrics" aria-label="Indicateurs de garantie">
      {[
        ['Garanties suivies', stats?.total ?? '—', '#334155'], ['Actives', stats?.active ?? '—', '#15803d'],
        ['Expiration proche', stats?.expiringSoon ?? '—', '#b45309'], ['Expirées', stats?.expired ?? '—', '#b91c1c'],
        ['Réclamations', stats?.claimed ?? '—', '#1d4ed8'], ['En réparation', stats?.inRepair ?? '—', '#6d28d9'], ['Clôturées', stats?.closed ?? '—', '#64748b'],
      ].map(([label, value, color]) => <article className="dashboard-section" key={label}><span className="text-muted">{label}</span><strong style={{ display: 'block', fontSize: '1.3rem', color: String(color), marginTop: 8 }}>{value}</strong></article>)}
    </section>
    <section className="dashboard-section" style={{ marginTop: 14 }}><h2 style={{ marginTop: 0 }}>Répartition des garanties</h2>{[['Actives', stats?.active], ['Échéance proche', stats?.expiringSoon], ['Expirées', stats?.expired], ['En traitement', (stats?.claimed ?? 0) + (stats?.inRepair ?? 0)]].map(([label, value]) => <div key={String(label)} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 50px', gap: 10, alignItems: 'center', margin: '8px 0' }}><small>{label}</small><div style={{ height: 10, background: '#e2e8f0', borderRadius: 99 }}><div style={{ width: `${Math.min(100, Number(value || 0) / totalBars * 100)}%`, height: '100%', background: '#4f46e5', borderRadius: 99 }} /></div><small>{value ?? 0}</small></div>)}</section>

    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button className="btn btn-secondary" onClick={() => setSettingsOpen((value) => !value)}>{settingsOpen ? 'Fermer la configuration' : '⚙️ Paramètres de garantie'}</button></div>
    {settingsOpen && config && <form className="dashboard-section" onSubmit={(event) => void saveConfiguration(event)} style={{ marginTop: 12, display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Configuration des garanties</h2><p>Ces paramètres sont enregistrés par organisation et alimentent les formulaires et les alertes.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
        <label>Durée par défaut (mois)<input type="number" min="1" max="120" value={config.defaultDurationMonths} onChange={(e) => setConfig({ ...config, defaultDurationMonths: Number(e.target.value) })} /></label>
        <label>Durées proposées (mois)<input value={config.allowedDurations.join(', ')} onChange={(e) => setConfig({ ...config, allowedDurations: e.target.value.split(',').map((n) => Number(n.trim())).filter(Number.isFinite) })} /></label>
        <label>Type par défaut<select value={config.defaultType} onChange={(e) => setConfig({ ...config, defaultType: e.target.value })}>{config.types.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Types disponibles (une ligne par type)<textarea value={config.types.join('\n')} onChange={(e) => setConfig({ ...config, types: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></label>
        <label>Alertes avant échéance (jours)<input value={config.alertDays.join(', ')} onChange={(e) => setConfig({ ...config, alertDays: e.target.value.split(',').map((n) => Number(n.trim())).filter(Number.isFinite) })} /></label>
        <label>Fuseau horaire<input value={config.timeZone} onChange={(e) => setConfig({ ...config, timeZone: e.target.value })} /></label>
      </div>
      <label>Conditions<textarea value={config.terms} onChange={(e) => setConfig({ ...config, terms: e.target.value })} /></label>
      <label>Exclusions<textarea value={config.exclusions} onChange={(e) => setConfig({ ...config, exclusions: e.target.value })} /></label>
      <label>Documents exigés (une ligne par document)<textarea value={config.requiredDocuments.join('\n')} onChange={(e) => setConfig({ ...config, requiredDocuments: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></label>
      <label>Modes de prise en charge (une ligne par mode)<textarea value={config.handlingModes.join('\n')} onChange={(e) => setConfig({ ...config, handlingModes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></label>
      <button className="btn btn-primary" disabled={saving}>Enregistrer les paramètres</button>
    </form>}

    {createOpen && <form className="dashboard-section" onSubmit={(event) => void createWarranty(event)} style={{ marginTop: 14, display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Nouvelle fiche de garantie</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        <label>Produit catalogue<select required value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Rechercher et choisir</option>{products.filter((p) => !p.type || p.type !== 'SERVICE').map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>
        <button type="button" className="btn btn-secondary" onClick={() => setQuickProductOpen(true)}>Créer un produit maintenant</button>
        <label>Boutique<select required value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">Choisir</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>Client<select value={clientMode} onChange={(e) => setClientMode(e.target.value as 'EXISTING' | 'NEW')}><option value="EXISTING">Client existant</option><option value="NEW">Nouveau client</option></select></label>
        {clientMode === 'EXISTING' ? <label>Client<select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Choisir un client</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}</select></label> : <><label>Nom du client<input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></label><label>Téléphone<input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></label></>}
        <label>Durée<select value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)}>{(config?.allowedDurations ?? [1, 3, 6, 12, 24]).map((months) => <option key={months} value={months}>{months} mois</option>)}</select></label>
        <label>Type<select value={warrantyType} onChange={(e) => setWarrantyType(e.target.value)}>{(config?.types ?? ['STANDARD']).map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>N° de série / IMEI<input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} /></label>
        <label>N° de lot<input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} /></label>
        <label>Référence de vente (optionnelle)<input value={saleId} onChange={(e) => setSaleId(e.target.value)} placeholder="UUID vente existante" /></label>
        <label>N° de facture (optionnel)<input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></label>
      </div>
      <label>Conditions<textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></label>
      <label>Observations<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>Autres identifiants</strong><button type="button" className="btn btn-secondary" onClick={() => setIdentifiers((items) => [...items, { type: '', value: '' }])}>+ Ajouter</button></div>{identifiers.map((item, index) => <div key={index} style={{ display: 'flex', gap: 8, marginTop: 6 }}><input aria-label="Type identifiant" placeholder="Ex. IMEI, fabricant" value={item.type} onChange={(e) => setIdentifiers((items) => items.map((row, i) => i === index ? { ...row, type: e.target.value } : row))} /><input aria-label="Valeur identifiant" placeholder="Valeur" value={item.value} onChange={(e) => setIdentifiers((items) => items.map((row, i) => i === index ? { ...row, value: e.target.value } : row))} /><button type="button" onClick={() => setIdentifiers((items) => items.filter((_, i) => i !== index))}>Retirer</button></div>)}</div>
      {selectedProduct && <p className="text-muted">Produit choisi : {selectedProduct.name} · Référence {selectedProduct.sku}. La garantie démarrera au moment de l’enregistrement serveur.</p>}
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la garantie'}</button>
    </form>}

    <section className="dashboard-section" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><h2 style={{ margin: 0 }}>Registre des garanties</h2><div style={{ display: 'flex', gap: 8 }}><select aria-label="Filtrer statut garantie" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">Tous les statuts</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><form onSubmit={(e) => { e.preventDefault(); void reload(query); }} style={{ display: 'flex', gap: 6 }}><input placeholder="Référence, produit, client, série…" value={query} onChange={(e) => setQuery(e.target.value)} /><button className="btn btn-secondary">Rechercher</button></form></div></div>
      {loading ? <p>Chargement…</p> : <div style={{ overflowX: 'auto', marginTop: 12 }}><table className="data-table"><thead><tr><th>Référence</th><th>Produit / identifiant</th><th>Client</th><th>Début</th><th>Expiration</th><th>Durée</th><th>Statut</th><th></th></tr></thead><tbody>{filtered.map((warranty) => <tr key={warranty.id}><td><strong>{warranty.reference}</strong></td><td>{warranty.productNameSnapshot}<small style={{ display: 'block' }}>{warranty.serialNumber ? `Série ${warranty.serialNumber}` : warranty.lotNumber ? `Lot ${warranty.lotNumber}` : ''}</small></td><td>{warranty.customerNameSnapshot || '—'}<small style={{ display: 'block' }}>{warranty.customerPhoneSnapshot}</small></td><td>{fmtDate(warranty.startDate, config?.timeZone || 'Africa/Ouagadougou')}</td><td>{fmtDate(warranty.expiresAt, config?.timeZone || 'Africa/Ouagadougou')}</td><td>{warranty.durationMonthsSnapshot} mois</td><td><span style={{ color: statusColors[warranty.effectiveStatus] || '#334155', fontWeight: 700 }}>{labels[warranty.effectiveStatus] || warranty.effectiveStatus}</span></td><td><button className="btn btn-secondary" onClick={() => setSelected(warranty)}>Fiche</button></td></tr>)}{!filtered.length && <tr><td colSpan={8}>Aucune garantie correspondant aux critères.</td></tr>}</tbody></table></div>}
    </section>

    {quickProductOpen && <div className="modal-overlay" role="dialog" aria-modal="true"><form className="modal-content" onSubmit={(event) => void createQuickProduct(event)} style={{ maxWidth: 560, display: 'grid', gap: 10 }}><h2>Créer un produit et revenir à la garantie</h2><label>Nom<input required value={quickName} onChange={(e) => setQuickName(e.target.value)} /></label><label>Référence SKU<input required value={quickSku} onChange={(e) => setQuickSku(e.target.value)} /></label><label>Prix catalogue<input required type="number" min="0" step="1" value={quickPrice} onChange={(e) => setQuickPrice(e.target.value)} /></label><label>Unité<input required value={quickUnit} onChange={(e) => setQuickUnit(e.target.value)} /></label><div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary" disabled={saving}>Créer et sélectionner</button><button type="button" className="btn btn-secondary" onClick={() => setQuickProductOpen(false)}>Annuler</button></div></form></div>}

    {selected && <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelected(null)}><section className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760, maxHeight: '90vh', overflowY: 'auto' }}><header style={{ display: 'flex', justifyContent: 'space-between' }}><div><h2 style={{ margin: 0 }}>{selected.reference}</h2><p>{selected.productNameSnapshot} · {selected.customerNameSnapshot}</p></div><button className="btn btn-secondary" onClick={() => setSelected(null)}>Fermer</button></header><dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}><div><dt>Début exact</dt><dd>{fmtDate(selected.startDate, config?.timeZone || 'Africa/Ouagadougou')}</dd></div><div><dt>Expiration</dt><dd>{fmtDate(selected.expiresAt, config?.timeZone || 'Africa/Ouagadougou')}</dd></div><div><dt>Client</dt><dd>{selected.customerNameSnapshot} · {selected.customerPhoneSnapshot}</dd></div><div><dt>Produit / lot / série</dt><dd>{selected.productNameSnapshot} · {selected.serialNumber || selected.lotNumber || '—'}</dd></div><div><dt>Facture</dt><dd>{selected.invoiceNumberSnapshot || '—'}</dd></div><div><dt>Type / durée</dt><dd>{selected.warrantyTypeSnapshot} · {selected.durationMonthsSnapshot} mois</dd></div><div><dt>Conditions</dt><dd>{selected.termsSnapshot || '—'}</dd></div><div><dt>Exclusions</dt><dd>{selected.exclusionsSnapshot || '—'}</dd></div><div><dt>Identifiants supplémentaires</dt><dd>{selected.identifiers?.map((item) => `${item.type}: ${item.value}`).join(' · ') || '—'}</dd></div><div><dt>Statut</dt><dd>{labels[selected.effectiveStatus] || selected.effectiveStatus}</dd></div><div><dt>Observations / réclamation</dt><dd>{selected.claimNotes || selected.notes || '—'}</dd></div></dl><label>Note de suivi<textarea value={claimNotes} onChange={(e) => setClaimNotes(e.target.value)} /></label><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>{selected.status === 'ACTIVE' && selected.effectiveStatus !== 'EXPIRED' && <button className="btn btn-primary" disabled={saving} onClick={() => void updateWarranty('claim')}>Ouvrir une réclamation</button>}{selected.status === 'CLAIMED' && <button className="btn btn-primary" disabled={saving} onClick={() => void updateWarranty('repair')}>Passer en réparation</button>}{['CLAIMED', 'IN_REPAIR'].includes(selected.status) && <button className="btn btn-secondary" disabled={saving} onClick={() => void updateWarranty('close')}>Clôturer le dossier</button>}<button className="btn btn-secondary" onClick={() => window.print()}>Imprimer la fiche</button></div></section></div>}
  </div>;
}

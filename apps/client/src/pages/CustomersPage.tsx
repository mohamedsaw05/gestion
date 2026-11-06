import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, fetchBlob, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination } from '../components/Pagination';

interface CreditAccountSummary {
  balance: string;
  creditLimit: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt?: string;
  creditAccount?: CreditAccountSummary | null;
}

interface CustomerDetail extends Customer {
  creditAccount?: {
    balance: string;
    creditLimit: string;
    movements: {
      id: string;
      movementType: string;
      amount: string;
      resultingBalance: string;
      notes: string | null;
      createdAt: string;
    }[];
  } | null;
  sales: {
    id: string;
    total: string;
    status: string;
    createdAt: string;
    receiptNumber: string | null;
  }[];
}

interface ImportPreview {
  dryRun: boolean;
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: { row: number; reason: string; raw: string }[];
  preview?: { name: string; phone?: string; email?: string }[];
}

export function CustomersPage() {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Creation form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit modal state
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Details drawer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Statement PDF state (Section 7 CDC)
  const [statementFromDate, setStatementFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [statementToDate, setStatementToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  const handleDownloadStatement = async (customerId: string, from: string, to: string) => {
    setDownloadingStatement(true);
    try {
      const blob = await fetchBlob(`/customers/${customerId}/statement/pdf?from=${from}&to=${to}`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      addToast('Relevé de compte client téléchargé avec succès.', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors du téléchargement du relevé', 'error');
    } finally {
      setDownloadingStatement(false);
    }
  };

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [merging, setMerging] = useState(false);

  // CSV Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvContent, setImportCsvContent] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);

  // Delete/Archive confirmation
  const [customerToArchive, setCustomerToArchive] = useState<Customer | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get<Customer[]>('/customers')
      .then(setCustomers)
      .catch((e) => {
        addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des clients', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = (id: string) => {
    setSelectedCustomerId(id);
    setDetailLoading(true);
    api
      .get<CustomerDetail>(`/customers/${id}`)
      .then(setCustomerDetail)
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement du profil client', 'error'))
      .finally(() => setDetailLoading(false));
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/customers', {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      addToast(`Client « ${name.trim()} » créé avec succès.`, 'success');
      setName('');
      setPhone('');
      setEmail('');
      setShowForm(false);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la création du client', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.name);
    setEditPhone(c.phone || '');
    setEditEmail(c.email || '');
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await api.put(`/customers/${editingCustomer.id}`, {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
      });
      addToast(`Coordonnées du client mises à jour.`, 'success');
      setEditingCustomer(null);
      load();
      if (selectedCustomerId === editingCustomer.id) {
        loadDetail(editingCustomer.id);
      }
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de mise à jour', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleArchive = async () => {
    if (!customerToArchive) return;
    try {
      await api.delete(`/customers/${customerToArchive.id}`);
      addToast(`Client « ${customerToArchive.name} » archivé avec succès.`, 'success');
      setCustomerToArchive(null);
      if (selectedCustomerId === customerToArchive.id) setSelectedCustomerId(null);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'archivage", 'error');
    }
  };

  const handleMerge = async (e: FormEvent) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) {
      addToast('Sélectionnez deux contacts différents pour la fusion.', 'error');
      return;
    }
    setMerging(true);
    try {
      const res = await api.post<{ targetCustomerName: string }>('/customers/merge', {
        sourceCustomerId: mergeSourceId,
        targetCustomerId: mergeTargetId,
      });
      addToast(`Contacts fusionnés avec succès dans « ${res.targetCustomerName} ».`, 'success');
      setShowMergeModal(false);
      setMergeSourceId('');
      setMergeTargetId('');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la fusion', 'error');
    } finally {
      setMerging(false);
    }
  };

  const handleDryRunImport = async () => {
    if (!importCsvContent.trim()) {
      addToast('Veuillez coller le contenu du fichier CSV.', 'error');
      return;
    }
    setImporting(true);
    try {
      const res = await api.post<ImportPreview>('/customers/import', {
        csvContent: importCsvContent,
        dryRun: true,
      });
      setImportPreview(res);
      addToast(`Pré-validation effectuée : ${res.validCount} valide(s), ${res.errorCount} erreur(s).`, 'info');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'analyse CSV", 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importCsvContent.trim()) return;
    setImporting(true);
    try {
      const res = await api.post<{ createdCount: number }>('/customers/import', {
        csvContent: importCsvContent,
        dryRun: false,
      });
      addToast(`${res.createdCount} client(s) importé(s) avec succès !`, 'success');
      setShowImportModal(false);
      setImportCsvContent('');
      setImportPreview(null);
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'importation", 'error');
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleCsv = () => {
    const sample = `nom,telephone,email\nAïcha Diallo,+226 70 12 34 56,aicha@example.com\nSociété Faso Commerce,+226 25 30 00 00,contact@faso.bf\nIbrahim Traoré,+226 76 99 88 77,ibrahim@courriel.com`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-import-clients.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  }, [customers, search]);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * 20;
    return filteredCustomers.slice(start, start + 20);
  }, [filteredCustomers, currentPage]);

  const stats = useMemo(() => {
    return {
      total: customers.length,
      withPhone: customers.filter((c) => Boolean(c.phone)).length,
      withCredit: customers.filter((c) => c.creditAccount && Number(c.creditAccount.balance) > 0).length,
    };
  }, [customers]);

  return (
    <div>
      <PageHeader
        title="Répertoire Clients & Dettes"
        subtitle="Gestion centralisée de la clientèle, coordonnées, fusions de doublons et import en masse"
        badges={[{ label: `${customers.length} client${customers.length > 1 ? 's' : ''}`, variant: 'info' }]}
        primaryAction={{
          label: showForm ? 'Fermer le formulaire' : '+ Nouveau client',
          onClick: () => setShowForm((prev) => !prev),
          variant: showForm ? 'secondary' : 'primary',
        }}
        secondaryActions={
          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
            <button type="button" onClick={() => setShowImportModal(true)} className="btn-secondary">
              📥 Importer CSV
            </button>
            <button type="button" onClick={() => setShowMergeModal(true)} className="btn-secondary">
              🔗 Fusionner doublons
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{stats.total}</div>
          <div className="kpi-label">Total Clients Enregistrés</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{stats.withPhone}</div>
          <div className="kpi-label">Avec Téléphone Renseigné</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: stats.withCredit > 0 ? 'var(--primary)' : undefined }}>
            {stats.withCredit}
          </div>
          <div className="kpi-label">Comptes avec Encours / Crédit Dû</div>
        </div>
      </div>

      {/* Formulaire de création rapide */}
      {showForm && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Ajouter un nouveau client</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Nom complet / Raison sociale *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Entreprise Martin ou Aïcha Diallo"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Téléphone (optionnel)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+226 70 00 00 00"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Email (optionnel)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@client.com"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Annuler
              </button>
              <button type="submit" disabled={submitting} className="primary">
                {submitting ? 'Enregistrement...' : 'Enregistrer le client'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Barre d'outils et recherche */}
      <div className="table-toolbar">
        <div className="table-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, email..."
          />
        </div>
      </div>

      {/* Tableau des clients */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Chargement du répertoire clients...
        </div>
      ) : filteredCustomers.length === 0 ? (
        customers.length === 0 ? (
          <EmptyState
            title="Aucun client enregistré"
            description="Votre fichier client est vide pour le moment. Enregistrez vos premiers clients ou importez un fichier CSV pour démarrer."
            action={{
              label: '+ Nouveau client',
              onClick: () => setShowForm(true),
            }}
          />
        ) : (
          <EmptyState
            title="Aucun résultat"
            description={`Aucun client ne correspond à « ${search} ».`}
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
                <th>Client / Raison Sociale</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Encours de Crédit</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((c) => {
                const balanceNum = c.creditAccount ? Number(c.creditAccount.balance) : 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => loadDetail(c.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {c.name}
                      </button>
                    </td>
                    <td>{c.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{c.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      {balanceNum > 0 ? (
                        <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                          Solde dû : {balanceNum.toLocaleString('fr-FR')} XOF
                        </span>
                      ) : (
                        <span className="badge badge-success">À jour</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => loadDetail(c.id)}
                        >
                          👁️ Fiche
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => openEdit(c)}
                        >
                          ✏️ Modifier
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                          onClick={() => setCustomerToArchive(c)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination standard 20 éléments */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredCustomers.length}
            pageSize={20}
            onPageChange={setCurrentPage}
            itemName="clients"
          />
        </div>
      )}

      {/* ── MODAL DÉTAILS DU CLIENT ── */}
      {selectedCustomerId && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '650px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Fiche Client : {customerDetail?.name ?? 'Chargement...'}</h3>
              <button type="button" onClick={() => setSelectedCustomerId(null)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }}>
                ✕
              </button>
            </div>

            {detailLoading || !customerDetail ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Chargement de la fiche client...
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem', background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Téléphone</div>
                    <div style={{ fontWeight: 600 }}>{customerDetail.phone || 'Non renseigné'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email</div>
                    <div style={{ fontWeight: 600 }}>{customerDetail.email || 'Non renseigné'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Solde Crédit / Dette</div>
                    <div style={{ fontWeight: 700, color: Number(customerDetail.creditAccount?.balance ?? 0) > 0 ? 'var(--primary)' : 'var(--color-success)' }}>
                      {Number(customerDetail.creditAccount?.balance ?? 0).toLocaleString('fr-FR')} XOF
                    </div>
                  </div>
                </div>

                <h4 style={{ margin: '1rem 0 0.5rem', fontSize: '0.95rem' }}>Derniers Achats Réalisés ({customerDetail.sales.length})</h4>
                {customerDetail.sales.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Aucune vente enregistrée pour ce client.
                  </div>
                ) : (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Reçu</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerDetail.sales.map((s) => (
                          <tr key={s.id}>
                            <td>{new Date(s.createdAt).toLocaleDateString('fr-FR')}</td>
                            <td>{s.receiptNumber ?? s.id.slice(0, 8)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(s.total).toLocaleString('fr-FR')} XOF</td>
                            <td><span className="badge badge-success">{s.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Section Relevé de compte client officiel (Section 7 CDC) */}
                <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>📄</span> Relevé de compte client officiel (PDF)
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleDownloadStatement(customerDetail.id, statementFromDate, statementToDate)}
                      disabled={downloadingStatement}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem', background: '#ffffff', color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 600 }}
                    >
                      {downloadingStatement ? 'Génération...' : '⬇️ Télécharger le relevé (PDF)'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Date de début</label>
                      <input
                        type="date"
                        value={statementFromDate}
                        onChange={(e) => setStatementFromDate(e.target.value)}
                        style={{ width: '100%', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Date de fin</label>
                      <input
                        type="date"
                        value={statementToDate}
                        onChange={(e) => setStatementToDate(e.target.value)}
                        style={{ width: '100%', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <Link to={`/credit`} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                    💳 Gérer l'encours dans le module Crédit
                  </Link>
                  <button type="button" onClick={() => setSelectedCustomerId(null)} className="primary">
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL ÉDITION DU CLIENT ── */}
      {editingCustomer && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Modifier les coordonnées du client</h3>
            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Nom complet / Raison sociale *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditingCustomer(null)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={savingEdit} className="primary">
                  {savingEdit ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL FUSION DE DOUBLONS ── */}
      {showMergeModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '540px' }}>
            <h3>Fusionner deux contacts doublons</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Le contact source sera absorbé et archivé. Toutes ses ventes et son solde débiteur éventuel
              seront transférés de manière atomique sur le contact cible sans rupture de traçabilité.
            </p>
            <form onSubmit={handleMerge}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Contact source (Doublon à archiver) *
                </label>
                <select
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Sélectionnez le doublon à supprimer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Contact principal (Cible qui conserve l'historique) *
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Sélectionnez le contact principal qui reste...</option>
                  {customers
                    .filter((c) => c.id !== mergeSourceId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowMergeModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={merging || !mergeSourceId || !mergeTargetId}
                  className="primary"
                >
                  {merging ? 'Fusion en cours...' : 'Confirmer la fusion des contacts'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL IMPORTATION CSV ── */}
      {showImportModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '680px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Importer des clients par fichier CSV</h3>
              <button type="button" onClick={downloadSampleCsv} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                📄 Télécharger le modèle CSV
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Collez ci-dessous le contenu textuel de votre fichier CSV avec séparateur virgule ou point-virgule.
              Colonnes attendues : <code>nom, telephone, email</code>.
            </p>

            <textarea
              rows={8}
              value={importCsvContent}
              onChange={(e) => {
                setImportCsvContent(e.target.value);
                setImportPreview(null);
              }}
              placeholder={`nom,telephone,email\nSociété Alpha,+226 70 00 00 01,contact@alpha.bf\nMoussa Ouédraogo,+226 78 12 34 56,moussa@email.com`}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '1rem' }}
            />

            {importPreview && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  background: importPreview.errorCount > 0 ? 'var(--bg-danger-subtle)' : 'var(--bg-success-subtle)',
                  border: '1px solid var(--border)',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <strong>Résultat de la pré-validation :</strong> {importPreview.validCount} ligne(s) valide(s), {importPreview.errorCount} erreur(s) sur {importPreview.totalRows} totale(s).
                </div>
                {importPreview.errors.length > 0 && (
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: 'var(--color-danger)' }}>
                    {importPreview.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>Ligne {err.row} : {err.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowImportModal(false)} className="btn-secondary">
                Fermer
              </button>
              <button
                type="button"
                onClick={handleDryRunImport}
                disabled={importing || !importCsvContent.trim()}
                className="btn-secondary"
              >
                🔍 Tester / Prévisualiser
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={Boolean(importing || !importCsvContent.trim() || (importPreview && importPreview.validCount === 0))}
                className="primary"
              >
                {importing ? 'Importation en cours...' : '🚀 Importer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation d'archivage */}
      {customerToArchive && (
        <ConfirmModal
          isOpen={Boolean(customerToArchive)}
          title="Archiver ce client ?"
          message={`Êtes-vous sûr de vouloir archiver le client « ${customerToArchive.name} » ? Ses transactions passées resteront conservées dans les rapports.`}
          confirmLabel="Archiver le client"
          variant="danger"
          onConfirm={handleArchive}
          onCancel={() => setCustomerToArchive(null)}
        />
      )}
    </div>
  );
}

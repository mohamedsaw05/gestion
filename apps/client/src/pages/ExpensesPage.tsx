import { useEffect, useState, useMemo, useCallback, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ToastContext';
import type { Expense, ExpenseCategory } from '@gestionnaire/shared';

interface ExpenseSummary {
  totalAmount: string;
  totalCount: number;
  categories: Array<{ category: string; totalAmount: string; count: number }>;
}

interface Location {
  id: string;
  name: string;
}

const CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'RENT', label: 'Loyer commercial', icon: '🏢' },
  { value: 'SALARIES', label: 'Salaires & Rémunérations', icon: '💼' },
  { value: 'UTILITIES', label: 'Électricité & Eau', icon: '⚡' },
  { value: 'TRANSPORT', label: 'Transport & Logistique', icon: '🚚' },
  { value: 'SUPPLIES', label: 'Fournitures de bureau & Emballage', icon: '📦' },
  { value: 'MARKETING', label: 'Publicité & Communication', icon: '📢' },
  { value: 'MAINTENANCE', label: 'Entretien & Réparations', icon: '🔧' },
  { value: 'TAXES', label: 'Impôts & Taxes', icon: '⚖️' },
  { value: 'OTHER', label: 'Autres charges diverses', icon: '📝' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces (Caisse)', icon: '💵' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money (Orange/Wave/MTN)', icon: '📱' },
  { value: 'CARD', label: 'Carte Bancaire', icon: '💳' },
  { value: 'BANK_TRANSFER', label: 'Virement Bancaire', icon: '🏦' },
  { value: 'CHECK', label: 'Chèque Bancaire', icon: '🧾' },
];

export function ExpensesPage() {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState('');

  // Détails et Reçu Modal
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Modal création
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('RENT');
  const [description, setDescription] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [locationId, setLocationId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState('MONTHLY');

  // Modal rejet
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Modal suppression
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Chiffre d'Affaires Brut (CA) du mois détecté automatiquement
  const [monthlyGrossRevenue, setMonthlyGrossRevenue] = useState<number>(0);

  // Charger les magasins / emplacements et le CA Brut automatique du mois
  useEffect(() => {
    api.get<Location[]>('/locations')
      .then((locs) => {
        setLocations(locs);
        if (locs.length > 0) setLocationId(locs[0].id);
      })
      .catch(() => {});

    // Détection automatique du CA Brut à partir des ventes réelles du mois
    api.get<Array<{ id: string; createdAt: string; grandTotal: string }>>('/sales')
      .then((sales) => {
        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();
        const thisMonthSales = (sales || []).filter((s) => {
          const d = new Date(s.createdAt);
          return d.getMonth() === curM && d.getFullYear() === curY;
        });
        const totalCA = thisMonthSales.reduce((acc, s) => acc + (Number(s.grandTotal) || 0), 0);
        setMonthlyGrossRevenue(totalCA);
      })
      .catch(() => {});
  }, []);

  const loadExpenses = useCallback((page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      ...(search ? { search } : {}),
      ...(selectedCategory ? { category: selectedCategory } : {}),
      ...(selectedStatus ? { status: selectedStatus } : {}),
      ...(selectedLocation ? { locationId: selectedLocation } : {}),
    });

    Promise.all([
      api.get<{ data: Expense[]; total: number; totalAmount: string }>(`/expenses?${params.toString()}`),
      api.get<ExpenseSummary>('/expenses/summary'),
    ])
      .then(([expRes, sumRes]) => {
        setExpenses(expRes.data);
        setTotalItems(expRes.total);
        setCurrentPage(page);
        setSummary(sumRes);
      })
      .catch((e) => showToast(e instanceof ApiError ? e.message : 'Erreur de chargement des dépenses', 'error'))
      .finally(() => setLoading(false));
  }, [search, selectedCategory, selectedStatus, selectedLocation, showToast]);

  useEffect(() => {
    loadExpenses(1);
  }, [loadExpenses]);

  const handleCreateExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    setSubmitting(true);
    try {
      await api.post('/expenses', {
        amount,
        category,
        description,
        beneficiary: beneficiary || undefined,
        paymentMethod,
        locationId: locationId || undefined,
        isRecurring,
        recurrenceInterval: isRecurring ? recurrenceInterval : undefined,
      });
      showToast('Dépense enregistrée avec succès.', 'success');
      setShowModal(false);
      setAmount('');
      setDescription('');
      setBeneficiary('');
      setIsRecurring(false);
      loadExpenses(1);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur d’enregistrement de la dépense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/expenses/${id}/approve`, {});
      showToast('Dépense approuvée avec succès.', 'success');
      if (selectedExpense?.id === id) {
        setSelectedExpense((prev) => prev ? { ...prev, status: 'APPROVED', paidAt: new Date().toISOString() } : null);
      }
      loadExpenses(currentPage);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur d’approbation', 'error');
    }
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectId || !rejectReason) return;
    try {
      await api.patch(`/expenses/${rejectId}/reject`, { reason: rejectReason });
      showToast('Dépense rejetée avec motif enregistré.', 'info');
      if (selectedExpense?.id === rejectId) {
        setSelectedExpense((prev) => prev ? { ...prev, status: 'REJECTED', rejectedReason: rejectReason } : null);
      }
      setRejectId(null);
      setRejectReason('');
      loadExpenses(currentPage);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur lors du rejet', 'error');
    }
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/expenses/${expenseToDelete.id}`);
      showToast('Dépense supprimée définitivement.', 'success');
      if (selectedExpense?.id === expenseToDelete.id) {
        setSelectedExpense(null);
      }
      setExpenseToDelete(null);
      loadExpenses(currentPage);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Impossible de supprimer cette dépense', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const formatMoney = (val: string | number) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(num);
  };

  const categoryMap = useMemo(() => {
    const map = new Map<string, { label: string; icon: string }>();
    for (const c of CATEGORIES) map.set(c.value, c);
    return map;
  }, []);

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locations) map.set(l.id, l.name);
    return map;
  }, [locations]);

  // Statistiques calculées pour la vue courante
  const pendingCount = useMemo(() => expenses.filter((e) => e.status === 'PENDING_APPROVAL').length, [expenses]);
  const approvedCount = useMemo(() => expenses.filter((e) => e.status === 'APPROVED').length, [expenses]);
  const paidCount = useMemo(() => expenses.filter((e) => e.status === 'PAID').length, [expenses]);
  const rejectedCount = useMemo(() => expenses.filter((e) => e.status === 'REJECTED').length, [expenses]);
  const cashMovementsCount = useMemo(() => expenses.filter((e) => e.paymentMethod === 'CASH').length, [expenses]);

  const topCategory = summary?.categories?.[0];
  const topCategoryInfo = topCategory ? categoryMap.get(topCategory.category) : null;

  const hasActiveFilters = Boolean(search || selectedCategory || selectedStatus || selectedLocation);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedStatus('');
    setSelectedLocation('');
  };

  return (
    <div className="expenses-page">
      <PageHeader
        title="Dépenses & Charges d'Exploitation"
        subtitle="Suivi rigoureux des frais opérationnels, validation et réconciliation automatique avec la caisse"
        primaryAction={{
          label: '+ Nouvelle dépense',
          onClick: () => setShowModal(true),
        }}
      />

      {/* Cartes KPI récapitulatives en grille 4 colonnes */}
      <div className="expenses-kpi-grid">
        <div className="expenses-kpi-card kpi-primary">
          <div className="expenses-kpi-header">
            <span className="expenses-kpi-title">Charges Validées</span>
            <span className="expenses-kpi-icon">💳</span>
          </div>
          <div className="expenses-kpi-value">{formatMoney(summary?.totalAmount || '0')}</div>
          <div className="expenses-kpi-subtitle">
            <span>●</span> {summary?.totalCount || 0} dépense(s) validée(s) au total
          </div>
        </div>

        <div
          className="expenses-kpi-card kpi-warning"
          style={{ cursor: pendingCount > 0 ? 'pointer' : 'default' }}
          onClick={() => {
            if (pendingCount > 0) setSelectedStatus('PENDING_APPROVAL');
          }}
          title={pendingCount > 0 ? 'Cliquer pour filtrer les dépenses à valider' : undefined}
        >
          <div className="expenses-kpi-header">
            <span className="expenses-kpi-title">À Valider / En Attente</span>
            <span className="expenses-kpi-icon">⏳</span>
          </div>
          <div className="expenses-kpi-value" style={{ color: pendingCount > 0 ? '#d97706' : undefined }}>
            {pendingCount} dossier(s)
          </div>
          <div className="expenses-kpi-subtitle">
            {pendingCount > 0 ? (
              <span style={{ color: '#d97706', fontWeight: 700 }}>⚠️ Action requise par le gestionnaire</span>
            ) : (
              <span>✓ Tous les dossiers sont traités</span>
            )}
          </div>
        </div>

        <div className="expenses-kpi-card kpi-info">
          <div className="expenses-kpi-header">
            <span className="expenses-kpi-title">Sorties Caisse (Espèces)</span>
            <span className="expenses-kpi-icon">💵</span>
          </div>
          <div className="expenses-kpi-value">{cashMovementsCount} flux</div>
          <div className="expenses-kpi-subtitle">
            <span>🔄</span> Réconciliation automatique avec le tiroir-caisse
          </div>
        </div>

        <div className="expenses-kpi-card kpi-success">
          <div className="expenses-kpi-header">
            <span className="expenses-kpi-title">Poste Principal</span>
            <span className="expenses-kpi-icon">{topCategoryInfo?.icon || '📊'}</span>
          </div>
          <div className="expenses-kpi-value" style={{ fontSize: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {topCategoryInfo?.label || (topCategory ? topCategory.category : 'Aucun')}
          </div>
          <div className="expenses-kpi-subtitle">
            <span>📈</span> {topCategory ? formatMoney(topCategory.totalAmount) : '0 F CFA'}
          </div>
        </div>

        <div className="expenses-kpi-card kpi-ca">
          <div className="expenses-kpi-header">
            <span className="expenses-kpi-title">📈 CA Brut (Mois)</span>
            <span className="expenses-kpi-icon">💰</span>
          </div>
          <div className="expenses-kpi-value" style={{ color: '#16a34a' }}>
            {formatMoney(monthlyGrossRevenue)}
          </div>
          <div className="expenses-kpi-subtitle">
            <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Détection automatique</span>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres condensée en une seule ligne */}
      <div className="expenses-filter-card">
        <div className="expenses-filter-row">
          {/* Onglets de statuts avec compteurs */}
          <div className="expenses-status-tabs">
            <button
              type="button"
              className={`expenses-status-tab ${selectedStatus === '' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('')}
            >
              Toutes
              <span className="expenses-tab-count">{totalItems}</span>
            </button>
            <button
              type="button"
              className={`expenses-status-tab ${selectedStatus === 'PENDING_APPROVAL' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('PENDING_APPROVAL')}
            >
              À valider
              {pendingCount > 0 && (
                <span className="expenses-tab-count" style={{ background: '#fef3c7', color: '#b45309' }}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`expenses-status-tab ${selectedStatus === 'APPROVED' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('APPROVED')}
            >
              Approuvées
              <span className="expenses-tab-count">{approvedCount}</span>
            </button>
            <button
              type="button"
              className={`expenses-status-tab ${selectedStatus === 'PAID' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('PAID')}
            >
              Payées
              <span className="expenses-tab-count">{paidCount}</span>
            </button>
            <button
              type="button"
              className={`expenses-status-tab ${selectedStatus === 'REJECTED' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('REJECTED')}
            >
              Rejetées
              <span className="expenses-tab-count">{rejectedCount}</span>
            </button>
          </div>

          {/* Contrôles de filtres compacts */}
          <div className="expenses-toolbar-controls">
            <div className="expenses-search-box">
              <span className="expenses-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Rechercher par libellé ou bénéficiaire..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="expenses-search-clear"
                  onClick={() => setSearch('')}
                  title="Effacer la recherche"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              title="Filtrer par catégorie de dépense"
            >
              <option value="">Toutes les catégories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>

            {locations.length > 1 && (
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                title="Filtrer par emplacement"
              >
                <option value="">Tous les emplacements</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name}
                  </option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-action-icon"
                onClick={resetFilters}
                title="Réinitialiser tous les filtres"
              >
                ✕ Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tableau des dépenses pleine page */}
      {loading ? (
        <div className="expenses-table-card" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
          Chargement sécurisé des dépenses et de la trésorerie...
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          title="Aucune dépense trouvée"
          description={
            hasActiveFilters
              ? "Aucun enregistrement ne correspond aux filtres appliqués. Essayez d'élargir votre recherche."
              : "Enregistrez vos frais de loyer, factures d'énergie, salaires et consommables pour piloter votre rentabilité."
          }
          action={{
            label: hasActiveFilters ? 'Réinitialiser les filtres' : '+ Enregistrer une dépense',
            onClick: hasActiveFilters ? resetFilters : () => setShowModal(true),
          }}
        />
      ) : (
        <div className="expenses-table-card">
          <div className="expenses-table-container">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Date</th>
                  <th style={{ width: '125px' }}>Catégorie</th>
                  <th>Motif / Description</th>
                  <th style={{ width: '100px' }}>Bénéficiaire</th>
                  <th style={{ width: '110px' }}>Paiement</th>
                  <th style={{ textAlign: 'right', width: '105px' }}>Montant</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Statut</th>
                  <th style={{ textAlign: 'right', width: '105px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((item) => {
                  const cat = categoryMap.get(item.category);
                  const method = PAYMENT_METHODS.find((m) => m.value === item.paymentMethod);
                  const locName = item.locationId ? locationMap.get(item.locationId) : null;

                  return (
                    <tr key={item.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.84rem', color: '#475569' }}>
                        {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.55rem',
                            background: '#f1f5f9',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#334155',
                          }}
                        >
                          <span>{cat?.icon || '📝'}</span>
                          <span>{cat?.label || item.category}</span>
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.description}</div>
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', alignItems: 'center' }}>
                          {item.isRecurring && (
                            <span style={{ fontSize: '0.72rem', color: '#6366f1', background: '#eef2ff', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                              🔄 Récurrente ({item.recurrenceInterval})
                            </span>
                          )}
                          {locName && (
                            <span style={{ fontSize: '0.72rem', color: '#0369a1', background: '#f0f9ff', padding: '1px 5px', borderRadius: '3px' }}>
                              📍 {locName}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ color: '#475569', fontSize: '0.85rem', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.beneficiary || undefined}>
                        {item.beneficiary || <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>

                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#475569' }}>
                          <span>{method?.icon || '💰'}</span>
                          <span>{method?.label || item.paymentMethod}</span>
                        </span>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatMoney(item.amount)}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`status-pill ${
                            item.status === 'APPROVED'
                              ? 'approved'
                              : item.status === 'PAID'
                              ? 'paid'
                              : item.status === 'PENDING_APPROVAL'
                              ? 'pending'
                              : 'rejected'
                          }`}
                        >
                          {item.status === 'APPROVED' && '● Approuvée'}
                          {item.status === 'PAID' && '✓ Payée'}
                          {item.status === 'PENDING_APPROVAL' && '⏳ À valider'}
                          {item.status === 'REJECTED' && '✕ Rejetée'}
                        </span>
                      </td>

                      {/* Colonne Actions : JAMAIS VIDE, TOUJOURS ACCESSIBLE */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="expenses-actions-cell">
                          {/* Bouton Détails & Reçu visible sur chaque ligne */}
                          <button
                            type="button"
                            className="btn-action-icon btn-view"
                            onClick={() => setSelectedExpense(item)}
                            title="Consulter le justificatif, le détail et le bon de dépense"
                          >
                            👁️ Détails
                          </button>

                          {/* Actions rapides contextuelles */}
                          {item.status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                type="button"
                                className="btn-action-icon btn-approve"
                                onClick={() => handleApprove(item.id)}
                                title="Valider et décaisser cette dépense"
                              >
                                ✓ Valider
                              </button>
                              <button
                                type="button"
                                className="btn-action-icon btn-reject"
                                onClick={() => setRejectId(item.id)}
                                title="Rejeter avec motif"
                              >
                                ✕ Rejeter
                              </button>
                            </>
                          )}

                          {item.status !== 'APPROVED' && (
                            <button
                              type="button"
                              className="btn-action-icon btn-delete"
                              onClick={() => setExpenseToDelete(item)}
                              title="Supprimer définitivement"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={20}
            onPageChange={(page) => loadExpenses(page)}
            itemName="dépenses"
          />
        </div>
      )}

      {/* MODAL 1 : DÉTAILS COMPLETS & JUSTIFICATIF / BON DE DÉPENSE */}
      {selectedExpense && (
        <div className="modal-backdrop" onClick={() => setSelectedExpense(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '640px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.4rem' }}>
                  {categoryMap.get(selectedExpense.category)?.icon || '🧾'}
                </span>
                <div>
                  <h2 className="modal-title" style={{ margin: 0 }}>
                    Bon de Décaissement #{selectedExpense.id.slice(0, 8)}
                  </h2>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Enregistré le {new Date(selectedExpense.createdAt).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedExpense(null)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Statut & Montant Hero */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  color: 'white',
                  borderRadius: 'var(--radius)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Montant de la charge
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
                    {formatMoney(selectedExpense.amount)}
                  </div>
                </div>
                <span
                  className={`status-pill ${
                    selectedExpense.status === 'APPROVED'
                      ? 'approved'
                      : selectedExpense.status === 'PAID'
                      ? 'paid'
                      : selectedExpense.status === 'PENDING_APPROVAL'
                      ? 'pending'
                      : 'rejected'
                  }`}
                  style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem' }}
                >
                  {selectedExpense.status === 'APPROVED' && '● Approuvée & Décaissée'}
                  {selectedExpense.status === 'PAID' && '✓ Payée'}
                  {selectedExpense.status === 'PENDING_APPROVAL' && '⏳ En Attente d’Approbation'}
                  {selectedExpense.status === 'REJECTED' && '✕ Dépense Rejetée'}
                </span>
              </div>

              {/* Justificatif / Reçu style reçu papier financier */}
              <div className="receipt-card">
                <div className="receipt-watermark">
                  {selectedExpense.status === 'APPROVED' ? 'VALIDÉ' : 'GESTION'}
                </div>

                <div className="receipt-header-banner">
                  <div>
                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>
                      Justificatif de dépense
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Reçu certifié & Justificatif comptable interne
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                    <div>Réf: <strong>DEP-{selectedExpense.id.slice(0, 8).toUpperCase()}</strong></div>
                    <div>Devise: <strong>{selectedExpense.currency || 'XOF'}</strong></div>
                  </div>
                </div>

                <div className="receipt-info-grid">
                  <div className="receipt-info-item">
                    <label>Catégorie budgétaire</label>
                    <div>
                      {categoryMap.get(selectedExpense.category)?.icon}{' '}
                      {categoryMap.get(selectedExpense.category)?.label || selectedExpense.category}
                    </div>
                  </div>

                  <div className="receipt-info-item">
                    <label>Bénéficiaire / Fournisseur</label>
                    <div>{selectedExpense.beneficiary || 'Non spécifié'}</div>
                  </div>

                  <div className="receipt-info-item">
                    <label>Moyen de paiement</label>
                    <div>
                      {PAYMENT_METHODS.find((m) => m.value === selectedExpense.paymentMethod)?.icon}{' '}
                      {PAYMENT_METHODS.find((m) => m.value === selectedExpense.paymentMethod)?.label || selectedExpense.paymentMethod}
                    </div>
                  </div>

                  <div className="receipt-info-item">
                    <label>Emplacement / Caisse</label>
                    <div>
                      {selectedExpense.locationId
                        ? locationMap.get(selectedExpense.locationId) || 'Emplacement assigné'
                        : 'Siège général'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1' }}>
                  <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Motif / Description détaillée
                  </label>
                  <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, marginTop: '0.15rem' }}>
                    {selectedExpense.description}
                  </div>
                </div>

                {selectedExpense.rejectedReason && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '4px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.83rem',
                      color: '#991b1b',
                    }}
                  >
                    <strong>Motif du rejet :</strong> {selectedExpense.rejectedReason}
                  </div>
                )}
              </div>

              {/* Traçabilité & Audit */}
              <div style={{ fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                <div>● ID transaction : <code>{selectedExpense.id}</code></div>
                {selectedExpense.cashSessionId && (
                  <div>● Session de caisse liée : <code>{selectedExpense.cashSessionId}</code></div>
                )}
                {selectedExpense.paidAt && (
                  <div>● Décaissé le : {new Date(selectedExpense.paidAt).toLocaleString('fr-FR')}</div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-action-icon"
                onClick={() => window.print()}
                title="Imprimer le bon de dépense"
              >
                🖨️ Imprimer le bon
              </button>

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                {selectedExpense.status === 'PENDING_APPROVAL' && (
                  <>
                    <button
                      type="button"
                      className="btn-action-icon btn-approve"
                      onClick={() => handleApprove(selectedExpense.id)}
                    >
                      ✓ Valider cette dépense
                    </button>
                    <button
                      type="button"
                      className="btn-action-icon btn-reject"
                      onClick={() => {
                        setRejectId(selectedExpense.id);
                        setSelectedExpense(null);
                      }}
                    >
                      ✕ Rejeter
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedExpense(null)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : NOUVELLE DÉPENSE */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '580px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleCreateExpense}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title" style={{ margin: 0 }}>
                    Nouvelle dépense d'exploitation
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Enregistrement d'une charge d'exploitation avec réconciliation caisse
                  </div>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowModal(false)}>
                  ✕
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group">
                    <label className="label">Montant (XOF) *</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Ex: 50 000"
                      className="input"
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Catégorie *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                      className="select"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Motif / Description détaillée *</label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Facture SONABEL électricité boutique principale"
                    className="input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group">
                    <label className="label">Bénéficiaire / Prestataire</label>
                    <input
                      type="text"
                      value={beneficiary}
                      onChange={(e) => setBeneficiary(e.target.value)}
                      placeholder="Ex: SONABEL, Propriétaire bailleur..."
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Moyen de règlement</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="select"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.icon} {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {locations.length > 0 && (
                  <div className="form-group">
                    <label className="label">Magasin / Emplacement rattaché</label>
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      className="select"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          📍 {loc.name}
                        </option>
                      ))}
                    </select>
                    {paymentMethod === 'CASH' && (
                      <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: '0.35rem' }}>
                        ℹ️ Le montant en espèces sera automatiquement déduit de la caisse ouverte sur cet emplacement.
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id="isRecurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    style={{ width: 'auto', marginBottom: 0 }}
                  />
                  <label htmlFor="isRecurring" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0, textTransform: 'none' }}>
                    Dépense récurrente périodique (loyer mensuel, abonnement internet...)
                  </label>
                </div>

                {isRecurring && (
                  <div className="form-group" style={{ paddingLeft: '1.75rem' }}>
                    <label className="label">Fréquence de reconduction</label>
                    <select
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(e.target.value)}
                      className="select"
                    >
                      <option value="WEEKLY">Hebdomadaire</option>
                      <option value="MONTHLY">Mensuelle (par défaut)</option>
                      <option value="QUARTERLY">Trimestrielle</option>
                      <option value="YEARLY">Annuelle</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn primary" disabled={submitting}>
                  {submitting ? 'Enregistrement...' : 'Enregistrer la dépense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3 : MOTIF DE REJET */}
      {rejectId && (
        <div className="modal-backdrop" onClick={() => setRejectId(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '440px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleReject}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ margin: 0, color: '#dc2626' }}>
                  Motif du rejet de la dépense
                </h2>
                <button type="button" className="modal-close" onClick={() => setRejectId(null)}>
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.85rem' }}>
                  Pour garantir la traçabilité financière et comptable, veuillez préciser le motif pour lequel cette dépense est rejetée :
                </p>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex: Facture non conforme, justificatif manquant ou montant contesté"
                  className="input"
                  style={{ width: '100%', marginBottom: 0 }}
                  autoFocus
                />
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRejectId(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }}>
                  Confirmer le rejet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4 : SUPPRESSION DÉFINITIVE */}
      <ConfirmModal
        isOpen={Boolean(expenseToDelete)}
        title="Supprimer la dépense"
        message={
          <div>
            Êtes-vous sûr de vouloir supprimer définitivement cette dépense de{' '}
            <strong>{expenseToDelete ? formatMoney(expenseToDelete.amount) : ''}</strong> pour{' '}
            <em>« {expenseToDelete?.description} »</em> ?
          </div>
        }
        confirmLabel={deleting ? 'Suppression...' : 'Supprimer définitivement'}
        isDestructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/ToastContext';

interface Location {
  id: string;
  name: string;
}

interface CashSession {
  id: string;
  locationId: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  openingFloat: string;
  closedAt: string | null;
  countedAmount: string | null;
  expectedAmount: string | null;
  discrepancy: string | null;
  notes: string | null;
}

interface CashMovement {
  id: string;
  type: 'CASH_IN' | 'CASH_OUT';
  amount: string;
  reason: string;
  createdAt: string;
}

interface Payment {
  id: string;
  amount: string;
  createdAt: string;
}

export function CashRegisterPage() {
  const { showToast } = useToast();

  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [session, setSession] = useState<CashSession | null | undefined>(undefined);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [openingFloat, setOpeningFloat] = useState('');
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_OUT');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [countedAmount, setCountedAmount] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [movementsPage, setMovementsPage] = useState(1);

  useEffect(() => {
    api
      .get<Location[]>('/locations')
      .then((locs) => {
        setLocations(locs);
        if (locs.length > 0) setLocationId(locs[0].id);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erreur de chargement'));
  }, []);

  const loadCurrent = useCallback((loc: string) => {
    if (!loc) return;
    setError(null);
    api
      .get<{ session: CashSession | null }>(`/cash/sessions/current?locationId=${loc}`)
      .then(async ({ session: s }) => {
        setSession(s);
        setMovementsPage(1);
        if (s) {
          const detail = await api.get<{ movements: CashMovement[]; payments: Payment[] }>(
            `/cash/sessions/${s.id}`,
          );
          setMovements(detail.movements);
          setPayments(detail.payments);
        } else {
          setMovements([]);
          setPayments([]);
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erreur de chargement'));
  }, []);

  const paginatedMovements = useMemo(() => {
    const start = (movementsPage - 1) * 20;
    return movements.slice(start, start + 20);
  }, [movements, movementsPage]);

  useEffect(() => {
    if (locationId) loadCurrent(locationId);
  }, [locationId, loadCurrent]);

  const handleOpen = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/cash/sessions/open', { locationId, openingFloat });
      showToast(`Caisse ouverte avec un fond de ${openingFloat} XOF`, 'success');
      setOpeningFloat('');
      loadCurrent(locationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur à l'ouverture de la session");
    }
  };

  const handleMovement = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError(null);
    try {
      await api.post(`/cash/sessions/${session.id}/movements`, {
        type: movementType,
        amount: movementAmount,
        reason: movementReason,
      });
      showToast(
        `Mouvement de ${movementType === 'CASH_IN' ? 'dépôt' : 'retrait'} de ${movementAmount} XOF enregistré`,
        'success',
      );
      setMovementAmount('');
      setMovementReason('');
      loadCurrent(locationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement du mouvement");
    }
  };

  const handleConfirmClose = async () => {
    if (!session || !countedAmount) return;
    setIsClosing(true);
    try {
      const closed = await api.post<CashSession>(`/cash/sessions/${session.id}/close`, { countedAmount });
      const disc = Number(closed.discrepancy ?? 0);
      const discMsg =
        disc === 0
          ? 'Caisse équilibrée à 0 XOF.'
          : disc > 0
            ? `Excédent constaté de +${disc.toLocaleString('fr-FR')} XOF.`
            : `Écart négatif (manquant) de ${disc.toLocaleString('fr-FR')} XOF.`;

      showToast(`Session clôturée. ${discMsg}`, disc === 0 ? 'success' : 'warning');
      setCountedAmount('');
      setShowCloseModal(false);
      loadCurrent(locationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur à la fermeture de la session');
    } finally {
      setIsClosing(false);
    }
  };

  const currentLocation = locations.find((l) => l.id === locationId);
  const totalCashSales = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalMovementsIn = movements
    .filter((m) => m.type === 'CASH_IN')
    .reduce((sum, m) => sum + Number(m.amount), 0);
  const totalMovementsOut = movements
    .filter((m) => m.type === 'CASH_OUT')
    .reduce((sum, m) => sum + Number(m.amount), 0);

  const initialFloat = session ? Number(session.openingFloat) : 0;
  const theoreticalTotal = initialFloat + totalCashSales + totalMovementsIn - totalMovementsOut;

  return (
    <div className="cash-register-page">
      <PageHeader
        title="Gestion de la Caisse & Clôtures"
        subtitle="Suivi des encaissements en espèces, entrées/sorties manuelles et contrôle des écarts de caisse"
        badge={
          session ? (
            <span className="badge badge-success">● Session Ouverte</span>
          ) : session === null ? (
            <span className="badge badge-warning">○ Caisse Fermée</span>
          ) : undefined
        }
      />

      {error && <div className="error-banner">{error}</div>}

      {/* Select Location bar */}
      <div className="table-toolbar" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ margin: 0, fontWeight: 700 }}>Emplacement de caisse :</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{ width: 'auto', marginBottom: 0, minWidth: 220 }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {currentLocation && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              (Une seule session active par emplacement)
            </span>
          )}
        </div>
      </div>

      {session === undefined && (
        <div className="table-loading">
          <div className="loading-spinner" />
          <span>Vérification de l'état de la caisse...</span>
        </div>
      )}

      {/* Register Closed -> Opening Form */}
      {session === null && (
        <div style={{ maxWidth: 480 }}>
          <EmptyState
            type="no-data"
            icon="🔒"
            title="La caisse est actuellement fermée"
            description="Aucune session de caisse n'est active sur cet emplacement. Indiquez le fond de caisse initial pour débuter les encaissements."
          >
            <form onSubmit={handleOpen} className="sale-form" style={{ width: '100%', marginTop: '1rem', textAlign: 'left' }}>
              <label>Fond de caisse initial (XOF) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="Ex: 50000"
                required
              />
              <button type="submit" className="primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Ouvrir la session de caisse
              </button>
            </form>
          </EmptyState>
        </div>
      )}

      {/* Register Open -> Workspace */}
      {session && (
        <>
          {/* Summary KPI Cards */}
          <div className="kpi-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="kpi-card">
              <div className="kpi-value">{Number(session.openingFloat).toLocaleString('fr-FR')} XOF</div>
              <div className="kpi-label">Fond de caisse initial</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-value">{totalCashSales.toLocaleString('fr-FR')} XOF</div>
              <div className="kpi-label">Ventes espèces encaissées ({payments.length} tickets)</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-value">{(totalMovementsIn - totalMovementsOut).toLocaleString('fr-FR')} XOF</div>
              <div className="kpi-label">
                Mouvements manuels (+{totalMovementsIn.toLocaleString('fr-FR')} / -{totalMovementsOut.toLocaleString('fr-FR')})
              </div>
            </div>

            <div className="kpi-card" style={{ borderColor: 'var(--primary)', background: 'var(--primary-soft)' }}>
              <div className="kpi-value" style={{ color: 'var(--primary)' }}>
                {theoreticalTotal.toLocaleString('fr-FR')} XOF
              </div>
              <div className="kpi-label" style={{ fontWeight: 600 }}>Total théorique en caisse</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Left Column: Cash In / Out manual movement */}
            <div className="sale-form">
              <h3>Dépôt ou Retrait exceptionnel</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '-0.3rem', marginBottom: '1rem' }}>
                Pour enregistrer un apport de monnaie, un achat de fourniture direct ou un prélèvement vers le coffre.
              </p>
              <form onSubmit={handleMovement}>
                <label>Nature du mouvement *</label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as 'CASH_IN' | 'CASH_OUT')}
                >
                  <option value="CASH_OUT">Sortie d'espèces (Retrait)</option>
                  <option value="CASH_IN">Entrée d'espèces (Dépôt / Apport)</option>
                </select>

                <label>Montant (XOF) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  required
                />

                <label>Motif de l'opération *</label>
                <input
                  type="text"
                  placeholder="Ex: Achat fournitures bureau, remise de monnaie..."
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  required
                />

                <button type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>
                  Enregistrer le mouvement
                </button>
              </form>
            </div>

            {/* Right Column: Close Cash Register */}
            <div className="sale-form" style={{ borderLeft: '4px solid var(--warning)' }}>
              <h3>Clôturer la session de caisse</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '-0.3rem', marginBottom: '1rem' }}>
                Effectuez le comptage physique des billets et pièces présents dans le tiroir-caisse.
              </p>

              <div>
                <label>Montant compté physiquement (XOF) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 125000"
                  value={countedAmount}
                  onChange={(e) => setCountedAmount(e.target.value)}
                  required
                />

                {countedAmount && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border)',
                      marginBottom: '1rem',
                      fontSize: '0.86rem',
                    }}
                  >
                    <div>Théorique attendu : <strong>{theoreticalTotal.toLocaleString('fr-FR')} XOF</strong></div>
                    <div>Comptage saisi : <strong>{Number(countedAmount).toLocaleString('fr-FR')} XOF</strong></div>
                    <div style={{ marginTop: '0.35rem', fontWeight: 700 }}>
                      Écart estimé :{' '}
                      <span
                        style={{
                          color:
                            Number(countedAmount) - theoreticalTotal === 0
                              ? 'var(--success)'
                              : Number(countedAmount) - theoreticalTotal > 0
                                ? 'var(--warning)'
                                : 'var(--danger)',
                        }}
                      >
                        {(Number(countedAmount) - theoreticalTotal).toLocaleString('fr-FR')} XOF
                        {Number(countedAmount) - theoreticalTotal === 0 && ' (Parfaitement équilibré)'}
                        {Number(countedAmount) - theoreticalTotal > 0 && ' (Excédent de caisse)'}
                        {Number(countedAmount) - theoreticalTotal < 0 && ' (Déficit / Manquant)'}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="primary"
                  style={{ width: '100%', background: 'var(--warning)', borderColor: 'var(--warning)' }}
                  onClick={() => setShowCloseModal(true)}
                  disabled={!countedAmount}
                >
                  Clôturer la caisse
                </button>
              </div>
            </div>
          </div>

          {/* Movements History */}
          <section style={{ marginTop: '2rem' }}>
            <h2>Journal des mouvements de cette session</h2>
            {movements.length === 0 ? (
              <p className="page-note">Aucun mouvement exceptionnel saisi pour cette session.</p>
            ) : (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date & Heure</th>
                      <th>Type</th>
                      <th>Motif</th>
                      <th style={{ textAlign: 'right' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMovements.map((m) => (
                      <tr key={m.id}>
                        <td>{new Date(m.createdAt).toLocaleString('fr-FR')}</td>
                        <td>
                          <span className={`badge ${m.type === 'CASH_IN' ? 'badge-success' : 'badge-danger'}`}>
                            {m.type === 'CASH_IN' ? 'Entrée (Dépôt)' : 'Sortie (Retrait)'}
                          </span>
                        </td>
                        <td>{m.reason}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {m.type === 'CASH_IN' ? '+' : '-'} {Number(m.amount).toLocaleString('fr-FR')} XOF
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  currentPage={movementsPage}
                  totalItems={movements.length}
                  pageSize={20}
                  onPageChange={setMovementsPage}
                />
              </>
            )}
          </section>

          {/* Confirmation Modal for closing register */}
          <ConfirmModal
            isOpen={showCloseModal}
            title="Confirmer la clôture définitive de la caisse"
            message={
              <div>
                <p>
                  Êtes-vous sûr de vouloir fermer la session de caisse pour l'emplacement <strong>{currentLocation?.name}</strong> ?
                </p>
                <div style={{ marginTop: '0.75rem', background: 'var(--surface-muted)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                  <div>Montant compté : <strong>{Number(countedAmount).toLocaleString('fr-FR')} XOF</strong></div>
                  <div>Attendu théorique : <strong>{theoreticalTotal.toLocaleString('fr-FR')} XOF</strong></div>
                </div>
                <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  Une fois la caisse fermée, aucun nouvel encaissement ne pourra être effectué sur cet emplacement sans réouverture.
                </p>
              </div>
            }
            confirmLabel="Confirmer la clôture"
            cancelLabel="Annuler"
            loading={isClosing}
            onConfirm={handleConfirmClose}
            onCancel={() => setShowCloseModal(false)}
          />
        </>
      )}
    </div>
  );
}

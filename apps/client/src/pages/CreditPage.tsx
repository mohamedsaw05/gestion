import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { api, ApiError, fetchBlob } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';

interface CreditAccountRow {
  id: string;
  customerId: string;
  balance: string;
  customer: { name: string } | null;
}

interface CreditMovement {
  id: string;
  movementType: string;
  amount: string;
  method: string | null;
  referenceType: string;
  createdAt: string;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CARD', label: 'Carte Bancaire' },
  { value: 'BANK_TRANSFER', label: 'Virement Bancaire' },
  { value: 'CHECK', label: 'Chèque' },
];

function getCreditScoring(balance: number): { label: string; badge: string; icon: string } {
  if (balance <= 50000) return { label: 'Score A • Risque faible', badge: 'badge-success', icon: '🟢' };
  if (balance <= 200000) return { label: 'Score B • Risque modéré', badge: 'badge-warning', icon: '🟡' };
  return { label: 'Score C • Risque élevé', badge: 'badge-danger', icon: '🔴' };
}

export function CreditPage() {
  const { addToast } = useToast();
  const [accounts, setAccounts] = useState<CreditAccountRow[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [movements, setMovements] = useState<CreditMovement[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Moteur d'Amortissement Dynamique & Simulateur d'Échéancier
  const [showSimulator, setShowSimulator] = useState(false);
  const [simPrincipal, setSimPrincipal] = useState('250000');
  const [simRate, setSimRate] = useState('2');
  const [simPeriods, setSimPeriods] = useState('6');
  const [simMethod, setSimMethod] = useState<'CONSTANT_ANNUITY' | 'CONSTANT_CAPITAL' | 'FREE_SCHEDULE'>('CONSTANT_ANNUITY');

  const simulationSchedule = useMemo(() => {
    const P = Math.max(0, Number(simPrincipal) || 0);
    const n = Math.max(1, Number(simPeriods) || 1);
    const r = Math.max(0, Number(simRate) || 0) / 100;

    const rows: Array<{
      period: number;
      dueDate: string;
      principal: number;
      interest: number;
      total: number;
      balance: number;
    }> = [];

    let remaining = P;
    const now = new Date();

    if (simMethod === 'CONSTANT_CAPITAL') {
      const fixedPrincipal = P / n;
      for (let i = 1; i <= n; i++) {
        const interest = remaining * r;
        const total = fixedPrincipal + interest;
        remaining = Math.max(0, remaining - fixedPrincipal);
        const d = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
        rows.push({
          period: i,
          dueDate: d.toLocaleDateString('fr-FR'),
          principal: fixedPrincipal,
          interest,
          total,
          balance: remaining,
        });
      }
    } else if (simMethod === 'CONSTANT_ANNUITY') {
      const annuity = r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
      for (let i = 1; i <= n; i++) {
        const interest = remaining * r;
        const principalPart = annuity - interest;
        remaining = Math.max(0, remaining - principalPart);
        const d = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
        rows.push({
          period: i,
          dueDate: d.toLocaleDateString('fr-FR'),
          principal: principalPart,
          interest,
          total: annuity,
          balance: remaining,
        });
      }
    } else {
      // FREE_SCHEDULE (échéance indicative au comptoir)
      const part = P / n;
      for (let i = 1; i <= n; i++) {
        remaining = Math.max(0, remaining - part);
        const d = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
        rows.push({
          period: i,
          dueDate: d.toLocaleDateString('fr-FR'),
          principal: part,
          interest: 0,
          total: part,
          balance: remaining,
        });
      }
    }

    return rows;
  }, [simPrincipal, simRate, simPeriods, simMethod]);

  const sendWhatsAppReminder = (account: CreditAccountRow) => {
    const name = account.customer?.name || 'Cher client';
    const bal = Number(account.balance).toLocaleString('fr-FR');
    const text = `Bonjour ${name},\nNous vous rappelons avec bienveillance que votre encours de crédit chez nous s’élève à ${bal} XOF.\nMerci de passer en boutique afin de régulariser votre situation.\nCordialement, le service comptabilité.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const loadAccounts = () => {
    setLoading(true);
    api
      .get<CreditAccountRow[]>('/credit/accounts')
      .then(setAccounts)
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des comptes crédit', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAccount = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setHistoryLoading(true);
    try {
      const data = await api.get<{ movements: CreditMovement[] }>(`/credit/accounts/${customerId}`);
      setMovements(data.movements);
    } catch (e) {
      addToast(e instanceof ApiError ? e.message : "Erreur de chargement de l'historique crédit", 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRepay = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !amount) return;
    setSubmitting(true);
    try {
      await api.post(`/credit/accounts/${selectedCustomerId}/payments`, { amount, method });
      addToast('Remboursement enregistré avec succès.', 'success');
      setAmount('');
      await Promise.all([loadAccounts(), openAccount(selectedCustomerId)]);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de l’enregistrement du remboursement', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadStatement = async (customerId: string) => {
    try {
      addToast('Génération du relevé de compte officiel en cours...', 'info');
      const blob = await fetchBlob(`/customers/${customerId}/statement/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `releve-compte-${customerId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast('Relevé de compte officiel téléchargé avec succès.', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors du téléchargement du relevé', 'error');
    }
  };

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.customerId === selectedCustomerId) ?? null;
  }, [accounts, selectedCustomerId]);

  const totalOutstanding = useMemo(() => {
    return accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return accounts;
    return accounts.filter((a) => (a.customer?.name ?? '').toLowerCase().includes(q));
  }, [accounts, search]);

  return (
    <div>
      <PageHeader
        title="Crédit & Encours Clients"
        subtitle="Suivi des créances en cours, historique des mouvements, scoring de risque et simulateur d'échéancier"
        badges={[
          { label: `${accounts.length} compte${accounts.length > 1 ? 's' : ''} débiteur${accounts.length > 1 ? 's' : ''}`, variant: 'warning' },
          { label: `Total dû : ${totalOutstanding.toLocaleString('fr-FR')} XOF`, variant: 'danger' },
        ]}
        primaryAction={{
          label: 'Simuler un Échéancier',
          icon: '🧮',
          onClick: () => setShowSimulator(true),
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: selectedAccount ? '1fr 1fr' : '1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Colonne gauche : liste des comptes débiteurs */}
        <div>
          <div className="table-toolbar">
            <div className="table-search">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un client avec solde dû..."
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Chargement des comptes clients...
            </div>
          ) : filteredAccounts.length === 0 ? (
            accounts.length === 0 ? (
              <EmptyState
                title="Aucun solde débiteur"
                description="Tous vos clients sont à jour de paiement ! Aucune créance en attente n'est constatée."
              />
            ) : (
              <EmptyState
                title="Aucun résultat"
                description={`Aucun compte débiteur ne correspond à « ${search} ».`}
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
                    <th>Solde dû</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((a) => {
                    const isCurrent = a.customerId === selectedCustomerId;
                    const score = getCreditScoring(Number(a.balance));
                    return (
                      <tr
                        key={a.id}
                        style={{
                          background: isCurrent ? 'var(--primary-soft, #f5f7ff)' : undefined,
                          cursor: 'pointer',
                        }}
                        onClick={() => openAccount(a.customerId)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 600 }}>{a.customer?.name ?? 'Client inconnu'}</div>
                            <span className={`badge ${score.badge}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                              {score.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{a.customerId.slice(0, 8)}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.95rem' }}>
                            {Number(a.balance).toLocaleString('fr-FR')} XOF
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}
                              title="Relancer avec message bienveillant par WhatsApp"
                              onClick={(e) => {
                                e.stopPropagation();
                                sendWhatsAppReminder(a);
                              }}
                            >
                              💬 Relance
                            </button>
                            <button
                              type="button"
                              className={isCurrent ? 'primary' : 'btn-secondary'}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openAccount(a.customerId);
                              }}
                            >
                              {isCurrent ? 'Sélectionné' : 'Détails'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Colonne droite : Détail du compte et formulaire de remboursement */}
        {selectedAccount && (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{selectedAccount.customer?.name}</h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Compte client #{selectedAccount.customerId.slice(0, 8)}
                </span>
                <div style={{ marginTop: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadStatement(selectedAccount.customerId)}
                    className="secondary"
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <span>📄</span>
                    <span>Relevé de Compte Officiel (PDF)</span>
                  </button>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--danger)' }}>
                  {Number(selectedAccount.balance).toLocaleString('fr-FR')} XOF
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Solde restant dû</div>
              </div>
            </div>

            {/* Formulaire de remboursement */}
            <div
              style={{
                background: 'var(--surface-muted, #f8fafc)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Enregistrer un remboursement</h4>
              <form onSubmit={handleRepay}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Mode de règlement
                    </label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Montant reçu (XOF) *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={`Max: ${selectedAccount.balance}`}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <button type="submit" disabled={submitting} className="primary" style={{ width: '100%' }}>
                  {submitting ? 'Validation...' : 'Encaisser le remboursement'}
                </button>
              </form>
            </div>

            {/* Historique des mouvements */}
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Historique des mouvements</h4>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                Chargement de l'historique...
              </div>
            ) : movements.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aucun mouvement enregistré.</div>
            ) : (
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Opération</th>
                      <th>Montant</th>
                      <th>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {new Date(m.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color: m.movementType.includes('PAYMENT') || m.movementType.includes('REPAY') ? 'var(--success)' : 'var(--danger)',
                            }}
                          >
                            {m.movementType}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{Number(m.amount).toLocaleString('fr-FR')} XOF</td>
                        <td>{m.method ?? m.referenceType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DU SIMULATEUR D'ÉCHÉANCIER / AMORTISSEMENT FINANCIER */}
      {showSimulator && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowSimulator(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', color: '#0f172a', fontWeight: 800 }}>
                  🧮 Simulateur & Moteur d'Amortissement Financier
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Calculez les échéances et générez un tableau de remboursement conforme avant accord de crédit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulator(false)}
                className="btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                ✕ Fermer
              </button>
            </div>

            {/* Formulaire des paramètres du crédit */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Montant du Crédit (XOF) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={simPrincipal}
                  onChange={(e) => setSimPrincipal(e.target.value)}
                  style={{ width: '100%', fontWeight: 700, fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Taux d'intérêt (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={simRate}
                  onChange={(e) => setSimRate(e.target.value)}
                  style={{ width: '100%', fontWeight: 700, fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Durée (mois / échéances) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={simPeriods}
                  onChange={(e) => setSimPeriods(e.target.value)}
                  style={{ width: '100%', fontWeight: 700, fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Méthode de Calcul
                </label>
                <select
                  value={simMethod}
                  onChange={(e) => setSimMethod(e.target.value as any)}
                  style={{ width: '100%', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  <option value="CONSTANT_ANNUITY">Annuités Constantes</option>
                  <option value="CONSTANT_CAPITAL">Capital Fixe (Amortissement Constant)</option>
                  <option value="FREE_SCHEDULE">Échéances Libres</option>
                </select>
              </div>
            </div>

            {/* Résumé Synthétique */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1, minWidth: '160px', background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700 }}>Total Capital Prêté</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1d4ed8' }}>
                  {Number(simPrincipal).toLocaleString('fr-FR')} XOF
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '160px', background: '#f0fdf4', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700 }}>Total Intérêts Générés</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#15803d' }}>
                  {simulationSchedule.reduce((s, r) => s + r.interest, 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '160px', background: '#faf5ff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b21a8', fontWeight: 700 }}>Montant Total Dû</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#7e22ce' }}>
                  {simulationSchedule.reduce((s, r) => s + r.total, 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF
                </div>
              </div>
            </div>

            {/* Tableau d'Amortissement Généré */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table className="data-table" style={{ fontSize: '0.84rem', margin: 0 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th>N°</th>
                    <th>Échéance prévue</th>
                    <th style={{ textAlign: 'right' }}>Part Capital</th>
                    <th style={{ textAlign: 'right' }}>Part Intérêts</th>
                    <th style={{ textAlign: 'right' }}>Mensualité Totale</th>
                    <th style={{ textAlign: 'right' }}>Capital Restant Dû</th>
                  </tr>
                </thead>
                <tbody>
                  {simulationSchedule.map((row) => (
                    <tr key={row.period}>
                      <td><strong>#{row.period}</strong></td>
                      <td>{row.dueDate}</td>
                      <td style={{ textAlign: 'right' }}>
                        {row.principal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF
                      </td>
                      <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                        {row.interest.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                        {row.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                        {row.balance.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem', fontWeight: 700 }}
              >
                🖨️ Imprimer l'échéancier
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSimulator(false);
                  addToast('Simulation validée.', 'success');
                }}
                className="primary"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem', fontWeight: 700 }}
              >
                Appliquer & Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

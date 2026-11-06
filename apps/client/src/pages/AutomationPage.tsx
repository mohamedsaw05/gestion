import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import type { AutomationRule, AutomationExecutionLog } from '@gestionnaire/shared';

const TRIGGER_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  STOCK_LOW: { label: 'Stock critique', icon: '⚠️', desc: 'Quand un article descend sous un seuil minimum' },
  EXPENSE_CREATED: { label: 'Dépense enregistrée', icon: '💸', desc: 'Lorsqu’une nouvelle charge d’exploitation est saisie' },
  PAYMENT_RECEIVED: { label: 'Paiement encaissé', icon: '💰', desc: 'Dès qu’un règlement client est confirmé' },
  ORDER_CONFIRMED: { label: 'Commande validée', icon: '🛍️', desc: 'Lors de la confirmation d’une commande client' },
  INVOICE_OVERDUE: { label: 'Facture en retard', icon: '⏰', desc: 'Quand une créance dépasse sa date d’échéance' },
  CRON_DAILY: { label: 'Rapport quotidien', icon: '📅', desc: 'Chaque soir à la fermeture pour synthèse' },
};

export function AutomationPage() {
  const { addToast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);

  // Modal création
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('STOCK_LOW');
  const [threshold, setThreshold] = useState('5');
  const [recipientRole, setRecipientRole] = useState('MANAGER');
  const [customMessage, setCustomMessage] = useState('');

  // Modal test dry-run
  const [testRuleId, setTestRuleId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get<AutomationRule[]>('/automation/rules'),
      api.get<{ data: AutomationExecutionLog[] }>('/automation/logs?limit=20'),
    ])
      .then(([rulesRes, logsRes]) => {
        setRules(rulesRes);
        setLogs(logsRes.data || []);
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement de l’automatisation', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (ruleId: string) => {
    try {
      await api.patch(`/automation/rules/${ruleId}/toggle`, {});
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r)),
      );
      addToast('Statut de la règle modifié.', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de modification', 'error');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette règle d’automatisation ?')) return;
    try {
      await api.delete(`/automation/rules/${ruleId}`);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      addToast('Règle d’automatisation supprimée avec succès.', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la suppression de la règle', 'error');
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let conditions: Record<string, any> = {};
      if (trigger === 'STOCK_LOW') {
        conditions = { stockBelow: Number(threshold) };
      } else if (trigger === 'EXPENSE_CREATED') {
        conditions = { amountGreaterThan: Number(threshold) };
      }

      await api.post('/automation/rules', {
        name,
        description: description || undefined,
        trigger,
        conditions,
        actions: [
          {
            type: 'ALERT',
            channel: 'IN_APP',
            recipientRole,
            message: customMessage || undefined,
          },
        ],
      });

      addToast('Règle d’automatisation créée avec succès.', 'success');
      setShowCreateModal(false);
      setName('');
      setDescription('');
      loadData();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de création de la règle', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDryRun = async (ruleId: string) => {
    setTestRuleId(ruleId);
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<any>(`/automation/rules/${ruleId}/test`, {
        mockPayload: { stock: 2, amount: 250000, category: 'UTILITIES' },
      });
      setTestResult(res);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur du test à blanc', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Moteur d’Automatisation & Alertes"
        subtitle="Règles configurables d’alertes opérationnelles, réapprovisionnement et surveillance avec protection anti-boucle"
        primaryAction={{
          label: '+ Nouvelle règle',
          onClick: () => setShowCreateModal(true),
        }}
        secondaryActions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? 'Masquer le journal' : `Journal d’exécution (${logs.length})`}
          </button>
        }
      />

      {/* Règles en grille */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Chargement des règles...</div>
      ) : rules.length === 0 ? (
        <EmptyState
          title="Aucune règle configurée"
          description="Automatisez la détection des stocks faibles, les alertes de dépenses ou les relances clients."
          action={{
            label: '+ Créer une règle',
            onClick: () => setShowCreateModal(true),
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {rules.map((rule) => {
            const trig = TRIGGER_LABELS[rule.trigger] || { label: rule.trigger, icon: '⚡', desc: '' };
            return (
              <div
                key={rule.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: rule.isActive ? '4px solid #10b981' : '4px solid #d1d5db',
                  opacity: rule.isActive ? 1 : 0.75,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{trig.icon}</span>
                    <button
                      type="button"
                      onClick={() => handleToggle(rule.id)}
                      className={`badge ${rule.isActive ? 'badge-success' : 'badge-secondary'}`}
                      style={{ cursor: 'pointer', border: 'none', padding: '0.35rem 0.65rem' }}
                    >
                      {rule.isActive ? 'Active' : 'Désactivée'}
                    </button>
                  </div>

                  <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', color: '#111827' }}>{rule.name}</h4>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.4 }}>
                    {rule.description || trig.desc}
                  </p>

                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#374151', marginBottom: '1rem' }}>
                    <div><strong>Déclencheur :</strong> {trig.label}</div>
                    <div style={{ marginTop: '0.2rem' }}><strong>Conditions :</strong> {JSON.stringify(rule.conditions)}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    ⚡ {rule.executionCount} exécution(s)
                  </span>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => handleDryRun(rule.id)}
                    >
                      Tester à blanc
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDeleteRule(rule.id)}
                      style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '0.2rem 0.5rem', cursor: 'pointer' }}
                      title="Supprimer cette règle"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Journal d'exécution */}
      {showLogs && (
        <div className="card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Historique récent des exécutions (Audit anti-boucle)</h3>
          {logs.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Aucune exécution enregistrée pour le moment.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date & Heure</th>
                    <th>Événement</th>
                    <th>Statut</th>
                    <th>Durée</th>
                    <th>Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.triggerEvent}</td>
                      <td>
                        <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : log.status === 'SKIPPED' ? 'badge-secondary' : 'badge-danger'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{log.durationMs} ms</td>
                      <td style={{ fontSize: '0.8rem', color: '#4b5563', maxWidth: '300px' }}>
                        {log.errorMessage ? (
                          <span style={{ color: '#ef4444' }}>{log.errorMessage}</span>
                        ) : (
                          JSON.stringify(log.outputPayload || {})
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Création de règle */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <form onSubmit={handleCreate}>
              <div className="modal-header">
                <h3>Créer une règle d’automatisation</h3>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}>✕</button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Nom de la règle *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Alerte stock bas dépôt"
                    className="input"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="label">Événement déclencheur *</label>
                  <select
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value)}
                    className="select"
                  >
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.icon} {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">
                    {trigger === 'STOCK_LOW' ? 'Seuil critique de stock (unités)' : 'Seuil de montant (XOF)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Destinataire de l’alerte</label>
                  <select
                    value={recipientRole}
                    onChange={(e) => setRecipientRole(e.target.value)}
                    className="select"
                  >
                    <option value="OWNER">Propriétaire / Directeur</option>
                    <option value="MANAGER">Gestionnaire / Responsable</option>
                    <option value="SALES">Vendeurs</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Message personnalisé (optionnel)</label>
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Ex: Attention niveau de stock très bas à réapprovisionner"
                    className="input"
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Création...' : 'Créer la règle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dry-run Test */}
      {testRuleId && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Simulation de test à blanc</h3>
              <button type="button" className="btn-close" onClick={() => setTestRuleId(null)}>✕</button>
            </div>
            <div className="modal-body">
              {testing ? (
                <p style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>Simulation en cours...</p>
              ) : testResult ? (
                <div>
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '6px', backgroundColor: testResult.matched ? '#ecfdf5' : '#fef2f2', color: testResult.matched ? '#065f46' : '#991b1b', fontSize: '0.9rem' }}>
                    {testResult.message}
                  </div>
                  <pre style={{ backgroundColor: '#f3f4f6', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', overflowX: 'auto' }}>
                    {JSON.stringify(testResult.simulatedActions, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setTestRuleId(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

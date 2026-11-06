import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';
import { getCacheConfig, estimateCacheSizeMb, purgeAppCache, type CacheConfig } from '../lib/cacheManager';
import type { DiagnosticScan } from '@gestionnaire/shared';

export function DiagnosticsPage() {
  const { addToast } = useToast();
  const [scans, setScans] = useState<DiagnosticScan[]>([]);
  const [latestScan, setLatestScan] = useState<DiagnosticScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);

  // Cache System State
  const [cacheConfig, setCacheConfig] = useState<CacheConfig>(getCacheConfig);
  const [cacheSizeMb, setCacheSizeMb] = useState<number>(estimateCacheSizeMb);
  const [purgingCache, setPurgingCache] = useState(false);

  // Modal réparation
  const [selectedRepair, setSelectedRepair] = useState<string | null>(null);
  const [repairReason, setRepairReason] = useState('');

  const loadScans = () => {
    api
      .get<DiagnosticScan[]>('/diagnostics/scans')
      .then((data) => {
        setScans(data);
        if (data.length > 0) {
          setLatestScan(data[0]);
        }
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des diagnostics', 'error'));
  };

  useEffect(() => {
    loadScans();
    setCacheConfig(getCacheConfig());
    setCacheSizeMb(estimateCacheSizeMb());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunScan = async () => {
    setScanning(true);
    try {
      const res = await api.post<DiagnosticScan>('/diagnostics/scan', { type: 'FULL_SYSTEM' });
      addToast('Scan d’intégrité exécuté avec succès.', 'success');
      setLatestScan(res);
      loadScans();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors du scan', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleManualPurgeCache = async () => {
    setPurgingCache(true);
    try {
      const result = await purgeAppCache(true);
      setCacheSizeMb(estimateCacheSizeMb());
      setCacheConfig(getCacheConfig());
      addToast(`🧹 Cache système vidé et optimisé : ${result.freedMb} Mo libérés (${result.purgedItems} éléments nettoyés)`, 'success');
    } catch {
      addToast('Erreur lors de la purge du cache', 'error');
    } finally {
      setPurgingCache(false);
    }
  };

  const handleConfirmRepair = async () => {
    if (!selectedRepair) return;
    setRepairing(true);
    try {
      const res = await api.post<{ success: boolean; result: any }>('/diagnostics/repair', {
        repairType: selectedRepair,
        reason: repairReason || 'Réparation déclenchée depuis la console d’administration',
      });
      addToast(res.result.message || 'Réparation sûre exécutée.', 'success');
      setSelectedRepair(null);
      setRepairReason('');
      loadScans();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la réparation', 'error');
    } finally {
      setRepairing(false);
    }
  };

  const findings = (latestScan?.findings as Record<string, any>) || null;

  return (
    <div className="page-container">
      <PageHeader
        title="Diagnostic & Réparation Contrôlée"
        subtitle="Audit d’intégrité du système en lecture seule, détection proactive des anomalies et réparations sûres idempotentes"
        primaryAction={{
          label: scanning ? 'Scan en cours...' : '🔍 Lancer un diagnostic complet',
          onClick: handleRunScan,
          disabled: scanning,
        }}
        secondaryActions={
          <button
            type="button"
            onClick={handleManualPurgeCache}
            disabled={purgingCache}
            className="btn-secondary"
            style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🧹</span>
            {purgingCache ? 'Purge en cours...' : 'Vider le cache (1-clic)'}
          </button>
        }
      />

      {/* Module de Gestion du Cache & Performance Temps Réel */}
      <div
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderLeft: '5px solid #2563eb',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚡</span>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                Cache Système & Mémoire Locale (Seuils Heures & Mo)
              </h3>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Purge automatique programmée si la mémoire dépasse <strong>{cacheConfig.maxCacheSizeMb} Mo</strong> ou toutes les <strong>{cacheConfig.purgeIntervalHours} heures</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Utilisation Actuelle
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: cacheSizeMb > cacheConfig.maxCacheSizeMb ? '#dc2626' : '#16a34a' }}>
                {cacheSizeMb} <span style={{ fontSize: '0.85rem' }}>Mo</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleManualPurgeCache}
                disabled={purgingCache}
                className="primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.84rem', fontWeight: 700 }}
              >
                {purgingCache ? 'Purge en cours...' : '🧹 Vider & Optimiser'}
              </button>
              <a
                href="/settings/config?tab=performance"
                className="btn-secondary"
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.84rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                ⚙️ Configurer dans les Paramètres
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* État Global du Système */}
      {latestScan ? (
        <div style={{ marginBottom: '2rem' }}>
          <div
            className="card"
            style={{
              padding: '1.5rem',
              borderLeft:
                latestScan.status === 'SUCCESS'
                  ? '6px solid #10b981'
                  : latestScan.status === 'WARNING'
                  ? '6px solid #f59e0b'
                  : '6px solid #ef4444',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    className={`badge ${
                      latestScan.status === 'SUCCESS'
                        ? 'badge-success'
                        : latestScan.status === 'WARNING'
                        ? 'badge-warning'
                        : 'badge-danger'
                    }`}
                    style={{ fontSize: '0.9rem', padding: '0.4rem 0.75rem' }}
                  >
                    {latestScan.status === 'SUCCESS'
                      ? '✓ Système Sain (OK)'
                      : latestScan.status === 'WARNING'
                      ? '⚠️ Attention Requise'
                      : '🚨 Problème Critique Détecté'}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    Dernier scan : {new Date(latestScan.createdAt).toLocaleString('fr-FR')} ({findings?.executionTimeMs || 0} ms)
                  </span>
                </div>

                {findings?.criticals?.length > 0 && (
                  <div style={{ marginTop: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>
                    <strong>Anomalies critiques :</strong>
                    <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                      {findings.criticals.map((c: string, idx: number) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {findings?.warnings?.length > 0 && (
                  <div style={{ marginTop: '0.5rem', color: '#d97706', fontSize: '0.9rem' }}>
                    <strong>Avertissements :</strong>
                    <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                      {findings.warnings.map((w: string, idx: number) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Grille d'indicateurs de santé */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginTop: '1.5rem',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '1.25rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Latence Base de Données</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', marginTop: '0.2rem' }}>
                  {findings?.dbLatencyMs || 0} ms
                </div>
                <div style={{ fontSize: '0.75rem', color: (findings?.dbLatencyMs || 0) < 50 ? '#059669' : '#d97706' }}>
                  {(findings?.dbLatencyMs || 0) < 50 ? 'Excellente réponse' : 'Latence modérée'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Événements Outbox</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', marginTop: '0.2rem' }}>
                  {findings?.outbox?.pending || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>En attente de relai audit</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Fichiers & Stockage</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', marginTop: '0.2rem' }}>
                  {findings?.files?.totalTracked || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: (findings?.files?.missingOnDisk || 0) === 0 ? '#059669' : '#dc2626' }}>
                  {(findings?.files?.missingOnDisk || 0) === 0 ? 'Fichiers physiques intègres' : `${findings?.files?.missingOnDisk} manquant(s)`}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Cohérence des Stocks</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', marginTop: '0.2rem' }}>
                  {findings?.inventory?.negativeStockCount || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: (findings?.inventory?.negativeStockCount || 0) === 0 ? '#059669' : '#dc2626' }}>
                  {(findings?.inventory?.negativeStockCount || 0) === 0 ? 'Aucun stock négatif' : 'Anomalies détectées'}
                </div>
              </div>
            </div>

            {/* Panneau de Santé & Statut de TOUS les Moteurs Métier */}
            {findings?.engines && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚙️</span>
                  <span>Santé et Contrôle Opérationnel de Tous les Moteurs (9 Moteurs Actifs)</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                  {Object.entries(findings.engines).map(([key, engine]: [string, any]) => {
                    const isSuccess = engine.status === 'SUCCESS';
                    const isWarning = engine.status === 'WARNING';
                    return (
                      <div
                        key={key}
                        style={{
                          background: isSuccess ? '#f0fdf4' : isWarning ? '#fffbeb' : '#fef2f2',
                          border: `1px solid ${isSuccess ? '#bbf7d0' : isWarning ? '#fde68a' : '#fecaca'}`,
                          borderRadius: '8px',
                          padding: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1f2937' }}>
                            {engine.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isSuccess ? '#dcfce7' : isWarning ? '#fef3c7' : '#fee2e2',
                              color: isSuccess ? '#15803d' : isWarning ? '#b45309' : '#b91c1c',
                            }}
                          >
                            {isSuccess ? '✓ NOMINAL' : isWarning ? '⚠️ ATTENTION' : '🚨 CRITIQUE'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#4b5563', lineHeight: 1.4 }}>
                          {key === 'database' && `Latence ping: ${engine.latencyMs}ms • RLS Multi-Tenant: ACTIF`}
                          {key === 'events' && `${engine.pending} en attente • ${engine.processed} traités par l'Outbox`}
                          {key === 'sales' && `${engine.totalSales} ventes enregistrées • ${engine.totalPayments} règlements`}
                          {key === 'inventory' && `${engine.totalTracked} réf. suivies • ${engine.negativeStockCount} anomalie(s)`}
                          {key === 'cashRegister' && `${engine.totalSessions} sessions • ${engine.openSessionsCount} ouverte(s)`}
                          {key === 'credit' && `${engine.totalAccounts} comptes • ${engine.limitExceededCount} dépassement(s)`}
                          {key === 'documents' && `${engine.activeSequences} séquences num. • ${engine.totalDocuments} documents`}
                          {key === 'security' && `${engine.activeUsers} utilisateurs • Anti-Brute-Force: ACTIF`}
                          {key === 'platform' && `Plan: ${engine.planKey} • Quota ventes: ${engine.salesUsage}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: '#6b7280' }}>Aucun scan récent. Cliquez sur le bouton ci-dessus pour lancer un premier diagnostic.</p>
        </div>
      )}

      {/* Boîte à outils : Réparations sûres & autorisées */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.15rem', color: '#111827', marginBottom: '0.75rem' }}>
          Actions de Réparation Sûres & Idempotentes
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
          Ces opérations sont strictement bornées et réversibles. Conformément à la règle de protection financière, aucune opération n'altère silencieusement les écritures comptables ou l'historique des ventes.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>🔄 Relancer les événements Outbox</h4>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.4 }}>
              Réactive les événements en attente pour traitement asynchrone sécurisé par le worker d'audit.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setSelectedRepair('RETRY_FAILED_OUTBOX')}
            >
              Exécuter la reprise
            </button>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>📦 Vérifier les projections de stock</h4>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.4 }}>
              Vérifie l'alignement des niveaux de stock physiques avec le journal append-only des mouvements.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setSelectedRepair('RECALCULATE_STOCK_PROJECTIONS')}
            >
              Vérifier l’alignement
            </button>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>🧹 Nettoyer les fichiers orphelins</h4>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.4 }}>
              Supprime les résidus temporaires sur disque sans enregistrement dans la base de données.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setSelectedRepair('CLEANUP_ORPHAN_FILES')}
            >
              Nettoyer les orphelins
            </button>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>⚡ Purger le cache temporaire</h4>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.4 }}>
              Invalide les états dérivés en mémoire pour forcer le rechargement propre des données serveur.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setSelectedRepair('PURGE_TEMPORARY_CACHE')}
            >
              Purger le cache
            </button>
          </div>
        </div>
      </div>

      {/* Historique des scans */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem' }}>Historique des diagnostics & réparations</h3>
        {scans.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Aucun historique disponible.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date & Heure</th>
                  <th>Type de Scan</th>
                  <th>Statut</th>
                  <th>Réparation Associée</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontSize: '0.85rem' }}>{new Date(s.createdAt).toLocaleString('fr-FR')}</td>
                    <td style={{ fontWeight: 600 }}>{s.type}</td>
                    <td>
                      <span className={`badge ${s.status === 'SUCCESS' ? 'badge-success' : s.status === 'WARNING' ? 'badge-warning' : 'badge-danger'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                      {s.repairsExecuted ? (s.repairsExecuted as any).message || JSON.stringify(s.repairsExecuted) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Confirmation de Réparation */}
      {selectedRepair && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Confirmer l'opération de réparation</h3>
              <button type="button" className="btn-close" onClick={() => setSelectedRepair(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ backgroundColor: '#eff6ff', borderRadius: '6px', padding: '0.75rem', color: '#1e40af', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <strong>Garde-fou :</strong> Cette opération est sûre, bornée et enregistrée dans le journal d'audit de l'organisation.
              </div>

              <div className="form-group">
                <label className="label">Opération sélectionnée</label>
                <input type="text" readOnly value={selectedRepair} className="input" style={{ backgroundColor: '#f3f4f6' }} />
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="label">Motif de l'intervention (optionnel)</label>
                <input
                  type="text"
                  value={repairReason}
                  onChange={(e) => setRepairReason(e.target.value)}
                  placeholder="Ex: Vérification mensuelle de maintenance"
                  className="input"
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedRepair(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmRepair}
                disabled={repairing}
              >
                {repairing ? 'Exécution...' : 'Confirmer et exécuter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

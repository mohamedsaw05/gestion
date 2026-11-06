import { useEffect, useState, useMemo } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/ToastContext';

interface AuditEntry {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorUserId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export function AuditPage() {
  const { addToast } = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    api
      .get<AuditEntry[]>('/audit')
      .then(setEntries)
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement de l’audit', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entityTypes = useMemo(() => {
    const set = new Set(entries.map((e) => e.entityType).filter(Boolean));
    return Array.from(set);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (entityFilter !== 'ALL' && e.entityType !== entityFilter) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        e.eventType.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q) ||
        e.actorType.toLowerCase().includes(q)
      );
    });
  }, [entries, entityFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [search, entityFilter]);

  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * 20;
    return filteredEntries.slice(start, start + 20);
  }, [filteredEntries, page]);

  return (
    <div>
      <PageHeader
        title="Journal d'Audit & Sécurité"
        subtitle="Historique immuable de traçabilité des opérations métier alimenté via le pattern Outbox"
        badges={[
          { label: `${entries.length} événement(s) journalisé(s)`, variant: 'info' },
        ]}
      />

      <div className="table-toolbar">
        <div className="table-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par événement, entité, acteur..."
          />
        </div>
        {entityTypes.length > 0 && (
          <div className="segmented-control">
            <button
              className={`segmented-button ${entityFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setEntityFilter('ALL')}
            >
              Toutes les entités
            </button>
            {entityTypes.map((et) => (
              <button
                key={et}
                className={`segmented-button ${entityFilter === et ? 'active' : ''}`}
                onClick={() => setEntityFilter(et)}
              >
                {et}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Chargement du journal d'audit...
        </div>
      ) : filteredEntries.length === 0 ? (
        entries.length === 0 ? (
          <EmptyState
            title="Aucun événement d'audit enregistré"
            description="Le journal est vide pour le moment. Les futures opérations de vente, stock ou modification seront consignées ici."
          />
        ) : (
          <EmptyState
            title="Aucun résultat"
            description={`Aucun événement ne correspond à « ${search} ».`}
            action={{
              label: 'Effacer les filtres',
              onClick: () => {
                setSearch('');
                setEntityFilter('ALL');
              },
            }}
          />
        )
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Type d'Événement</th>
                <th>Entité Ciblée</th>
                <th>Acteur</th>
                <th style={{ textAlign: 'right' }}>Détails</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {new Date(e.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(e.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {e.eventType}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-info">{e.entityType}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                      ID: {e.entityId.slice(0, 8)}...
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                      {e.actorType === 'USER' ? '👤 Utilisateur' : '⚙️ Système'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem' }}
                      onClick={() => setSelectedEntry(e)}
                    >
                      🔍 Inspecter
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={page}
            totalItems={filteredEntries.length}
            pageSize={20}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* ── MODAL INSPECTION DÉTAILLÉE D'UN ÉVÉNEMENT D'AUDIT ── */}
      {selectedEntry && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '640px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Détail de l'Événement d'Audit</h3>
              <button type="button" onClick={() => setSelectedEntry(null)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Événement</div>
                <div style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--primary)' }}>{selectedEntry.eventType}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Entité Ciblée</div>
                <div style={{ fontWeight: 600 }}>{selectedEntry.entityType} (ID: {selectedEntry.entityId})</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Horodatage</div>
                <div style={{ fontWeight: 600 }}>{new Date(selectedEntry.createdAt).toLocaleString('fr-FR')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Acteur</div>
                <div style={{ fontWeight: 600 }}>{selectedEntry.actorType} {selectedEntry.actorUserId ? `(${selectedEntry.actorUserId.slice(0, 8)})` : ''}</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Charge utile de l'événement (Payload JSON) :
              </label>
              <pre
                style={{
                  background: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                  fontSize: '0.82rem',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(selectedEntry.payload ?? {}, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSelectedEntry(null)} className="primary">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

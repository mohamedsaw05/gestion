import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { Pagination } from '../components/Pagination';

interface Sale {
  id: string;
  grandTotal: string;
  createdAt: string;
}
interface EligibleLine {
  saleLineId: string;
  productNameSnapshot: string;
  quantitySold: string;
  alreadyReturned: string;
  remaining: string;
}
interface ReturnLine {
  id: string;
  productNameSnapshot: string;
  quantity: string;
  condition: string;
  restocked: boolean;
}
interface ReturnRow {
  id: string;
  saleId: string;
  reason: string;
  refundMethod: string | null;
  refundAmount: string;
  createdAt: string;
  lines: ReturnLine[];
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CARD', label: 'Carte Bancaire' },
  { value: 'BANK_TRANSFER', label: 'Virement' },
  { value: 'CHECK', label: 'Chèque' },
];

export function ReturnsPage() {
  const { addToast } = useToast();
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleId, setSaleId] = useState('');
  const [eligibleLines, setEligibleLines] = useState<EligibleLine[]>([]);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, string>>({});
  const [selectedConditions, setSelectedConditions] = useState<Record<string, 'GOOD' | 'DEFECTIVE'>>({});
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [loading, setLoading] = useState(true);
  const [linesLoading, setLinesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const loadReturns = () => {
    setLoading(true);
    api
      .get<ReturnRow[]>('/returns')
      .then(setReturns)
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des retours', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReturns();
    api.get<Sale[]>('/sales').then(setSales).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!saleId) {
      setEligibleLines([]);
      return;
    }
    setLinesLoading(true);
    api
      .get<{ lines: EligibleLine[] }>(`/returns/eligible-lines?saleId=${saleId}`)
      .then((d) => {
        setEligibleLines(d.lines.filter((l) => Number(l.remaining) > 0));
        setSelectedQuantities({});
        setSelectedConditions({});
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des articles de la vente', 'error'))
      .finally(() => setLinesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const linesToReturn = eligibleLines
      .filter((l) => Number(selectedQuantities[l.saleLineId]) > 0)
      .map((l) => ({
        saleLineId: l.saleLineId,
        quantity: selectedQuantities[l.saleLineId],
        condition: selectedConditions[l.saleLineId] ?? 'GOOD',
      }));

    if (linesToReturn.length === 0) {
      addToast('Sélectionnez au moins une quantité à retourner.', 'warning');
      return;
    }
    if (!reason.trim()) {
      addToast('Précisez le motif du retour.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/returns', {
        saleId,
        reason: reason.trim(),
        refundMethod: refundMethod || undefined,
        operationId: crypto.randomUUID(),
        lines: linesToReturn,
      });
      addToast('Retour enregistré : stock et remboursement traités.', 'success');
      setSaleId('');
      setReason('');
      setShowForm(false);
      loadReturns();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors du traitement du retour', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredReturns = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return returns;
    return returns.filter(
      (r) =>
        r.saleId.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.lines.some((l) => l.productNameSnapshot.toLowerCase().includes(q)),
    );
  }, [returns, search]);

  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * 20;
    return filteredReturns.slice(start, start + 20);
  }, [filteredReturns, currentPage]);

  const totalRefunded = useMemo(() => {
    return returns.reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);
  }, [returns]);

  return (
    <div>
      <PageHeader
        title="Retours & Avoirs"
        subtitle="Traitement des retours clients, réintégration contrôlée en stock et régularisation financière"
        badges={[
          { label: `${returns.length} retour${returns.length > 1 ? 's' : ''}`, variant: 'info' },
          { label: `Total remboursé : ${totalRefunded.toLocaleString('fr-FR')} XOF`, variant: 'warning' },
        ]}
        primaryAction={{
          label: showForm ? 'Fermer le formulaire' : '+ Enregistrer un retour',
          onClick: () => setShowForm((p) => !p),
          variant: showForm ? 'secondary' : 'primary',
        }}
      />

      {/* Formulaire de traitement de retour */}
      {showForm && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Traiter un retour de marchandise</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Vente d'origine *
                </label>
                <select value={saleId} onChange={(e) => setSaleId(e.target.value)} required style={{ width: '100%' }}>
                  <option value="">Sélectionner une vente existante...</option>
                  {sales.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id.slice(0, 8)} — {new Date(s.createdAt).toLocaleDateString('fr-FR')} ({Number(s.grandTotal).toLocaleString('fr-FR')} XOF)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Mode de remboursement
                </label>
                <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Aucun remboursement (Échange ou Avoir)</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Articles de la vente éligibles */}
            {saleId && (
              <div
                style={{
                  background: 'var(--surface-muted, #f8fafc)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                  Articles retournables sur cette transaction :
                </div>

                {linesLoading ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vérification des articles...</div>
                ) : eligibleLines.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Tous les articles de cette vente ont déjà été retournés.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {eligibleLines.map((l) => (
                      <div
                        key={l.saleLineId}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.5fr 120px 180px',
                          gap: '0.6rem',
                          alignItems: 'center',
                          background: 'var(--surface)',
                          padding: '0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{l.productNameSnapshot}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Reste retournable : {l.remaining} sur {l.quantitySold} vendu(s)
                          </div>
                        </div>

                        <input
                          type="number"
                          min="0"
                          max={l.remaining}
                          step="0.0001"
                          placeholder="Qté à retourner"
                          value={selectedQuantities[l.saleLineId] ?? ''}
                          onChange={(e) => setSelectedQuantities((prev) => ({ ...prev, [l.saleLineId]: e.target.value }))}
                          style={{ width: '100%' }}
                        />

                        <select
                          value={selectedConditions[l.saleLineId] ?? 'GOOD'}
                          onChange={(e) =>
                            setSelectedConditions((prev) => ({
                              ...prev,
                              [l.saleLineId]: e.target.value as 'GOOD' | 'DEFECTIVE',
                            }))
                          }
                          style={{ width: '100%', fontSize: '0.82rem' }}
                        >
                          <option value="GOOD">✓ Bon état (Remis en stock)</option>
                          <option value="DEFECTIVE">✕ Défectueux (Non remis)</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Motif explicite du retour *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Erreur de taille demandée par le client"
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Annuler
              </button>
              <button type="submit" disabled={submitting || !saleId} className="primary">
                {submitting ? 'Validation...' : 'Confirmer le retour marchandise'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar avec recherche */}
      <div className="table-toolbar">
        <div className="table-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par référence, motif, article..."
          />
        </div>
      </div>

      {/* Tableau des retours */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Chargement des retours...
        </div>
      ) : filteredReturns.length === 0 ? (
        returns.length === 0 ? (
          <EmptyState
            title="Aucun retour enregistré"
            description="Toutes les ventes réalisées sont conformes. Aucun article n'a été retourné."
          />
        ) : (
          <EmptyState
            title="Aucun résultat"
            description={`Aucun retour ne correspond à « ${search} ».`}
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
                <th>Date & Vente</th>
                <th>Motif du retour</th>
                <th>Articles concernés</th>
                <th>Remboursement</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReturns.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {new Date(r.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary)' }}>
                      Vente #{r.saleId.slice(0, 8)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.reason}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem' }}>
                      {r.lines.map((l) => (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <span>{l.productNameSnapshot} ×{l.quantity}</span>
                          <span
                            className={`badge ${l.condition === 'GOOD' ? 'badge-success' : 'badge-danger'}`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {l.condition === 'GOOD' ? 'Bon état' : 'Défectueux'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--warning-text, #b45309)' }}>
                      {Number(r.refundAmount).toLocaleString('fr-FR')} XOF
                    </span>
                    {r.refundMethod ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>via {r.refundMethod}</div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Échange standard</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination retours */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredReturns.length}
            pageSize={20}
            onPageChange={setCurrentPage}
            itemName="retours"
          />
        </div>
      )}
    </div>
  );
}

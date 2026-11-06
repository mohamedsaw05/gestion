import { useEffect, useState, useMemo } from 'react';
import { api, fetchBlob, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { Pagination } from '../components/Pagination';
import { ReceiptViewModal } from '../components/ReceiptViewModal';

interface DocumentRow {
  id: string;
  type: string;
  number: string;
  saleId: string | null;
  orderId: string | null;
  returnId: string | null;
  createdAt: string;
  contentSnapshot: { grandTotal: string; currency: string };
}
interface Sale {
  id: string;
  createdAt: string;
  grandTotal: string;
  currency: string;
  status: string;
}
interface Order {
  id: string;
  status: string;
  subtotal: string;
  currency: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'Reçu',
  INVOICE: 'Facture',
  QUOTE: 'Devis',
  CREDIT_NOTE: 'Avoir',
  DELIVERY_NOTE: 'Bon de livraison',
};
const TYPE_BADGE: Record<string, string> = {
  RECEIPT: 'badge-info',
  INVOICE: 'badge-success',
  QUOTE: 'badge-warning',
  CREDIT_NOTE: 'badge-danger',
  DELIVERY_NOTE: 'badge-info',
};

export function DocumentsPage() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const hasCapability = (key: string) => profile?.enabledCapabilities.includes(key) ?? false;

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showIssuePanel, setShowIssuePanel] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  const handleToggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllDocs = () => {
    setSelectedDocIds(new Set(filteredDocuments.map((d) => d.id)));
  };

  const handleDeselectAllDocs = () => {
    setSelectedDocIds(new Set());
  };

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get<DocumentRow[]>('/documents')
      .then(setDocuments)
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des documents', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get<Sale[]>('/sales').then((s) => setSales(s.filter((x) => x.status === 'COMPLETED'))).catch(() => {});
    if (hasCapability('invoicing')) {
      api.get<Order[]>('/orders').then((o) => setOrders(o.filter((x) => x.status !== 'CANCELLED'))).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issueInvoice = async () => {
    if (!selectedSaleId) return;
    try {
      await api.post('/documents/invoices', { saleId: selectedSaleId });
      addToast('Facture commerciale émise avec succès.', 'success');
      setSelectedSaleId('');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'émission de la facture", 'error');
    }
  };

  const issueQuote = async () => {
    if (!selectedOrderId) return;
    try {
      await api.post('/documents/quotes', { orderId: selectedOrderId });
      addToast('Devis proforma émis avec succès.', 'success');
      setSelectedOrderId('');
      load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Erreur lors de l'émission du devis", 'error');
    }
  };

  const openPdf = async (id: string) => {
    setDownloadingId(id);
    try {
      const blob = await fetchBlob(`/documents/${id}/pdf`);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Impossible de générer le document PDF', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const previewTemplatePdf = async (template: string) => {
    try {
      addToast(`Génération de l'aperçu du modèle ${template}...`, 'info');
      const blob = await fetchBlob(`/documents/preview/${template}`);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Impossible de prévisualiser le modèle', 'error');
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      if (typeFilter !== 'ALL' && d.type !== typeFilter) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        d.number.toLowerCase().includes(q) ||
        (d.saleId && d.saleId.toLowerCase().includes(q)) ||
        (d.orderId && d.orderId.toLowerCase().includes(q))
      );
    });
  }, [documents, typeFilter, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, search]);

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * 20;
    return filteredDocuments.slice(start, start + 20);
  }, [filteredDocuments, currentPage]);

  const stats = useMemo(() => {
    return {
      total: documents.length,
      invoices: documents.filter((d) => d.type === 'INVOICE').length,
      receipts: documents.filter((d) => d.type === 'RECEIPT').length,
      quotes: documents.filter((d) => d.type === 'QUOTE').length,
    };
  }, [documents]);

  return (
    <div>
      <PageHeader
        title="Facturation Commerciale & Pièces Comptables"
        subtitle="Registre officiel et infalsifiable des factures, reçus fiscaux, devis proforma et bons de livraison"
        badges={[
          { label: `${stats.invoices} facture(s) officielle(s)`, variant: 'success' },
          { label: `${stats.receipts} reçu(s) de caisse`, variant: 'info' },
          { label: `${stats.quotes} devis proforma`, variant: 'warning' },
        ]}
        primaryAction={{
          label: showIssuePanel ? 'Fermer l’émetteur' : '+ Émettre une pièce comptable',
          onClick: () => setShowIssuePanel((p) => !p),
          variant: showIssuePanel ? 'secondary' : 'primary',
        }}
      />

      {/* Émetteur de facture / devis */}
      {showIssuePanel && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Émission d'une pièce comptable certifiée</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Émettre facture */}
            <div
              style={{
                background: 'var(--surface-muted, #f8fafc)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Facture commerciale définitive</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Émise à partir d'une vente déjà réglée pour générer la pièce fiscale définitive avec mentions légales.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={selectedSaleId}
                  onChange={(e) => setSelectedSaleId(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  <option value="">Sélectionner une vente...</option>
                  {sales.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id.slice(0, 8)} — {new Date(s.createdAt).toLocaleDateString('fr-FR')} ({Number(s.grandTotal).toLocaleString('fr-FR')} {s.currency})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={issueInvoice}
                  disabled={!selectedSaleId}
                  className="primary"
                  style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}
                >
                  Générer
                </button>
              </div>
            </div>

            {/* Émettre devis */}
            <div
              style={{
                background: 'var(--surface-muted, #f8fafc)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Devis commercial / Facture Proforma</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Émis pour soumission de prix formelle avec délai de validité légal.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  <option value="">Sélectionner une commande...</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.id.slice(0, 8)} — {new Date(o.createdAt).toLocaleDateString('fr-FR')} ({Number(o.subtotal).toLocaleString('fr-FR')} {o.currency})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={issueQuote}
                  disabled={!selectedOrderId}
                  className="primary"
                  style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}
                >
                  Générer
                </button>
              </div>
            </div>
          </div>

          {/* Aperçu des formats conformes */}
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)' }}>
              Normes de Présentation Fiscale :
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { key: 'STANDARD_PRO', label: 'Standard Pro' },
                { key: 'COMPACT', label: 'Ticket / Compact' },
                { key: 'DETAILED', label: 'Détaillé BTP / Gros' },
                { key: 'ELEGANT', label: 'Élégant Boutique' },
                { key: 'SERVICES', label: 'Prestations / Atelier' },
              ].map((tpl) => (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => previewTemplatePdf(tpl.key)}
                  className="secondary"
                  style={{ fontSize: '0.76rem', padding: '0.3rem 0.65rem', fontWeight: 600 }}
                >
                  📄 {tpl.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table toolbar */}
      <div className="table-toolbar">
        <div className="table-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par n° de document ou transaction..."
          />
        </div>
        <div className="segmented-control">
          <button
            className={`segmented-button ${typeFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setTypeFilter('ALL')}
          >
            Tous ({documents.length})
          </button>
          <button
            className={`segmented-button ${typeFilter === 'INVOICE' ? 'active' : ''}`}
            onClick={() => setTypeFilter('INVOICE')}
          >
            Factures ({stats.invoices})
          </button>
          <button
            className={`segmented-button ${typeFilter === 'RECEIPT' ? 'active' : ''}`}
            onClick={() => setTypeFilter('RECEIPT')}
          >
            Reçus ({stats.receipts})
          </button>
          <button
            className={`segmented-button ${typeFilter === 'QUOTE' ? 'active' : ''}`}
            onClick={() => setTypeFilter('QUOTE')}
          >
            Devis ({stats.quotes})
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={handleSelectAllDocs}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
          >
            ⚡ Tout sélectionner ({filteredDocuments.length})
          </button>
          {selectedDocIds.size > 0 && (
            <button
              type="button"
              onClick={handleDeselectAllDocs}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            >
              ✕ Désélectionner ({selectedDocIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Table des documents */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Chargement des documents...
        </div>
      ) : filteredDocuments.length === 0 ? (
        documents.length === 0 ? (
          <EmptyState
            title="Aucun document émis"
            description="Les reçus et factures sont générés automatiquement lors des encaissements ou sur demande."
          />
        ) : (
          <EmptyState
            title="Aucun résultat"
            description="Aucun document ne correspond à vos filtres actuels."
            action={{
              label: 'Réinitialiser les filtres',
              onClick: () => {
                setSearch('');
                setTypeFilter('ALL');
              },
            }}
          />
        )
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredDocuments.length > 0 && selectedDocIds.size === filteredDocuments.length}
                    onChange={(e) => {
                      if (e.target.checked) handleSelectAllDocs();
                      else handleDeselectAllDocs();
                    }}
                    title="Tout sélectionner / désélectionner"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Type de pièce</th>
                <th>Numéro de document</th>
                <th>Date d'émission</th>
                <th>Montant total</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDocuments.map((d) => (
                <tr key={d.id} style={{ background: selectedDocIds.has(d.id) ? '#f0fdf4' : undefined }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedDocIds.has(d.id)}
                      onChange={() => handleToggleDoc(d.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <span className={`badge ${TYPE_BADGE[d.type] ?? ''}`}>
                      {TYPE_LABELS[d.type] ?? d.type}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                      {d.number}
                    </span>
                    {d.saleId && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Rattaché à la vente #{d.saleId.slice(0, 8)}
                      </div>
                    )}
                    {d.orderId && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Rattaché à la commande #{d.orderId.slice(0, 8)}
                      </div>
                    )}
                  </td>
                  <td>
                    {new Date(d.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700 }}>
                      {Number(d.contentSnapshot.grandTotal).toLocaleString('fr-FR')} {d.contentSnapshot.currency}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setActiveDocId(d.id)}
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem' }}
                        title="Consulter et imprimer le reçu/document"
                      >
                        👁️ Aperçu
                      </button>
                      <button
                        type="button"
                        onClick={() => openPdf(d.id)}
                        disabled={downloadingId === d.id}
                        className="primary"
                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem' }}
                        title="Télécharger le PDF"
                      >
                        {downloadingId === d.id ? '...' : '📄 PDF'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Contrôles de pagination standard 20 éléments */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredDocuments.length}
            pageSize={20}
            onPageChange={setCurrentPage}
            itemName="documents"
          />
        </div>
      )}

      {/* Modal d'aperçu du document / reçu */}
      {activeDocId && (
        <ReceiptViewModal
          documentId={activeDocId}
          onClose={() => setActiveDocId(null)}
        />
      )}
    </div>
  );
}

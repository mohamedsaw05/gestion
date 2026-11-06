import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { Pagination } from '../components/Pagination';
import { ReceiptViewModal } from '../components/ReceiptViewModal';

interface Sale {
  id: string;
  createdAt: string;
  grandTotal: string;
  currency: string;
  status: string;
  customerName?: string;
  locationName?: string;
}

interface DocumentRef {
  id: string;
  saleId: string | null;
  type: string;
}

export function SalesPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [documents, setDocuments] = useState<DocumentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Sale[]>('/sales'),
      api.get<DocumentRef[]>('/documents').catch(() => []),
    ])
      .then(([salesData, docsData]) => {
        setSales(salesData);
        setDocuments(docsData);
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des ventes', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        s.grandTotal.includes(q) ||
        s.status.toLowerCase().includes(q) ||
        (s.customerName && s.customerName.toLowerCase().includes(q))
      );
    });
  }, [sales, search, statusFilter]);

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * 20;
    return filteredSales.slice(start, start + 20);
  }, [filteredSales, currentPage]);

  const stats = useMemo(() => {
    const totalAmount = sales
      .filter((s) => s.status === 'COMPLETED')
      .reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const todaySales = sales.filter((s) => s.createdAt.startsWith(today));
    const todayAmount = todaySales
      .filter((s) => s.status === 'COMPLETED')
      .reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0);

    return {
      totalCount: sales.length,
      completedCount: sales.filter((s) => s.status === 'COMPLETED').length,
      totalAmount,
      todayCount: todaySales.length,
      todayAmount,
      currency: sales[0]?.currency ?? 'XOF',
    };
  }, [sales]);

  const handleOpenReceiptForSale = (saleId: string) => {
    const doc = documents.find((d) => d.saleId === saleId && d.type === 'RECEIPT');
    if (doc) {
      setActiveReceiptId(doc.id);
    } else {
      addToast('Aucun reçu généré pour cette transaction', 'info');
    }
  };

  return (
    <div>
      <PageHeader
        title="Historique des Ventes"
        subtitle="Journal d'audit de toutes les transactions de vente réalisées en caisse ou comptoir"
        badges={[
          { label: `${stats.completedCount} vente${stats.completedCount > 1 ? 's' : ''} validée${stats.completedCount > 1 ? 's' : ''}`, variant: 'success' },
          { label: `CA Total : ${stats.totalAmount.toLocaleString('fr-FR')} ${stats.currency}`, variant: 'info' },
        ]}
        primaryAction={{
          label: '+ Nouvelle Vente',
          onClick: () => navigate('/sales/new'),
        }}
      />

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{stats.todayAmount.toLocaleString('fr-FR')} {stats.currency}</div>
          <div className="kpi-label">Chiffre d'Affaires du Jour</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {stats.todayCount} transaction{stats.todayCount > 1 ? 's' : ''} aujourd'hui
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{stats.totalAmount.toLocaleString('fr-FR')} {stats.currency}</div>
          <div className="kpi-label">Chiffre d'Affaires Cumulé</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Sur l'ensemble des ventes validées
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{stats.totalCount}</div>
          <div className="kpi-label">Transactions Enregistrées</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {stats.completedCount} complétée{stats.completedCount > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Toolbar avec onglets et recherche */}
      <div className="table-toolbar">
        <div className="table-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par identifiant, montant..."
          />
        </div>
        <div className="segmented-control">
          <button
            className={`segmented-button ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Toutes ({sales.length})
          </button>
          <button
            className={`segmented-button ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('COMPLETED')}
          >
            Complétées ({sales.filter((s) => s.status === 'COMPLETED').length})
          </button>
          <button
            className={`segmented-button ${statusFilter === 'CANCELLED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('CANCELLED')}
          >
            Annulées ({sales.filter((s) => s.status === 'CANCELLED').length})
          </button>
        </div>
      </div>

      {/* Tableau des ventes */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Chargement de l'historique des ventes...
        </div>
      ) : filteredSales.length === 0 ? (
        sales.length === 0 ? (
          <EmptyState
            title="Aucune vente enregistrée"
            description="Le journal des ventes est vide. Réalisez votre première vente depuis le module d'encaissement."
            action={{
              label: '+ Effectuer une vente',
              onClick: () => navigate('/sales/new'),
            }}
          />
        ) : (
          <EmptyState
            title="Aucun résultat"
            description="Aucune transaction ne correspond à vos critères de recherche ou de filtre."
            action={{
              label: 'Réinitialiser les filtres',
              onClick: () => {
                setSearch('');
                setStatusFilter('ALL');
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
                <th>Réf. Vente</th>
                <th>Montant Total</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.map((s) => {
                const hasReceipt = documents.some((d) => d.saleId === s.id && d.type === 'RECEIPT');
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {new Date(s.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(s.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                        #{s.id.slice(0, 8)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        {Number(s.grandTotal).toLocaleString('fr-FR')} {s.currency}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          s.status === 'COMPLETED'
                            ? 'badge-success'
                            : s.status === 'CANCELLED'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {s.status === 'COMPLETED' ? 'Complétée' : s.status === 'CANCELLED' ? 'Annulée' : s.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {hasReceipt ? (
                        <button
                          type="button"
                          onClick={() => handleOpenReceiptForSale(s.id)}
                          className="btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '0.25rem 0.55rem' }}
                        >
                          🧾 Voir reçu
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Contrôles de pagination standard 20 éléments */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredSales.length}
            pageSize={20}
            onPageChange={setCurrentPage}
            itemName="ventes"
          />
        </div>
      )}

      {/* Modal d'aperçu du reçu */}
      {activeReceiptId && (
        <ReceiptViewModal
          documentId={activeReceiptId}
          onClose={() => setActiveReceiptId(null)}
        />
      )}
    </div>
  );
}

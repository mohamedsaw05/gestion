import { useEffect, useState, useCallback } from 'react';
import { api, ApiError, fetchBlob } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { formatCompactNumber } from '../lib/formatters';

interface ReportSummary {
  period: { startDate: string | null; endDate: string | null };
  currency: string;
  sales: {
    totalSalesCount: number;
    completedCount: number;
    cancelledCount: number;
    grossTotal: number;
    netSales: number;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    amountPaid: number;
    balanceDue: number;
    averageCart: number;
  };
  returns: {
    count: number;
    refundedTotal: number;
  };
  inventory: {
    totalUnitsOnHand: number;
    valuationTotal: number;
    lowStockCount: number;
  };
  credit: {
    outstandingDebtTotal: number;
    indebtedCustomersCount: number;
  };
}

interface DailySale {
  date: string;
  count: number;
  revenue: number;
  amountPaid: number;
  balanceDue: number;
}

interface PaymentMethodStat {
  method: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

interface CategoryStat {
  categoryName: string;
  itemsSold: number;
  revenue: number;
  percentage: number;
}

interface LocationItem {
  id: string;
  name: string;
}

export function ReportsPage() {
  const { addToast } = useToast();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodStat[]>([]);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);

  const [datePreset, setDatePreset] = useState<'today' | '7d' | '30d' | 'all'>('30d');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'daily' | 'payments' | 'categories'>('daily');

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const getDateRange = useCallback(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const start = now.toISOString().slice(0, 10);
      return { startDate: start, endDate: start };
    }
    if (datePreset === '7d') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: past.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) };
    }
    if (datePreset === '30d') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: past.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) };
    }
    return {};
  }, [datePreset]);

  const loadData = useCallback(() => {
    setLoading(true);

    const { startDate, endDate } = getDateRange();
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (selectedLocation) params.set('locationId', selectedLocation);

    const query = params.toString() ? `?${params.toString()}` : '';

    Promise.all([
      api.get<ReportSummary>(`/reports/summary${query}`),
      api.get<DailySale[]>(`/reports/daily${query}`),
      api.get<PaymentMethodStat[]>(`/reports/payment-methods${query}`),
      api.get<CategoryStat[]>(`/reports/categories${query}`),
      api.get<LocationItem[]>('/locations').catch(() => []),
    ])
      .then(([sumData, dailyData, payData, catData, locData]) => {
        setSummary(sumData);
        setDailySales(dailyData);
        setPaymentMethods(payData);
        setCategories(catData);
        if (locData.length > 0) setLocations(locData);
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des rapports', 'error'))
      .finally(() => setLoading(false));
  }, [getDateRange, selectedLocation, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const { startDate, endDate } = getDateRange();
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedLocation) params.set('locationId', selectedLocation);
      const query = params.toString() ? `?${params.toString()}` : '';

      const blob = await fetchBlob(`/reports/export/sales.csv${query}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-ventes-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast('Export CSV téléchargé avec succès.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Erreur lors de l'export CSV", 'error');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (val: number, cur = 'XOF') => {
    if (Math.abs(val) >= 1_000_000) {
      return formatCompactNumber(val, cur);
    }
    return `${val.toLocaleString('fr-FR')} ${cur}`;
  };

  const translateMethod = (method: string) => {
    const map: Record<string, string> = {
      CASH: 'Espèces',
      MOBILE_MONEY: 'Mobile Money',
      CARD: 'Carte bancaire',
      BANK_TRANSFER: 'Virement',
      CHECK: 'Chèque',
    };
    return map[method] ?? method;
  };

  return (
    <div>
      <PageHeader
        title="Rapports & Indicateurs d'Activité"
        subtitle="Analyses financières, marges nettes, rotation des stocks et encaissements agrégés côté serveur"
        badges={
          summary
            ? [
                { label: `CA Net : ${formatCurrency(summary.sales.netSales, summary.currency)}`, variant: 'success' },
                { label: `${summary.sales.completedCount} ventes`, variant: 'info' },
              ]
            : []
        }
        primaryAction={{
          label: exporting ? 'Génération...' : '⬇ Télécharger rapport CSV',
          onClick: handleExportCsv,
        }}
      />

      {/* Barre de filtres de période et emplacement */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          background: 'var(--surface)',
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Période :</span>
          <div className="segmented-control">
            <button
              className={`segmented-button ${datePreset === 'today' ? 'active' : ''}`}
              onClick={() => setDatePreset('today')}
            >
              Aujourd'hui
            </button>
            <button
              className={`segmented-button ${datePreset === '7d' ? 'active' : ''}`}
              onClick={() => setDatePreset('7d')}
            >
              7 jours
            </button>
            <button
              className={`segmented-button ${datePreset === '30d' ? 'active' : ''}`}
              onClick={() => setDatePreset('30d')}
            >
              30 jours
            </button>
            <button
              className={`segmented-button ${datePreset === 'all' ? 'active' : ''}`}
              onClick={() => setDatePreset('all')}
            >
              Tout l'historique
            </button>
          </div>
        </div>

        {locations.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Emplacement :</span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: '0.85rem',
              }}
            >
              <option value="">Tous les dépôts / boutiques</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Calcul des agrégations financières en cours...
        </div>
      ) : summary ? (
        <>
          {/* Grille de KPI */}
          <div className="kpi-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="kpi-card">
              <div className="kpi-value">{formatCurrency(summary.sales.netSales, summary.currency)}</div>
              <div className="kpi-label">Chiffre d'Affaires Net</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Brut: {formatCurrency(summary.sales.grossTotal, summary.currency)} · Retours: -{formatCurrency(summary.returns.refundedTotal, summary.currency)}
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-value">{summary.sales.completedCount}</div>
              <div className="kpi-label">Transactions Encaissées</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Panier moyen : {formatCurrency(summary.sales.averageCart, summary.currency)}
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-value">{formatCurrency(summary.inventory.valuationTotal, summary.currency)}</div>
              <div className="kpi-label">Valorisation Actuelle du Stock</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {summary.inventory.totalUnitsOnHand.toLocaleString('fr-FR')} unités physiques
              </div>
            </div>

            <div className="kpi-card" style={{ borderColor: summary.inventory.lowStockCount > 0 ? '#f59e0b' : 'var(--border)' }}>
              <div className="kpi-value" style={{ color: summary.inventory.lowStockCount > 0 ? '#b45309' : 'inherit' }}>
                {summary.inventory.lowStockCount}
              </div>
              <div className="kpi-label">Alertes Stock Critique</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Articles au seuil de rupture
              </div>
            </div>

            <div className="kpi-card" style={{ borderColor: summary.credit.outstandingDebtTotal > 0 ? '#dc2626' : 'var(--border)' }}>
              <div className="kpi-value" style={{ color: summary.credit.outstandingDebtTotal > 0 ? '#b91c1c' : 'inherit' }}>
                {formatCurrency(summary.credit.outstandingDebtTotal, summary.currency)}
              </div>
              <div className="kpi-label">Créances Clients Dehors</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {summary.credit.indebtedCustomersCount} client(s) avec solde dû
              </div>
            </div>
          </div>

          {/* Onglets d'analyse détaillée */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
              <button
                onClick={() => setActiveTab('daily')}
                style={{
                  border: 'none',
                  background: activeTab === 'daily' ? 'var(--surface)' : 'transparent',
                  borderBottom: activeTab === 'daily' ? '2px solid var(--primary)' : 'none',
                  padding: '0.85rem 1.25rem',
                  fontWeight: 600,
                  borderRadius: 0,
                  cursor: 'pointer',
                  color: activeTab === 'daily' ? 'var(--primary)' : 'var(--text)',
                }}
              >
                Ventes par Jour
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                style={{
                  border: 'none',
                  background: activeTab === 'payments' ? 'var(--surface)' : 'transparent',
                  borderBottom: activeTab === 'payments' ? '2px solid var(--primary)' : 'none',
                  padding: '0.85rem 1.25rem',
                  fontWeight: 600,
                  borderRadius: 0,
                  cursor: 'pointer',
                  color: activeTab === 'payments' ? 'var(--primary)' : 'var(--text)',
                }}
              >
                Moyens de Paiement
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                style={{
                  border: 'none',
                  background: activeTab === 'categories' ? 'var(--surface)' : 'transparent',
                  borderBottom: activeTab === 'categories' ? '2px solid var(--primary)' : 'none',
                  padding: '0.85rem 1.25rem',
                  fontWeight: 600,
                  borderRadius: 0,
                  cursor: 'pointer',
                  color: activeTab === 'categories' ? 'var(--primary)' : 'var(--text)',
                }}
              >
                Ventes par Catégorie
              </button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {activeTab === 'daily' && (
                dailySales.length === 0 ? (
                  <EmptyState
                    title="Aucune vente sur la période"
                    description="Aucune transaction n'a été enregistrée pour les filtres de date sélectionnés."
                  />
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Nombre de Ventes</th>
                        <th>Chiffre d'Affaires</th>
                        <th>Montant Encaissé</th>
                        <th>Solde Dû</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySales.map((d) => (
                        <tr key={d.date}>
                          <td>
                            <span style={{ fontWeight: 600 }}>{d.date}</span>
                          </td>
                          <td>{d.count}</td>
                          <td>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(d.revenue, summary.currency)}</span>
                          </td>
                          <td>
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                              {formatCurrency(d.amountPaid, summary.currency)}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: d.balanceDue > 0 ? 'var(--danger)' : 'inherit', fontWeight: d.balanceDue > 0 ? 700 : 400 }}>
                              {formatCurrency(d.balanceDue, summary.currency)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeTab === 'payments' && (
                paymentMethods.length === 0 ? (
                  <EmptyState
                    title="Aucun encaissement"
                    description="Aucun paiement n'a été reçu sur cette période."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {paymentMethods.map((pm) => (
                      <div
                        key={pm.method}
                        style={{
                          padding: '1rem',
                          background: 'var(--surface-muted, #f8fafc)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                          <span>{translateMethod(pm.method)} ({pm.count} encaissement{pm.count > 1 ? 's' : ''})</span>
                          <span>{formatCurrency(pm.totalAmount, summary.currency)} ({pm.percentage}%)</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(pm.percentage, 100)}%`,
                              background: 'var(--primary)',
                              borderRadius: '4px',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeTab === 'categories' && (
                categories.length === 0 ? (
                  <EmptyState
                    title="Aucune catégorie vendue"
                    description="Aucun article catégorisé n'a été vendu sur cette période."
                  />
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Catégorie de Produits</th>
                        <th>Articles Vendus</th>
                        <th>Chiffre d'Affaires</th>
                        <th>Part du CA Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((c) => (
                        <tr key={c.categoryName}>
                          <td>
                            <span style={{ fontWeight: 600 }}>{c.categoryName}</span>
                          </td>
                          <td>{c.itemsSold}</td>
                          <td>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(c.revenue, summary.currency)}</span>
                          </td>
                          <td>
                            <span className="badge badge-info">{c.percentage}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

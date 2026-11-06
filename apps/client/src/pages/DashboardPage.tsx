import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';
interface Summary {
  currency: string;
  sales: { completedCount: number; grossTotal: number; amountPaid: number; balanceDue: number };
  returns: { refundedTotal: number };
  inventory: { valuationAtCost: number; valuationAtSale: number; unknownCostUnits: number; lowStockCount: number };
  credit: { outstandingDebtTotal: number; indebtedCustomersCount: number };
}
interface DailyPoint { date: string; revenue: number; count: number }
interface RecentSale {
  id: string; saleNumber?: string; createdAt: string; grandTotal: number; amountPaid?: number;
  currency?: string; status?: string; lines?: Array<{ productNameSnapshot?: string; product?: { name?: string }; quantity?: number }>;
}

function periodDates(period: Period, customStart: string, customEnd: string) {
  const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const end = new Date();
  const start = new Date(end);
  if (period === 'today') start.setHours(0, 0, 0, 0);
  if (period === 'week') { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
  if (period === 'month') start.setDate(1);
  if (period === 'year') { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
  if (period === 'custom') return { startDate: customStart, endDate: customEnd };
  return { startDate: localDate(start), endDate: localDate(end) };
}

function money(value: number | null | undefined, currency: string) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'XOF', maximumFractionDigits: 0 }).format(Number(value));
}

export function DashboardPage() {
  const { profile, menu } = useAuth();
  const [period, setPeriod] = useState<Period>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestFailed, setRequestFailed] = useState(false);
  const [reportsFailed, setReportsFailed] = useState(false);
  const [salesFailed, setSalesFailed] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const canReadSales = menu.some((item) => ['sales', 'reports'].includes(item.key));
  const canReadReports = menu.some((item) => item.key === 'reports');
  const canReadStock = menu.some((item) => ['inventory', 'stock'].includes(item.key));
  const canReadCredit = menu.some((item) => item.key === 'credit');
  const dates = useMemo(() => periodDates(period, customStart, customEnd), [period, customStart, customEnd]);

  const refresh = useCallback(async () => {
    if (!profile?.tenantId) return;
    setLoading(true);
    setRequestFailed(false);
    const query = new URLSearchParams();
    if (dates.startDate) query.set('startDate', dates.startDate);
    if (dates.endDate) query.set('endDate', dates.endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const tasks: Promise<unknown>[] = [];
    let summaryTask = -1;
    let dailyTask = -1;
    let salesTask = -1;
    if (canReadReports) {
      summaryTask = tasks.length;
      tasks.push(api.get<Summary>(`/reports/summary${suffix}`).then((value) => setSummary(value)));
      dailyTask = tasks.length;
      tasks.push(api.get<DailyPoint[]>(`/reports/daily${suffix}`).then((value) => setDaily(Array.isArray(value) ? value : [])));
    }
    if (canReadSales) {
      salesTask = tasks.length;
      tasks.push(api.get<RecentSale[]>('/sales?limit=5').then((value) => setRecentSales(Array.isArray(value) ? value.slice(0, 5) : [])));
    }
    try {
      const results = await Promise.allSettled(tasks);
      setRequestFailed(results.length > 0 && results.every((item) => item.status === 'rejected'));
      setReportsFailed([summaryTask, dailyTask].some((index) => index >= 0 && results[index]?.status === 'rejected'));
      setSalesFailed(salesTask >= 0 && results[salesTask]?.status === 'rejected');
      setLastSync(new Date());
    } finally {
      setLoading(false);
    }
  }, [profile?.tenantId, dates.startDate, dates.endDate, canReadReports, canReadSales]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) void refresh(); }, 45_000);
    const onFocus = () => { if (navigator.onLine) void refresh(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('online', onFocus); };
  }, [refresh]);

  const currency = summary?.currency || 'XOF';
  const chartMax = Math.max(1, ...daily.map((point) => Number(point.revenue) || 0));
  const chartPoints = daily.slice(-14);

  const cards = [
    { label: 'Chiffre d’affaires', value: canReadReports ? money(summary?.sales.grossTotal, currency) : 'Selon vos droits', hint: 'Ventes validées sur la période', tone: 'blue' },
    { label: 'Ventes', value: canReadReports ? (summary ? String(summary.sales.completedCount) : '—') : 'Selon vos droits', hint: 'Transactions terminées', tone: 'violet' },
    { label: 'Montant encaissé', value: canReadReports ? money(summary?.sales.amountPaid, currency) : 'Selon vos droits', hint: 'Paiements enregistrés', tone: 'green' },
    { label: 'Crédit restant', value: canReadReports && canReadCredit ? money(summary?.credit.outstandingDebtTotal, currency) : 'Selon vos droits', hint: 'Créances ouvertes', tone: 'amber' },
    { label: 'Valeur du stock au prix public', value: canReadReports && canReadStock ? money(summary?.inventory.valuationAtSale, currency) : 'Selon vos droits', hint: 'Valorisation indicative, pas un bénéfice', tone: 'cyan' },
    { label: 'Stock faible', value: canReadStock && summary ? String(summary.inventory.lowStockCount) : (canReadStock ? '—' : 'Selon vos droits'), hint: 'Produits au seuil ou en dessous', tone: 'rose' },
  ];

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Vue d’ensemble</p>
          <h1>Tableau de bord</h1>
          <p className="dashboard-subtitle">Activité réelle de votre organisation, selon vos autorisations.</p>
        </div>
        <div className="dashboard-controls">
          <label className="dashboard-period-label" htmlFor="dashboard-period">Période</label>
          <select id="dashboard-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            <option value="today">Aujourd’hui</option><option value="week">7 derniers jours</option>
            <option value="month">Ce mois</option><option value="year">Cette année</option><option value="custom">Personnalisée</option>
          </select>
          {period === 'custom' && <div className="dashboard-custom-dates"><input aria-label="Date de début" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /><input aria-label="Date de fin" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div>}
          <button type="button" onClick={() => void refresh()} disabled={loading}>Actualiser</button>
        </div>
      </header>

      <div className="dashboard-sync-status" role="status" aria-live="polite">
        <span className={navigator.onLine ? 'sync-dot online' : 'sync-dot'} />
        {isOnline ? (lastSync ? `Synchronisé à ${lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Connexion au serveur…') : 'Hors connexion — les opérations ne sont pas enregistrées.'}
        {loading && <span className="dashboard-loading">Mise à jour…</span>}
      </div>
      {requestFailed && <div className="dashboard-error" role="alert">Impossible de charger les données du serveur. Les valeurs indisponibles restent affichées comme telles.</div>}

      <section className="dashboard-kpis" aria-label="Indicateurs de la période">
        {cards.map((card) => <article className={`dashboard-kpi ${card.tone}`} key={card.label}>
          <p>{card.label}</p><strong>{card.value}</strong><span>{card.hint}</span>
        </article>)}
      </section>

      <section className="dashboard-panels">
        <article className="dashboard-panel dashboard-chart-panel">
          <div className="dashboard-panel-heading"><div><h2>Évolution des ventes</h2><p>Chiffre d’affaires par jour · {currency}</p></div><Link to="/reports">Voir les rapports</Link></div>
          {canReadReports ? reportsFailed ? <div className="dashboard-empty">Impossible de charger le rapport pour le moment.</div> : chartPoints.length ? <div className="dashboard-chart" role="img" aria-label="Chiffre d’affaires par jour">
            {chartPoints.map((point) => <div className="dashboard-bar-column" key={point.date} title={`${new Date(point.date).toLocaleDateString('fr-FR')}: ${money(point.revenue, currency)}`}>
              <span className="dashboard-bar-value">{money(point.revenue, currency)}</span><div className="dashboard-bar" style={{ height: `${Math.max(4, (Number(point.revenue) / chartMax) * 100)}%` }} /><span className="dashboard-bar-label">{new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
            </div>)}
          </div> : <div className="dashboard-empty">{loading ? 'Chargement des ventes…' : 'Aucune vente sur cette période.'}</div> : <div className="dashboard-empty">Les rapports ne sont pas inclus dans vos autorisations.</div>}
          {summary && <div className="dashboard-period-totals"><span>Ventes terminées <strong>{summary.sales.completedCount}</strong></span><span>Reste à encaisser <strong>{money(summary.sales.balanceDue, currency)}</strong></span><span>Retours <strong>{money(summary.returns.refundedTotal, currency)}</strong></span></div>}
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><h2>Activité récente</h2><p>Dernières ventes enregistrées</p></div><Link to="/sales">Tout voir</Link></div>
          {canReadSales ? salesFailed ? <div className="dashboard-empty">Impossible de charger les ventes récentes.</div> : recentSales.length ? <div className="dashboard-recent-list">{recentSales.map((sale) => <div className="dashboard-recent-item" key={sale.id}>
            <div className="dashboard-recent-icon">{sale.status === 'COMPLETED' ? '✓' : '•'}</div><div className="dashboard-recent-main"><strong>Vente {sale.id.slice(0, 8)}</strong><span>{sale.lines?.length ? sale.lines.map((line) => line.productNameSnapshot || line.product?.name || 'Article').slice(0, 2).join(', ') : 'Détails non disponibles'}</span><small>{new Date(sale.createdAt).toLocaleString('fr-FR')}</small></div><b>{money(Number(sale.grandTotal), sale.currency || currency)}</b>
          </div>)}</div> : <div className="dashboard-empty">{loading ? 'Chargement…' : 'Aucune vente récente.'}</div> : <div className="dashboard-empty">Les ventes ne sont pas incluses dans vos autorisations.</div>}
        </article>
      </section>
      {!canReadReports && !canReadSales && !canReadStock && <div className="dashboard-empty">Aucun indicateur commercial n’est accessible avec le rôle actuel.</div>}
    </main>
  );
}

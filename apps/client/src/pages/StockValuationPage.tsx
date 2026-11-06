import { useEffect, useState, useCallback, useMemo } from 'react';
import { api, ApiError, fetchBlob } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { formatCompactNumber } from '../lib/formatters';

interface StockValuationData {
  asOf: string;
  currency: string;
  scope: {
    locationId: string | null;
    locationName: string;
    categoryId: string | null;
    brand: string | null;
  };
  valuationMethod: string;
  quantities: {
    totalPhysicalOnHand: number;
    totalReserved: number;
    totalVendableAvailable: number;
    totalInQuarantine: number;
    totalInTransit: number;
    outOfStockProductsCount: number;
    totalTrackedProductsCount: number;
  };
  valuation: {
    acquisitionCostTotal: number;
    knownCostQuantity: number;
    knownCostProductsCount: number;
    unknownCostQuantity: number;
    unknownCostProductsCount: number;
    isValuationComplete: boolean;
    normalSaleValueTotal: number;
    promoSaleValueTotal: number;
    hasActivePromotion: boolean;
    appliedPromoDiscountPercent: number;
    potentialNormalMargin: number;
    potentialNormalMarginRatePercent: number;
    potentialNormalMarkupRatePercent: number;
    potentialPromoMargin: number;
    potentialPromoMarginRatePercent: number;
    potentialPromoMarkupRatePercent: number;
    quarantineCostTotal: number;
    quarantineKnownProductsCount: number;
  };
  profitabilityAnalysis: {
    positiveMarginProductsCount: number;
    lowMarginProductsCount: number;
    zeroMarginProductsCount: number;
    lossMakingInPromoCount: number;
    lossMakingProducts: Array<{
      id: string;
      sku: string;
      name: string;
      costPrice: number;
      basePrice: number;
      promoPrice: number;
      margin: number;
      lossPerUnit: number;
      vendableQuantity: number;
      totalPotentialLoss: number;
    }>;
  };
  breakdownByCategory: Array<{
    categoryId: string | null;
    categoryName: string;
    productsCount: number;
    vendableQuantity: number;
    acquisitionCostTotal: number;
    normalSaleValueTotal: number;
    promotionalSaleValueTotal: number;
    normalMargin: number;
    promoMargin: number;
  }>;
  breakdownByLocation: Array<{
    locationId: string;
    locationName: string;
    locationType: string;
    vendableQuantity: number;
    acquisitionCostTotal: number;
    normalSaleValueTotal: number;
    promotionalSaleValueTotal: number;
    inQuarantineQuantity: number;
  }>;
  products: Array<{
    id: string;
    sku: string;
    name: string;
    categoryName: string | null;
    brand: string | null;
    unit: string;
    quantityOnHand: number;
    quantityReserved: number;
    vendableQuantity: number;
    inQuarantineQuantity: number;
    inTransitQuantity: number;
    costPrice: number | null;
    hasKnownCost: boolean;
    basePrice: number;
    promoPrice: number;
    normalTotalSale: number;
    promoTotalSale: number;
    totalAcquisitionCost: number | null;
    normalMargin: number | null;
    normalMarginRate: number | null;
    normalMarkupRate: number | null;
    promoMargin: number | null;
    promoMarginRate: number | null;
    promoMarkupRate: number | null;
    isLossMakingInPromo: boolean;
  }>;
}

interface LocationOption {
  id: string;
  name: string;
  type: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

export function StockValuationPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<StockValuationData | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filtres
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [promoPercent, setPromoPercent] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [profitabilityFilter, setProfitabilityFilter] = useState<'ALL' | 'LOSS_MAKING' | 'UNKNOWN_COST' | 'LOW_MARGIN' | 'POSITIVE'>('ALL');
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'CATEGORIES' | 'LOCATIONS' | 'LOSS_MAKING' | 'UNKNOWN'>('PRODUCTS');

  // Chargement des listes de filtres
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [locRes, catRes] = await Promise.all([
          api.get<LocationOption[]>('/organization/locations').catch(() => []),
          api.get<CategoryOption[]>('/catalog/categories').catch(() => []),
        ]);
        setLocations(locRes || []);
        setCategories(catRes || []);
      } catch {
        // Silencieux si échec chargement filtres
      }
    }
    loadFilterOptions();
  }, []);

  // Chargement des données de valorisation
  const fetchValuation = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedLocation) params.append('locationId', selectedLocation);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (promoPercent > 0) params.append('promoDiscountPercent', promoPercent.toString());

      const res = await api.get<StockValuationData>(`/reports/stock-valuation?${params.toString()}`);
      setData(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Impossible de calculer la valorisation du stock';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, selectedCategory, promoPercent, addToast]);

  useEffect(() => {
    fetchValuation();
  }, [fetchValuation]);

  // Raccourcis questions directes
  const applyPreset = (preset: string) => {
    if (preset === 'TOTAL_COST') {
      setActiveTab('PRODUCTS');
      setProfitabilityFilter('ALL');
      setPromoPercent(0);
    } else if (preset === 'SALE_NORMAL') {
      setActiveTab('PRODUCTS');
      setProfitabilityFilter('ALL');
      setPromoPercent(0);
    } else if (preset === 'PROMO_15') {
      setActiveTab('PRODUCTS');
      setProfitabilityFilter('ALL');
      setPromoPercent(15);
    } else if (preset === 'LOSS_MAKING') {
      setActiveTab('LOSS_MAKING');
      setProfitabilityFilter('LOSS_MAKING');
      if (promoPercent === 0) setPromoPercent(15);
    } else if (preset === 'UNKNOWN_COST') {
      setActiveTab('UNKNOWN');
      setProfitabilityFilter('UNKNOWN_COST');
    } else if (preset === 'BY_CATEGORY') {
      setActiveTab('CATEGORIES');
    } else if (preset === 'BY_LOCATION') {
      setActiveTab('LOCATIONS');
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedLocation) params.append('locationId', selectedLocation);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (promoPercent > 0) params.append('promoDiscountPercent', promoPercent.toString());

      const blob = await fetchBlob(`/reports/export/stock-valuation.csv?${params.toString()}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valorisation-stock-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast('Export CSV de valorisation téléchargé avec succès', 'success');
    } catch {
      addToast('Échec du téléchargement de l’export CSV', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Filtrage local des produits pour la vue détaillée
  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    return data.products.filter((p) => {
      // Recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesBrand = p.brand ? p.brand.toLowerCase().includes(q) : false;
        if (!matchesSku && !matchesName && !matchesBrand) return false;
      }

      // Filtre rentabilité
      if (profitabilityFilter === 'LOSS_MAKING') return p.isLossMakingInPromo;
      if (profitabilityFilter === 'UNKNOWN_COST') return !p.hasKnownCost;
      if (profitabilityFilter === 'LOW_MARGIN') return p.hasKnownCost && (p.normalMarginRate ?? 0) <= 10 && (p.normalMarginRate ?? 0) > 0;
      if (profitabilityFilter === 'POSITIVE') return p.hasKnownCost && (p.normalMarginRate ?? 0) > 10;

      return true;
    });
  }, [data?.products, searchQuery, profitabilityFilter]);

  const currency = data?.currency ?? 'XOF';

  return (
    <div className="stock-valuation-page p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <PageHeader
        title="Calculs & Simulations — Valeur du Stock & Marges"
        subtitle="Valorisation comptable au coût d'achat (CUMP), valeur au prix public normal, simulation au prix promotionnel et détection des marges négatives."
        primaryAction={{
          label: exporting ? 'Génération...' : 'Exporter CSV',
          onClick: handleExportCsv,
          icon: '📥',
          disabled: exporting || loading,
        }}
        secondaryActions={
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-2 text-sm px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm text-slate-700"
            onClick={fetchValuation}
            disabled={loading}
          >
            🔄 Actualiser
          </button>
        }
      />

      {/* Barre de questions rapides / Raccourcis en un clic */}
      <div className="bg-gradient-to-r from-indigo-50/60 via-slate-50 to-purple-50/60 border border-indigo-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
            💡 Réponses & Raccourcis Directs
          </span>
          <span className="text-xs text-slate-500">Formules exactes conformes CUMP</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset('TOTAL_COST')}
            className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 rounded-lg transition shadow-2xs"
          >
            💰 Valeur au coût d'achat
          </button>
          <button
            type="button"
            onClick={() => applyPreset('SALE_NORMAL')}
            className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 rounded-lg transition shadow-2xs"
          >
            🏷️ Valeur au prix public
          </button>
          <button
            type="button"
            onClick={() => applyPreset('PROMO_15')}
            className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 rounded-lg transition shadow-2xs"
          >
            🔥 Simulation promo (-15%)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('LOSS_MAKING')}
            className="px-3 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 rounded-lg transition shadow-2xs font-semibold"
          >
            ⚠️ Produits vendus à perte
          </button>
          <button
            type="button"
            onClick={() => applyPreset('UNKNOWN_COST')}
            className="px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg transition shadow-2xs"
          >
            ❓ Articles sans coût d'achat
          </button>
          <button
            type="button"
            onClick={() => applyPreset('BY_LOCATION')}
            className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 rounded-lg transition shadow-2xs"
          >
            🏬 Comparer les dépôts
          </button>
          <button
            type="button"
            onClick={() => applyPreset('BY_CATEGORY')}
            className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 rounded-lg transition shadow-2xs"
          >
            📁 Détail par catégorie
          </button>
        </div>
      </div>

      {/* Barre de Filtres & Simulateur Promotionnel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div>
          <label htmlFor="filter-loc" className="block text-xs font-semibold text-slate-600 mb-1">
            Emplacement / Dépôt
          </label>
          <select
            id="filter-loc"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">🏢 Toute l'entreprise (tous dépôts)</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.type === 'QUARANTINE' ? '(Quarantaine SAV)' : `(${loc.type})`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-cat" className="block text-xs font-semibold text-slate-600 mb-1">
            Catégorie d'articles
          </label>
          <select
            id="filter-cat"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-700">
              ⚡ Simulateur de Remise Promotionnelle Active
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
              {promoPercent > 0 ? `-${promoPercent}% sur prix normal` : 'Prix normal (0%)'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={promoPercent}
              onChange={(e) => setPromoPercent(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                min="0"
                max="50"
                value={promoPercent}
                onChange={(e) => setPromoPercent(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                className="w-14 text-center text-xs font-bold border border-slate-300 rounded py-1 px-1.5"
              />
              <span className="text-xs text-slate-600">%</span>
            </div>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-slate-500">Calcul des valorisations et analyse des marges en cours...</div>
      ) : data ? (
        <>
          {/* Alerte si Vente à Perte Détectée */}
          {data.profitabilityAnalysis.lossMakingInPromoCount > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-xs flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <h2 className="text-sm font-bold text-red-900">
                    Alerte Rentabilité : {data.profitabilityAnalysis.lossMakingInPromoCount} article(s) risquent d'être vendus à perte sous promotion !
                  </h2>
                  <p className="text-xs text-red-700 mt-1">
                    Avec la remise actuelle de {data.valuation.appliedPromoDiscountPercent}%, le prix de vente promotionnel est inférieur au coût d'achat (CUMP).
                    La marge potentielle devient négative sur ces articles.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('LOSS_MAKING');
                  setProfitabilityFilter('LOSS_MAKING');
                }}
                className="text-xs font-semibold px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shrink-0"
              >
                Voir les {data.profitabilityAnalysis.lossMakingInPromoCount} articles à perte
              </button>
            </div>
          )}

          {/* Grille des 6 Cartes KPI de Valorisation */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Carte 1 : Valeur d'Acquisition (Coût d'Achat) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Coût d'Acquisition (CUMP)</span>
                <span>📦</span>
              </div>
              <div className="text-xl font-bold text-slate-900 mt-2">
                {formatCompactNumber(data.valuation.acquisitionCostTotal)} {currency}
              </div>
              <div className="mt-2 flex items-center justify-between text-2xs">
                <span className="text-slate-500">{data.valuation.knownCostQuantity} unités valorisées</span>
                {data.valuation.isValuationComplete ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">100% chiffré</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold">
                    {data.valuation.unknownCostProductsCount} sans coût
                  </span>
                )}
              </div>
            </div>

            {/* Carte 2 : Valeur au Prix Public Normal */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Prix Public Normal</span>
                <span>🏷️</span>
              </div>
              <div className="text-xl font-bold text-indigo-900 mt-2">
                {formatCompactNumber(data.valuation.normalSaleValueTotal)} {currency}
              </div>
              <div className="mt-2 text-2xs text-slate-500">
                Plein tarif sans remise ({data.quantities.totalVendableAvailable} vendables)
              </div>
            </div>

            {/* Carte 3 : Valeur au Prix Promotionnel */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Prix Promotionnel</span>
                <span>🔥</span>
              </div>
              <div className="text-xl font-bold text-purple-900 mt-2">
                {formatCompactNumber(data.valuation.promoSaleValueTotal)} {currency}
              </div>
              <div className="mt-2 text-2xs text-purple-700 font-medium">
                {data.valuation.appliedPromoDiscountPercent > 0
                  ? `Simulation avec -${data.valuation.appliedPromoDiscountPercent}%`
                  : 'Aucune promo active'}
              </div>
            </div>

            {/* Carte 4 : Marge Potentielle Normale */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Marge Normale</span>
                <span>📈</span>
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-2">
                +{formatCompactNumber(data.valuation.potentialNormalMargin)} {currency}
              </div>
              <div className="mt-2 text-2xs text-slate-600 flex justify-between">
                <span>Taux marge : <strong className="text-emerald-700">{data.valuation.potentialNormalMarginRatePercent}%</strong></span>
                <span>Marque : {data.valuation.potentialNormalMarkupRatePercent}%</span>
              </div>
            </div>

            {/* Carte 5 : Marge Potentielle en Promo */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Marge en Promotion</span>
                <span>🎯</span>
              </div>
              <div className={`text-xl font-bold mt-2 ${data.valuation.potentialPromoMargin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {data.valuation.potentialPromoMargin >= 0 ? '+' : ''}
                {formatCompactNumber(data.valuation.potentialPromoMargin)} {currency}
              </div>
              <div className="mt-2 text-2xs text-slate-600 flex justify-between">
                <span>Taux marge : <strong>{data.valuation.potentialPromoMarginRatePercent}%</strong></span>
                <span>Marque : {data.valuation.potentialPromoMarkupRatePercent}%</span>
              </div>
            </div>

            {/* Carte 6 : Quarantaine SAV & Transit */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Quarantaine & Transit</span>
                <span>🛡️</span>
              </div>
              <div className="text-base font-bold text-slate-800 mt-2">
                {data.quantities.totalInQuarantine} en SAV
              </div>
              <div className="mt-1 text-2xs text-slate-500">
                Immobilisé : {formatCompactNumber(data.valuation.quarantineCostTotal)} {currency}
              </div>
              <div className="mt-1 text-2xs text-indigo-600 font-medium">
                {data.quantities.totalInTransit} en transit
              </div>
            </div>
          </div>

          {/* Onglets d'Exploration */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('PRODUCTS')}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'PRODUCTS'
                      ? 'border-indigo-600 text-indigo-700 bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Articles & Marges Détaillées ({filteredProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('CATEGORIES')}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'CATEGORIES'
                      ? 'border-indigo-600 text-indigo-700 bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📁 Répartition par Catégorie ({data.breakdownByCategory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('LOCATIONS')}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'LOCATIONS'
                      ? 'border-indigo-600 text-indigo-700 bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🏬 Répartition par Emplacement ({data.breakdownByLocation.length})
                </button>
                {data.profitabilityAnalysis.lossMakingInPromoCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('LOSS_MAKING')}
                    className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                      activeTab === 'LOSS_MAKING'
                        ? 'border-red-600 text-red-700 bg-white'
                        : 'border-transparent text-red-600 hover:text-red-800'
                    }`}
                  >
                    🚨 Vendus à Perte ({data.profitabilityAnalysis.lossMakingInPromoCount})
                  </button>
                )}
                {data.valuation.unknownCostProductsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('UNKNOWN')}
                    className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
                      activeTab === 'UNKNOWN'
                        ? 'border-amber-600 text-amber-800 bg-white'
                        : 'border-transparent text-amber-700 hover:text-amber-900'
                    }`}
                  >
                    ❓ Sans Coût d'Achat ({data.valuation.unknownCostProductsCount})
                  </button>
                )}
              </div>

              {/* Recherche intégrée au tableau */}
              {activeTab === 'PRODUCTS' && (
                <div className="py-2 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Filtrer par SKU, nom ou marque..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-xs border border-slate-300 rounded-md px-3 py-1.5 w-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <select
                    value={profitabilityFilter}
                    onChange={(e) => setProfitabilityFilter(e.target.value as any)}
                    className="text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ALL">Tous les statuts</option>
                    <option value="POSITIVE">Marge &gt; 10%</option>
                    <option value="LOW_MARGIN">Marge Faible (0-10%)</option>
                    <option value="LOSS_MAKING">À Perte en Promo</option>
                    <option value="UNKNOWN_COST">Sans Coût Renseigné</option>
                  </select>
                </div>
              )}
            </div>

            {/* Contenu Onglet 1 : Tableau Détaillé des Articles */}
            {activeTab === 'PRODUCTS' && (
              <div className="overflow-x-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      title="Aucun article correspondant"
                      description="Modifiez vos critères de recherche ou de filtre pour visualiser les articles."
                    />
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-2xs">
                        <th className="py-2.5 px-3">Article & SKU</th>
                        <th className="py-2.5 px-3">Catégorie</th>
                        <th className="py-2.5 px-3 text-right">Stock Vendable</th>
                        <th className="py-2.5 px-3 text-right">Coût Achat</th>
                        <th className="py-2.5 px-3 text-right">Prix Normal</th>
                        <th className="py-2.5 px-3 text-right">Prix Promo</th>
                        <th className="py-2.5 px-3 text-right">Val. Coût Total</th>
                        <th className="py-2.5 px-3 text-right">Marge Normale</th>
                        <th className="py-2.5 px-3 text-right">Marge Promo</th>
                        <th className="py-2.5 px-3 text-center">Statut Rentabilité</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.slice(0, 100).map((prod) => (
                        <tr key={prod.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            <div>{prod.name}</div>
                            <div className="text-2xs text-slate-400">{prod.sku} {prod.brand ? `• ${prod.brand}` : ''}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {prod.categoryName || <span className="text-slate-400 italic">Non catégorisé</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {prod.vendableQuantity} <span className="text-2xs text-slate-400">{prod.unit}</span>
                            {prod.inQuarantineQuantity > 0 && (
                              <div className="text-2xs text-amber-600 font-normal">+{prod.inQuarantineQuantity} en SAV</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {prod.costPrice !== null ? (
                              <span>{formatCompactNumber(prod.costPrice)} {currency}</span>
                            ) : (
                              <span className="text-amber-600 font-semibold">Inconnu</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                            {formatCompactNumber(prod.basePrice)} {currency}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-purple-800">
                            {formatCompactNumber(prod.promoPrice)} {currency}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                            {prod.totalAcquisitionCost !== null ? (
                              `${formatCompactNumber(prod.totalAcquisitionCost)} ${currency}`
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {prod.normalMargin !== null ? (
                              <div>
                                <span className="font-semibold text-emerald-700">+{formatCompactNumber(prod.normalMargin)}</span>
                                <div className="text-2xs text-slate-500">Marge {prod.normalMarginRate}%</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {prod.promoMargin !== null ? (
                              <div>
                                <span className={`font-semibold ${prod.promoMargin >= 0 ? 'text-emerald-700' : 'text-red-700 font-bold'}`}>
                                  {prod.promoMargin >= 0 ? '+' : ''}{formatCompactNumber(prod.promoMargin)}
                                </span>
                                <div className="text-2xs text-slate-500">Marge {prod.promoMarginRate}%</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {prod.isLossMakingInPromo ? (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-red-100 text-red-800">
                                Vente à perte
                              </span>
                            ) : !prod.hasKnownCost ? (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-amber-100 text-amber-800">
                                Coût manquant
                              </span>
                            ) : (prod.normalMarginRate ?? 0) <= 10 ? (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-yellow-100 text-yellow-800">
                                Marge faible
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-emerald-100 text-emerald-800">
                                Rentable
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {filteredProducts.length > 100 && (
                  <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                    Affichage des 100 premiers articles sur {filteredProducts.length}. Utilisez l'export CSV pour le fichier complet.
                  </div>
                )}
              </div>
            )}

            {/* Contenu Onglet 2 : Répartition par Catégorie */}
            {activeTab === 'CATEGORIES' && (
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-2xs">
                      <th className="py-2.5 px-3">Catégorie</th>
                      <th className="py-2.5 px-3 text-right">Nb Articles</th>
                      <th className="py-2.5 px-3 text-right">Quantité Vendable</th>
                      <th className="py-2.5 px-3 text-right">Coût Acquisition (CUMP)</th>
                      <th className="py-2.5 px-3 text-right">Vente Prix Normal</th>
                      <th className="py-2.5 px-3 text-right">Vente Prix Promo</th>
                      <th className="py-2.5 px-3 text-right">Marge Normale</th>
                      <th className="py-2.5 px-3 text-right">Marge Promo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.breakdownByCategory.map((cat, idx) => (
                      <tr key={cat.categoryId ?? idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{cat.categoryName}</td>
                        <td className="py-2.5 px-3 text-right">{cat.productsCount}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{cat.vendableQuantity}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {formatCompactNumber(cat.acquisitionCostTotal)} {currency}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-indigo-900">
                          {formatCompactNumber(cat.normalSaleValueTotal)} {currency}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-purple-900">
                          {formatCompactNumber(cat.promotionalSaleValueTotal)} {currency}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                          +{formatCompactNumber(cat.normalMargin)} {currency}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-purple-700">
                          +{formatCompactNumber(cat.promoMargin)} {currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Contenu Onglet 3 : Répartition par Emplacement (Dépôts / Magasins) */}
            {activeTab === 'LOCATIONS' && (
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-2xs">
                      <th className="py-2.5 px-3">Emplacement</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Stock Vendable</th>
                      <th className="py-2.5 px-3 text-right">Stock en Quarantaine</th>
                      <th className="py-2.5 px-3 text-right">Coût Acquisition Stock</th>
                      <th className="py-2.5 px-3 text-right">Valeur au Prix Public</th>
                      <th className="py-2.5 px-3 text-right">Valeur au Prix Promo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.breakdownByLocation.map((loc) => (
                      <tr key={loc.locationId} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{loc.locationName}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          <span className={`px-2 py-0.5 rounded text-2xs font-medium ${
                            loc.locationType === 'QUARANTINE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {loc.locationType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">{loc.vendableQuantity}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-amber-700">{loc.inQuarantineQuantity}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                          {formatCompactNumber(loc.acquisitionCostTotal)} {currency}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-indigo-900">
                          {formatCompactNumber(loc.normalSaleValueTotal)} {currency}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-purple-900">
                          {formatCompactNumber(loc.promotionalSaleValueTotal)} {currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Contenu Onglet 4 : Articles Vendus à Perte */}
            {activeTab === 'LOSS_MAKING' && (
              <div className="p-4 space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                  ⚠️ <strong>Règle Anti-Vente à Perte :</strong> Les articles listés ci-dessous ont un prix promotionnel inférieur à leur coût d'achat (CUMP).
                  Pour chaque unité vendue dans ces conditions, l'entreprise subit une perte financière nette.
                </div>
                {data.profitabilityAnalysis.lossMakingProducts.length === 0 ? (
                  <div className="p-6 text-center text-emerald-700 font-medium">
                    ✅ Aucun article vendu à perte avec le taux de remise actuel.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-red-50/50 border-b border-red-200 text-red-900 font-semibold uppercase tracking-wider text-2xs">
                        <th className="py-2.5 px-3">Article & SKU</th>
                        <th className="py-2.5 px-3 text-right">Coût CUMP</th>
                        <th className="py-2.5 px-3 text-right">Prix Normal</th>
                        <th className="py-2.5 px-3 text-right">Prix Promo</th>
                        <th className="py-2.5 px-3 text-right">Perte Unitaire</th>
                        <th className="py-2.5 px-3 text-right">Quantité Vendable</th>
                        <th className="py-2.5 px-3 text-right">Perte Potentielle Totale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {data.profitabilityAnalysis.lossMakingProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-red-50/30 transition">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            <div>{p.name}</div>
                            <div className="text-2xs text-slate-500">{p.sku}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700">{p.costPrice} {currency}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">{p.basePrice} {currency}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-red-700">{p.promoPrice} {currency}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-red-600">-{p.lossPerUnit} {currency}</td>
                          <td className="py-2.5 px-3 text-right font-medium">{p.vendableQuantity}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-red-700">-{p.totalPotentialLoss} {currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Contenu Onglet 5 : Articles sans Coût Renseigné */}
            {activeTab === 'UNKNOWN' && (
              <div className="p-4 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                  ℹ️ <strong>Valorisation Partielle :</strong> Ces articles ont du stock disponible mais aucun coût d'achat unitaire (CUMP / costPrice) n'a été enregistré.
                  Leur valeur n'est donc pas comptabilisée dans la valeur d'acquisition totale pour éviter de fausser les calculs comptables.
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                      <th className="py-2.5 px-3">Article & SKU</th>
                      <th className="py-2.5 px-3">Catégorie</th>
                      <th className="py-2.5 px-3 text-right">Quantité Vendable</th>
                      <th className="py-2.5 px-3 text-right">Prix Public</th>
                      <th className="py-2.5 px-3 text-center">Action Recommandée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.products.filter((p) => !p.hasKnownCost).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{p.name}</div>
                          <div className="text-2xs text-slate-400">{p.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{p.categoryName || 'Non catégorisé'}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{p.vendableQuantity} {p.unit}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800">{p.basePrice} {currency}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-2xs text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded">
                            Renseigner coût dans Catalogue &gt; Modifier Produit
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Note méthodologique & formules exactes */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span>📐 Règles & Formules de Calcul de Valorisation VTM :</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-500 text-2xs">
              <li><strong>Valeur d'acquisition (Coût d'achat) :</strong> Quantité vendable disponible × Coût Unitaire Moyen Pondéré (CUMP). Ne remplace jamais un coût inconnu par le prix public.</li>
              <li><strong>Valeur au prix public normal :</strong> Quantité vendable disponible × Prix de base catalogué (hors remise).</li>
              <li><strong>Valeur promotionnelle :</strong> Quantité vendable disponible × Prix promotionnel simulé ou configuré.</li>
              <li><strong>Marge Commerciale :</strong> Valeur de vente − Coût d'acquisition.</li>
              <li><strong>Taux de Marge (%) :</strong> (Marge / Coût d'acquisition) × 100. Mesure la rentabilité par rapport aux fonds investis dans le stock.</li>
              <li><strong>Taux de Marque (%) :</strong> (Marge / Valeur de vente) × 100. Mesure la part de marge contenue dans le chiffre d'affaires potentiel.</li>
              <li><strong>Isolement Quarantaine SAV :</strong> Le stock défectueux ou en quarantaine SAV n'est pas compté dans le stock vendable disponible et fait l'objet d'un suivi séparé.</li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default StockValuationPage;

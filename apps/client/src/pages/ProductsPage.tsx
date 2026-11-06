import { Fragment, useEffect, useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { Pagination } from '../components/Pagination';

interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  type: string;
  unit: string;
  basePrice: string;
  costPrice?: string | null;
  currency: string;
  status: string;
  isStocked: boolean;
  parentProductId: string | null;
  hasVariants: boolean;
  tracksSerialNumbers: boolean;
  tracksBatches: boolean;
}

interface ProductProfitability {
  productId: string;
  sku: string;
  name: string;
  currency: string;
  basePrice: number;
  costPrice: number | null;
  latestPurchaseCost: number | null;
  averagePurchaseCost: number | null;
  stockOnHand: number;
  stockValuation: number | null;
  totalUnitsSold: number;
  totalRevenue: number;
  totalCostOfGoodsSold: number;
  historicalGrossMargin: number;
  historicalMarginRate: number;
  historicalMarkupRate: number;
  estimatedCurrentMargin: number | null;
  estimatedCurrentMarginRate: number | null;
  estimatedCurrentMarkupRate: number | null;
  isSoldBelowCost: boolean;
  isLowMargin: boolean;
  completedSalesCount: number;
  totalPurchasesCount: number;
}

interface ProductPurchaseRow {
  id: string;
  purchaseOrderId: string;
  status: string;
  currency: string;
  createdAt: string;
  supplierId: string;
  supplierName: string;
  quantityOrdered: number;
  quantityReceived: number;
  remainingQuantity: number;
  unitCost: number;
  lineTotal: number;
}

interface ProductSaleRow {
  id: string;
  saleId: string;
  createdAt: string;
  saleStatus: string;
  paymentStatus: string;
  currency: string;
  customerName: string;
  quantity: number;
  unitSnapshot: string;
  unitPriceSnapshot: number;
  lineTotal: number;
  costPriceSnapshot: number | null;
  grossMargin: number | null;
  marginRate: number | null;
  markupRate: number | null;
}
interface Barcode {
  id: string;
  code: string;
}
interface BundleComponentRow {
  id: string;
  componentProductId: string;
  quantity: string;
  product: { name: string } | null;
}
interface SerialNumberRow {
  id: string;
  serial: string;
  status: string;
  saleLineId: string | null;
}
interface WarrantyPolicy {
  id: string;
  durationDays: number;
  terms: string | null;
}
interface Location {
  id: string;
  name: string;
}
interface StockBatch {
  id: string;
  lotNumber: string;
  quantity: string;
  expiresAt: string | null;
}

function parseAttributes(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const pair of input.split(',')) {
    const [key, value] = pair.split('=').map((s) => s.trim());
    if (key && value) attrs[key] = value;
  }
  return attrs;
}

const PRODUCT_TYPES = [
  { value: 'PHYSICAL', label: 'Produit physique' },
  { value: 'SERVICE', label: 'Service (jamais stocké)' },
  { value: 'BUNDLE', label: 'Bundle (composition d\'autres produits)' },
];

export function ProductsPage() {
  const { profile } = useAuth();
  const hasCapability = (key: string) => profile?.enabledCapabilities.includes(key) ?? false;

  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  const [components, setComponents] = useState<BundleComponentRow[]>([]);
  const [newBarcode, setNewBarcode] = useState('');
  const [newComponentId, setNewComponentId] = useState('');
  const [newComponentQty, setNewComponentQty] = useState('1');

  const [variants, setVariants] = useState<Product[]>([]);
  const [newVariantSku, setNewVariantSku] = useState('');
  const [newVariantAttrs, setNewVariantAttrs] = useState('');

  const [serials, setSerials] = useState<SerialNumberRow[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const handleToggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCreatingRef = useRef(false);
  const lastCreateTimeRef = useRef(0);
  const [creatingProduct, setCreatingProduct] = useState(false);

  const handleSelectAllFiltered = () => {
    setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedProductIds(new Set());
  };

  // Exportation universelle : CSV (séparateur point-virgule) ou TXT (séparateur tabulation)
  const handleExport = (format: 'CSV' | 'TXT', onlySelected = true) => {
    const list = onlySelected && selectedProductIds.size > 0
      ? filteredProducts.filter((p) => selectedProductIds.has(p.id))
      : filteredProducts;

    if (list.length === 0) {
      showToast('Aucun article à exporter.', 'error');
      return;
    }

    const isCsv = format === 'CSV';
    const sep = isCsv ? ';' : '\t';
    const ext = isCsv ? 'csv' : 'txt';
    const mime = isCsv ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;';

    const header = ['SKU', 'Nom', 'Marque', 'Type', 'Unite', 'Prix_Vente', 'Statut'].join(sep) + '\n';
    const rows = list
      .map((p) =>
        [
          p.sku,
          `"${p.name.replace(/"/g, '""')}"`,
          `"${(p.brand || '').replace(/"/g, '""')}"`,
          p.type,
          p.unit,
          p.basePrice,
          p.status,
        ].join(sep),
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogue_produits_${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Export de ${list.length} produit(s) au format ${format} téléchargé avec succès !`, 'success');
  };
  const [newSerials, setNewSerials] = useState('');
  const [serialLocationId, setSerialLocationId] = useState('');

  const [warrantyPolicy, setWarrantyPolicy] = useState<WarrantyPolicy | null>(null);
  const [warrantyDuration, setWarrantyDuration] = useState('365');
  const [warrantyTerms, setWarrantyTerms] = useState('');

  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [newBatchLot, setNewBatchLot] = useState('');
  const [newBatchQty, setNewBatchQty] = useState('');
  const [newBatchExpiry, setNewBatchExpiry] = useState('');
  const [batchLocationId, setBatchLocationId] = useState('');

  // Packaging Mode & Pricing (Carton vs Pièce & Revendeurs)
  const [packagingType, setPackagingType] = useState<'PIECE' | 'CARTON'>('PIECE');
  const [cartonCount, setCartonCount] = useState<string>('');
  const [unitsPerCarton, setUnitsPerCarton] = useState<string>('24');
  const [cartonPrice, setCartonPrice] = useState<string>('');
  const [cartonCostPrice, setCartonCostPrice] = useState<string>('');
  const [resellerPrice, setResellerPrice] = useState<string>('');

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('piece');
  const [basePrice, setBasePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [brand, setBrand] = useState('');
  const [type, setType] = useState('PHYSICAL');
  const [tracksSerialNumbers, setTracksSerialNumbers] = useState(false);
  const [tracksBatches, setTracksBatches] = useState(false);

  // Auto SKU generator based on product name
  const generateSkuFromName = (prodName: string): string => {
    const slug = (prodName || 'ART')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4);
    const prefix = slug.length >= 2 ? slug : 'PRD';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  };

  // Cost Price Privacy Rule (Hidden unless user is authorized)
  const [costVisibleOverride, setCostVisibleOverride] = useState<boolean>(() => {
    return localStorage.getItem('vtm_permission_cost') === 'true';
  });

  useEffect(() => {
    const handlePermChange = () => {
      setCostVisibleOverride(localStorage.getItem('vtm_permission_cost') === 'true');
    };
    window.addEventListener('vtm-permission-change', handlePermChange);
    return () => window.removeEventListener('vtm-permission-change', handlePermChange);
  }, []);

  const canViewCostPrice =
    costVisibleOverride ||
    profile?.enabledCapabilities.includes('finance') ||
    profile?.enabledCapabilities.includes('procurement') ||
    profile?.email.includes('admin') ||
    profile?.email.includes('owner') ||
    localStorage.getItem('vtm_user_role') === 'admin' ||
    localStorage.getItem('vtm_user_role') === 'owner';

  // Profitability & Cost analysis state (Partie 23)
  const [profitability, setProfitability] = useState<ProductProfitability | null>(null);
  const [productPurchases, setProductPurchases] = useState<ProductPurchaseRow[]>([]);
  const [productSales, setProductSales] = useState<ProductSaleRow[]>([]);
  const [expandedTab, setExpandedTab] = useState<'PROFIT' | 'PURCHASES' | 'SALES' | 'DETAILS'>('PROFIT');
  const [editingCost, setEditingCost] = useState('');
  const [savingCost, setSavingCost] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const { showToast } = useToast();

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvContent, setImportCsvContent] = useState('');
  const [importPreview, setImportPreview] = useState<{
    dryRun: boolean;
    totalRows: number;
    validCount: number;
    errorCount: number;
    errors: { row: number; reason: string; raw: string }[];
    preview?: { name: string; sku: string; price: string; type: string; unit: string; barcode?: string }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const load = () =>
    api
      .get<Product[]>('/products')
      .then(setProducts)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erreur de chargement'));

  useEffect(() => {
    load();
    api.get<Location[]>('/locations').then((locs) => {
      setLocations(locs);
      if (locs.length > 0) {
        setSerialLocationId(locs[0].id);
        setBatchLocationId(locs[0].id);
      }
    }).catch(() => {});
  }, []);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter]);

  const topLevelProducts = products.filter((p) => !p.parentProductId);

  const filteredProducts = topLevelProducts.filter((p) => {
    if (typeFilter !== 'ALL' && p.type !== typeFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  });

  const paginatedProducts = filteredProducts.slice((currentPage - 1) * 20, currentPage * 20);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // 🛡️ Protection Anti-Double Clic / Clics subits répétés (Idempotence)
    const now = Date.now();
    if (isCreatingRef.current || creatingProduct || (now - lastCreateTimeRef.current < 2000)) {
      showToast("Création déjà en cours. Les clics supplémentaires sont ignorés pour éviter les doublons. [Code : VTM-PROD-002]", 'info');
      return;
    }

    isCreatingRef.current = true;
    lastCreateTimeRef.current = now;
    setCreatingProduct(true);

    try {
      // Auto-generate SKU if user left it blank
      const effectiveSku = sku.trim() || generateSkuFromName(name);

      // Compute effective prices based on packaging
      let effectiveBasePrice = basePrice;
      let effectiveCostPrice = costPrice.trim() ? costPrice.trim() : undefined;

      if (packagingType === 'CARTON') {
        const uPerCarton = Number(unitsPerCarton) || 1;
        if (cartonPrice && !basePrice) {
          effectiveBasePrice = (Number(cartonPrice) / uPerCarton).toFixed(2);
        }
        if (cartonCostPrice && !costPrice) {
          effectiveCostPrice = (Number(cartonCostPrice) / uPerCarton).toFixed(2);
        }
      }

      await api.post('/products', {
        sku: effectiveSku,
        name,
        unit: packagingType === 'CARTON' ? 'carton' : unit,
        basePrice: effectiveBasePrice,
        costPrice: effectiveCostPrice,
        brand: brand || undefined,
        type,
        tracksSerialNumbers: tracksSerialNumbers || undefined,
        tracksBatches: tracksBatches || undefined,
      });

      showToast(`Produit "${name}" créé avec succès (Réf: ${effectiveSku}) !`, 'success');
      setSku('');
      setName('');
      setBasePrice('');
      setCostPrice('');
      setCartonPrice('');
      setCartonCostPrice('');
      setResellerPrice('');
      setCartonCount('');
      setBrand('');
      setTracksSerialNumbers(false);
      setTracksBatches(false);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de création');
    } finally {
      setCreatingProduct(false);
      setTimeout(() => {
        isCreatingRef.current = false;
      }, 1500);
    }
  };

  const downloadSampleCsv = () => {
    const sample = `nom,sku,prix,type,unite,code_barre\nRiz Parfumé 25kg,RIZ-25KG,18500,PHYSICAL,Sac,6181100123456\nHuile de Palme 5L,HUILE-5L,6500,PHYSICAL,Bidon,6181100123457\nPrestation Montage Écran,SRV-MONT-01,5000,SERVICE,H,\nPack Rentrée Scolaire,PACK-RENTREE,25000,BUNDLE,Kit,`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-catalogue-produits.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Modèle CSV téléchargé avec succès !', 'info');
  };

  const downloadSampleTxt = () => {
    const sample = `nom\tsku\tprix\ttype\tunite\tcode_barre\nRiz Parfumé 25kg\tRIZ-25KG\t18500\tPHYSICAL\tSac\t6181100123456\nHuile de Palme 5L\tHUILE-5L\t6500\tPHYSICAL\tBidon\t6181100123457\nPrestation Montage Écran\tSRV-MONT-01\t5000\tSERVICE\tH\t\nPack Rentrée Scolaire\tPACK-RENTREE\t25000\tBUNDLE\tKit\t`;
    const blob = new Blob([sample], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-catalogue-produits.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Modèle TXT (séparateur tabulation) téléchargé avec succès !', 'info');
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportCsvContent(content);
        setImportPreview(null);
        showToast(`Fichier "${file.name}" chargé dans le champ d'importation.`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleDryRunImport = async () => {
    if (!importCsvContent.trim()) {
      showToast('Veuillez sélectionner un fichier ou coller le contenu CSV / TXT.', 'error');
      return;
    }
    setImporting(true);
    try {
      const res = await api.post<{
        dryRun: boolean;
        totalRows: number;
        validCount: number;
        errorCount: number;
        errors: { row: number; reason: string; raw: string }[];
        preview?: { name: string; sku: string; price: string; type: string; unit: string; barcode?: string }[];
      }>('/products/import', {
        csvContent: importCsvContent,
        dryRun: true,
      });
      setImportPreview(res);
      showToast(`Pré-validation effectuée : ${res.validCount} valide(s), ${res.errorCount} erreur(s).`, 'info');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Erreur lors de l'analyse du fichier", 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importCsvContent.trim()) return;
    setImporting(true);
    try {
      const res = await api.post<{ createdCount: number }>('/products/import', {
        csvContent: importCsvContent,
        dryRun: false,
      });
      showToast(`${res.createdCount} produit(s) importé(s) avec succès dans le catalogue !`, 'success');
      setShowImportModal(false);
      setImportCsvContent('');
      setImportPreview(null);
      load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Erreur lors de l'importation", 'error');
    } finally {
      setImporting(false);
    }
  };

  const toggleExpand = async (product: Product) => {
    if (expanded === product.id) {
      setExpanded(null);
      return;
    }
    setExpanded(product.id);
    setError(null);
    try {
      const bc = await api.get<Barcode[]>(`/products/${product.id}/barcodes`);
      setBarcodes(bc);
      if (product.type === 'BUNDLE') {
        const comp = await api.get<BundleComponentRow[]>(`/products/${product.id}/bundle-components`);
        setComponents(comp);
      } else {
        setComponents([]);
      }
      if (hasCapability('variants') && !product.parentProductId) {
        setVariants(await api.get<Product[]>(`/products/${product.id}/variants`));
      } else {
        setVariants([]);
      }
      if (hasCapability('serial_numbers') && product.tracksSerialNumbers) {
        setSerials(await api.get<SerialNumberRow[]>(`/products/${product.id}/serial-numbers`));
      } else {
        setSerials([]);
      }
      if (hasCapability('warranties')) {
        setWarrantyPolicy(await api.get<WarrantyPolicy | null>(`/products/${product.id}/warranty-policy`));
        setWarrantyDuration('365');
        setWarrantyTerms('');
      } else {
        setWarrantyPolicy(null);
      }
      if (hasCapability('batch_tracking') && product.tracksBatches) {
        setBatches(await api.get<StockBatch[]>(`/products/${product.id}/batches`));
      } else {
        setBatches([]);
      }

      // Rentabilité et marges consolidées (Partie 23)
      setExpandedTab('PROFIT');
      const [profRes, purchRes, salesRes] = await Promise.all([
        api.get<ProductProfitability>(`/products/${product.id}/profitability`).catch(() => null),
        api.get<{ data: ProductPurchaseRow[] }>(`/products/${product.id}/purchases?limit=20`).catch(() => ({ data: [] })),
        api.get<{ data: ProductSaleRow[] }>(`/products/${product.id}/sales?limit=20`).catch(() => ({ data: [] })),
      ]);
      setProfitability(profRes);
      setEditingCost(profRes?.costPrice ? String(profRes.costPrice) : '');
      setProductPurchases(purchRes.data);
      setProductSales(salesRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement des détails');
    }
  };

  const handleSaveCost = async (productId: string) => {
    setSavingCost(true);
    try {
      await api.patch(`/products/${productId}`, { costPrice: editingCost.trim() ? editingCost.trim() : null });
      showToast('Coût de référence mis à jour avec succès', 'success');
      const updatedProf = await api.get<ProductProfitability>(`/products/${productId}/profitability`);
      setProfitability(updatedProf);
      load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Erreur de mise à jour du coût', 'error');
    } finally {
      setSavingCost(false);
    }
  };

  const addVariant = async (parentId: string) => {
    if (!newVariantSku || !newVariantAttrs) return;
    try {
      await api.post(`/products/${parentId}/variants`, {
        sku: newVariantSku,
        attributes: parseAttributes(newVariantAttrs),
      });
      setNewVariantSku('');
      setNewVariantAttrs('');
      setVariants(await api.get<Product[]>(`/products/${parentId}/variants`));
      load(); // le parent devient hasVariants/isStocked=false — reflet immédiat dans le tableau
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'ajout de la variante");
    }
  };

  const registerSerials = async (productId: string) => {
    const list = newSerials.split('\n').map((s) => s.trim()).filter(Boolean);
    if (list.length === 0 || !serialLocationId) return;
    try {
      await api.post(`/products/${productId}/serial-numbers`, { locationId: serialLocationId, serials: list });
      setNewSerials('');
      setSerials(await api.get<SerialNumberRow[]>(`/products/${productId}/serial-numbers`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement des numéros de série");
    }
  };

  const saveWarrantyPolicy = async (productId: string) => {
    try {
      const policy = await api.put<WarrantyPolicy>(`/products/${productId}/warranty-policy`, {
        durationDays: Number(warrantyDuration),
        terms: warrantyTerms || undefined,
      });
      setWarrantyPolicy(policy);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement de la politique de garantie");
    }
  };

  const registerBatch = async (productId: string) => {
    if (!newBatchLot || !newBatchQty || !batchLocationId) return;
    try {
      await api.post(`/products/${productId}/batches`, {
        locationId: batchLocationId,
        lotNumber: newBatchLot,
        quantity: newBatchQty,
        expiresAt: newBatchExpiry || undefined,
      });
      setNewBatchLot('');
      setNewBatchQty('');
      setNewBatchExpiry('');
      setBatches(await api.get<StockBatch[]>(`/products/${productId}/batches`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement du lot");
    }
  };

  const addBarcode = async (productId: string) => {
    if (!newBarcode) return;
    try {
      await api.post('/products/barcodes', { productId, code: newBarcode });
      setNewBarcode('');
      setBarcodes(await api.get<Barcode[]>(`/products/${productId}/barcodes`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'ajout du code-barres");
    }
  };

  const addComponent = async (bundleProductId: string) => {
    if (!newComponentId) return;
    try {
      await api.post('/products/bundle-components', {
        bundleProductId,
        componentProductId: newComponentId,
        quantity: newComponentQty,
      });
      setComponents(await api.get<BundleComponentRow[]>(`/products/${bundleProductId}/bundle-components`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'ajout du composant");
    }
  };

  return (
    <div className="products-page">
      <PageHeader
        title="Catalogue des Produits & Services"
        subtitle="Articles, prestations, variantes, lots de stock et garanties"
        badge={<span className="badge badge-info">{products.length} référence{products.length > 1 ? 's' : ''}</span>}
        primaryAction={{
          label: showCreate ? 'Fermer le formulaire' : '+ Nouveau produit',
          onClick: () => setShowCreate(!showCreate),
        }}
        secondaryActions={
          <button type="button" onClick={() => setShowImportModal(true)} className="btn-secondary">
            📥 Importer CSV
          </button>
        }
      />

      {error && <div className="error-banner">{error}</div>}

      {/* Formulaire de création escamotable */}
      {showCreate && (
        <div className="dashboard-section" style={{ animation: 'fadeIn 0.15s ease' }}>
          <div className="sale-form" style={{ maxWidth: 560, marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Nouveau produit ou service</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <label style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600 }}>SKU / Référence unique *</label>
                    <button
                      type="button"
                      onClick={() => setSku(generateSkuFromName(name || 'Article'))}
                      className="btn-secondary"
                      style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}
                      title="Générer automatiquement une référence unique"
                    >
                      ⚡ Auto
                    </button>
                  </div>
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder={name ? generateSkuFromName(name) : 'Ex: PRD-2841 (auto si vide)'}
                  />
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Généré automatiquement si laissé vide</span>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Type d'article *</label>
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nom du produit ou service *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Riz parfumé 5kg, Huile raffinée 1L..."
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Marque / Fabricant</label>
                  <input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex: Marque A (optionnel)"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Unité de base *</label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Ex: piece, kg, sac, litre"
                    required
                  />
                </div>
              </div>

              {/* Sélecteur de Conditionnement : Pièce vs Carton */}
              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.5rem', display: 'block', color: '#0f172a' }}>
                  Système de Conditionnement & Stock :
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: packagingType === 'PIECE' ? 700 : 400, fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="pkg"
                      checked={packagingType === 'PIECE'}
                      onChange={() => {
                        setPackagingType('PIECE');
                        setUnit('piece');
                      }}
                    />
                    <span>À l'Unité / Pièce (Pce)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: packagingType === 'CARTON' ? 700 : 400, fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="pkg"
                      checked={packagingType === 'CARTON'}
                      onChange={() => {
                        setPackagingType('CARTON');
                        setUnit('carton');
                      }}
                    />
                    <span>📦 Par Carton / Colis (Crt)</span>
                  </label>
                </div>

                {packagingType === 'CARTON' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Nombre de cartons reçus / en stock</label>
                      <input
                        type="number"
                        min="1"
                        value={cartonCount}
                        onChange={(e) => setCartonCount(e.target.value)}
                        placeholder="Ex: 10 cartons"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Nombre de pièces par carton *</label>
                      <input
                        type="number"
                        min="1"
                        value={unitsPerCarton}
                        onChange={(e) => setUnitsPerCarton(e.target.value)}
                        placeholder="Ex: 24 pièces"
                        required
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2', fontSize: '0.8rem', color: '#0369a1', background: '#e0f2fe', padding: '0.45rem 0.75rem', borderRadius: '6px', fontWeight: 600 }}>
                      📦 Équivalent total en stock : <strong>{Number(cartonCount || 0) * Number(unitsPerCarton || 1)}</strong> pièces en magasin.
                    </div>
                  </div>
                )}
              </div>

              {/* Grille Tarifaire Complète */}
              <div style={{ background: '#ffffff', padding: '0.75rem 0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', marginBottom: '0.5rem' }}>
                  Grille Tarifaire (Détail, Demi-Gros & Prix d'Achat)
                </div>

                {packagingType === 'CARTON' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Prix de vente Carton (XOF) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={cartonPrice}
                        onChange={(e) => {
                          const cp = e.target.value;
                          setCartonPrice(cp);
                          if (cp && unitsPerCarton) {
                            setBasePrice((Number(cp) / (Number(unitsPerCarton) || 1)).toFixed(0));
                          }
                        }}
                        placeholder="Ex: 24000"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Prix de vente Pièce unitaire (XOF) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={basePrice}
                        onChange={(e) => setBasePrice(e.target.value)}
                        placeholder="Ex: 1000"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Prix Revendeur / Demi-gros (XOF)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={resellerPrice}
                        onChange={(e) => setResellerPrice(e.target.value)}
                        placeholder="Ex: 21000 (carton) ou 900 (pièce)"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Prix d'achat Carton (XOF)</label>
                      {canViewCostPrice ? (
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={cartonCostPrice}
                          onChange={(e) => {
                            const ccp = e.target.value;
                            setCartonCostPrice(ccp);
                            if (ccp && unitsPerCarton) {
                              setCostPrice((Number(ccp) / (Number(unitsPerCarton) || 1)).toFixed(0));
                            }
                          }}
                          placeholder="Ex: 18000"
                        />
                      ) : (
                        <input
                          type="text"
                          disabled
                          value="🔒 Confidentiel (Réservé gérants)"
                          style={{ background: '#f1f5f9', color: '#94a3b8', fontStyle: 'italic' }}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Prix de vente unitaire (XOF) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={basePrice}
                        onChange={(e) => setBasePrice(e.target.value)}
                        placeholder="Ex: 1500"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Prix Revendeur / Demi-gros (XOF)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={resellerPrice}
                        onChange={(e) => setResellerPrice(e.target.value)}
                        placeholder="Ex: 1250"
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Prix d'achat unitaire (XOF)</label>
                      {canViewCostPrice ? (
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={costPrice}
                          onChange={(e) => setCostPrice(e.target.value)}
                          placeholder="Ex: 1000 (optionnel)"
                        />
                      ) : (
                        <input
                          type="text"
                          disabled
                          value="🔒 Confidentiel (Réservé gérants)"
                          style={{ background: '#f1f5f9', color: '#94a3b8', fontStyle: 'italic' }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {hasCapability('serial_numbers') && type === 'PHYSICAL' && (
                <label className="checkbox-row" style={{ marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={tracksSerialNumbers}
                    onChange={(e) => {
                      setTracksSerialNumbers(e.target.checked);
                      if (e.target.checked) setTracksBatches(false);
                    }}
                  />
                  <span>Suivre les numéros de série / IMEI pour chaque unité</span>
                </label>
              )}

              {hasCapability('batch_tracking') && type === 'PHYSICAL' && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={tracksBatches}
                    onChange={(e) => {
                      setTracksBatches(e.target.checked);
                      if (e.target.checked) setTracksSerialNumbers(false);
                    }}
                  />
                  <span>Suivre les numéros de lots et dates de péremption</span>
                </label>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="primary" disabled={creatingProduct}>
                  {creatingProduct ? 'Enregistrement en cours...' : "Créer l'article"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} disabled={creatingProduct}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barre d'outils : recherche & filtres */}
      <div className="table-toolbar" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
        <div className="table-toolbar-left">
          <div className="table-search-box">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="table-search-input"
              placeholder="Rechercher par nom, SKU ou marque..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="table-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
              >
                ×
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {[
              { key: 'ALL', label: 'Tous' },
              { key: 'PHYSICAL', label: 'Physiques' },
              { key: 'SERVICE', label: 'Services' },
              { key: 'BUNDLE', label: 'Bundles' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={typeFilter === tab.key ? 'primary' : ''}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                onClick={() => setTypeFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Boutons de Choix Automatique / Sélection Massive */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
            title="Sélectionner automatiquement l'ensemble des articles filtrés sans clic manuel un par un"
          >
            ⚡ Tout sélectionner ({filteredProducts.length})
          </button>
          {selectedProductIds.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', color: '#64748b' }}
              >
                ✕ Désélectionner
              </button>
              <button
                type="button"
                onClick={() => handleExport('CSV', true)}
                className="primary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                title="Exporter les articles sélectionnés au format CSV (point-virgule)"
              >
                📥 Exporter {selectedProductIds.size} (CSV)
              </button>
              <button
                type="button"
                onClick={() => handleExport('TXT', true)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1' }}
                title="Exporter les articles sélectionnés au format TXT (tabulation)"
              >
                📄 Exporter {selectedProductIds.size} (TXT)
              </button>
            </>
          )}
          {selectedProductIds.size === 0 && filteredProducts.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => handleExport('CSV', false)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                title="Exporter l'ensemble des articles affichés au format CSV"
              >
                📥 Exporter tout (CSV)
              </button>
              <button
                type="button"
                onClick={() => handleExport('TXT', false)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                title="Exporter l'ensemble des articles affichés au format TXT"
              >
                📄 Exporter tout (TXT)
              </button>
            </div>
          )}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          type={topLevelProducts.length === 0 ? 'no-data' : 'no-results'}
          title={topLevelProducts.length === 0 ? 'Aucun article enregistré' : 'Aucun résultat trouvé'}
          description={
            topLevelProducts.length === 0
              ? 'Enregistrez votre premier produit ou prestation pour commencer.'
              : `Aucun produit ne correspond à votre recherche « ${searchQuery} » ou au filtre sélectionné.`
          }
          action={
            topLevelProducts.length === 0
              ? {
                  label: '+ Nouveau produit',
                  onClick: () => setShowCreate(true),
                }
              : {
                  label: 'Réinitialiser la recherche',
                  onClick: () => {
                    setSearchQuery('');
                    setTypeFilter('ALL');
                  },
                }
          }
        />
      ) : (
        <>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                  onChange={(e) => {
                    if (e.target.checked) handleSelectAllFiltered();
                    else handleDeselectAll();
                  }}
                  title="Sélectionner / Désélectionner tous les articles affichés"
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>SKU</th>
              <th>Nom</th>
              <th>Marque</th>
              <th>Type</th>
              <th>Unité</th>
              <th>Prix Vente</th>
              <th>Coût Réf</th>
              <th>Statut</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((p) => (
              <Fragment key={p.id}>
                <tr style={{ verticalAlign: 'middle', background: selectedProductIds.has(p.id) ? '#f0fdf4' : undefined }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(p.id)}
                      onChange={() => handleToggleProduct(p.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 600 }}>
                      {p.sku}
                    </code>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.15rem' }}>{p.type === 'SERVICE' ? '🛠️' : p.type === 'BUNDLE' ? '🎁' : '📦'}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.3 }}>
                          {p.name}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {p.brand && (
                            <span style={{ fontSize: '0.74rem', color: '#475569', background: '#f8fafc', padding: '0.05rem 0.35rem', borderRadius: '3px', border: '1px solid #e2e8f0' }}>
                              Marque : {p.brand}
                            </span>
                          )}
                          {p.hasVariants && <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>Variantes</span>}
                          {p.tracksSerialNumbers && <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>N° Série</span>}
                          {p.tracksBatches && <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>Lots / Péremption</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: p.brand ? '#1e293b' : '#94a3b8', fontSize: '0.85rem' }}>
                      {p.brand ?? 'Sans marque'}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: p.type === 'SERVICE' ? '#e0f2fe' : p.type === 'BUNDLE' ? '#f3e8ff' : '#f1f5f9',
                        color: p.type === 'SERVICE' ? '#0369a1' : p.type === 'BUNDLE' ? '#7e22ce' : '#334155',
                      }}
                    >
                      {p.type === 'SERVICE' ? 'Prestation' : p.type === 'BUNDLE' ? 'Pack / Bundle' : 'Physique'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {p.unit === 'carton' ? <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>📦 Carton</span> : p.unit}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#16a34a' }}>
                      {Number(p.basePrice).toLocaleString('fr-FR')} {p.currency}
                    </span>
                  </td>
                  <td>
                    {canViewCostPrice ? (
                      <span style={{ fontSize: '0.85rem', color: p.costPrice ? '#475569' : '#94a3b8', fontWeight: p.costPrice ? 600 : 400 }}>
                        {p.costPrice ? `${Number(p.costPrice).toLocaleString('fr-FR')} ${p.currency}` : 'Non défini'}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: '#94a3b8',
                          fontStyle: 'italic',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: '#f1f5f9',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                        title="Prix d'achat masqué — Accès réservé aux administrateurs & gérants"
                      >
                        🔒 ***
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: p.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                        color: p.status === 'ACTIVE' ? '#15803d' : '#b91c1c',
                      }}
                    >
                      {p.status === 'ACTIVE' ? '✓ Actif' : '✕ Inactif'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px' }}
                      onClick={() => toggleExpand(p)}
                    >
                      {expanded === p.id ? '▲ Masquer' : '📊 Marges & Gérer'}
                    </button>
                  </td>
                </tr>
              {expanded === p.id && (
                <tr>
                  <td colSpan={9} style={{ background: '#f8fafc', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={expandedTab === 'PROFIT' ? 'btn-primary' : 'btn-secondary'}
                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                        onClick={() => setExpandedTab('PROFIT')}
                      >
                        📊 Rentabilité & Marges
                      </button>
                      <button
                        type="button"
                        className={expandedTab === 'PURCHASES' ? 'btn-primary' : 'btn-secondary'}
                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                        onClick={() => setExpandedTab('PURCHASES')}
                      >
                        🚚 Achats & Coûts ({productPurchases.length})
                      </button>
                      <button
                        type="button"
                        className={expandedTab === 'SALES' ? 'btn-primary' : 'btn-secondary'}
                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                        onClick={() => setExpandedTab('SALES')}
                      >
                        💳 Ventes & Marges Réalisées ({productSales.length})
                      </button>
                      <button
                        type="button"
                        className={expandedTab === 'DETAILS' ? 'btn-primary' : 'btn-secondary'}
                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                        onClick={() => setExpandedTab('DETAILS')}
                      >
                        ⚙️ Caractéristiques & Lots
                      </button>
                    </div>

                    {/* Onglet 1: Rentabilité et analyse de marges */}
                    {expandedTab === 'PROFIT' && (
                      <div>
                        {profitability?.isSoldBelowCost && (
                          <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                            ⚠️ ATTENTION : Ce produit est actuellement proposé à la vente ({profitability.basePrice.toLocaleString('fr-FR')} {p.currency}) sous son coût de revient ({profitability.averagePurchaseCost?.toLocaleString('fr-FR')} {p.currency}) !
                          </div>
                        )}
                        {profitability?.isLowMargin && !profitability.isSoldBelowCost && (
                          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                            ℹ️ Marge faible : Le taux de marge prévisionnel ({profitability.estimatedCurrentMarginRate}%) est inférieur au seuil recommandé de 15%.
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                          <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Prix de vente actuel</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                              {Number(p.basePrice).toLocaleString('fr-FR')} <span style={{ fontSize: '0.8rem' }}>{p.currency}</span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Catalogue de vente</div>
                          </div>

                          <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Coût moyen d'achat (PMP)</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                              {profitability?.averagePurchaseCost ? `${Number(profitability.averagePurchaseCost).toLocaleString('fr-FR')} ${p.currency}` : (p.costPrice ? `${Number(p.costPrice).toLocaleString('fr-FR')} ${p.currency}` : 'Non calculable')}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                              Dernier achat : {profitability?.latestPurchaseCost ? `${Number(profitability.latestPurchaseCost).toLocaleString('fr-FR')} ${p.currency}` : 'Aucun'}
                            </div>
                          </div>

                          <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Marge unitaire estimée</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (profitability?.estimatedCurrentMargin ?? 0) >= 0 ? '#16a34a' : '#dc2626', marginTop: '0.2rem' }}>
                              {profitability?.estimatedCurrentMargin !== null ? `${Number(profitability?.estimatedCurrentMargin).toLocaleString('fr-FR')} ${p.currency}` : 'Inconnue'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                              Taux marge : <strong>{profitability?.estimatedCurrentMarginRate ?? '-'}%</strong> · Marque : <strong>{profitability?.estimatedCurrentMarkupRate ?? '-'}%</strong>
                            </div>
                          </div>

                          <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Marge historique réalisée</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (profitability?.historicalGrossMargin ?? 0) >= 0 ? '#0284c7' : '#dc2626', marginTop: '0.2rem' }}>
                              {profitability?.historicalGrossMargin ? `${Number(profitability.historicalGrossMargin).toLocaleString('fr-FR')} ${p.currency}` : '0 ' + p.currency}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                              Sur {profitability?.completedSalesCount ?? 0} vente(s) ({profitability?.totalUnitsSold ?? 0} {p.unit}s vendus)
                            </div>
                          </div>
                        </div>

                        {/* Formulaire de mise à jour du coût de référence */}
                        <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', maxWidth: '520px' }}>
                          <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#0f172a' }}>
                            Coût d'achat de référence (utilisé pour les marges si aucun achat saisi)
                          </h5>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              placeholder="Coût unitaire en XOF..."
                              value={editingCost}
                              onChange={(e) => setEditingCost(e.target.value)}
                              style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={savingCost}
                              onClick={() => handleSaveCost(p.id)}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                            >
                              {savingCost ? 'Enregistrement...' : 'Enregistrer coût'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Onglet 2: Historique des Achats */}
                    {expandedTab === 'PURCHASES' && (
                      <div style={{ background: '#fff', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        {productPurchases.length === 0 ? (
                          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            Aucune commande d'achat enregistrée pour cet article.
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Statut</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Fournisseur</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Qté Cde</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Qté Reçue</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Reste</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Coût Unit.</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total Ligne</th>
                              </tr>
                            </thead>
                            <tbody>
                              {productPurchases.map((pur) => (
                                <tr key={pur.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(pur.createdAt).toLocaleDateString('fr-FR')}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', borderRadius: '3px', background: pur.status === 'RECEIVED' ? '#dcfce7' : '#fef3c7', color: pur.status === 'RECEIVED' ? '#15803d' : '#b45309', fontWeight: 600 }}>
                                      {pur.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{pur.supplierName}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{pur.quantityOrdered}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{pur.quantityReceived}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: pur.remainingQuantity > 0 ? '#ea580c' : '#64748b' }}>
                                    {pur.remainingQuantity}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                                    {pur.unitCost.toLocaleString('fr-FR')} {pur.currency}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>
                                    {pur.lineTotal.toLocaleString('fr-FR')} {pur.currency}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* Onglet 3: Historique des Ventes */}
                    {expandedTab === 'SALES' && (
                      <div style={{ background: '#fff', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        {productSales.length === 0 ? (
                          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            Aucune vente enregistrée pour cet article.
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Statut</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Client</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Qté</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Prix Vente</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Coût Snapshot</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total Vente</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Marge Réalisée</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Taux Marge</th>
                              </tr>
                            </thead>
                            <tbody>
                              {productSales.map((sl) => (
                                <tr key={sl.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(sl.createdAt).toLocaleDateString('fr-FR')}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', borderRadius: '3px', background: sl.saleStatus === 'COMPLETED' ? '#dcfce7' : '#fee2e2', color: sl.saleStatus === 'COMPLETED' ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                                      {sl.saleStatus}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{sl.customerName}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{sl.quantity}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{sl.unitPriceSnapshot.toLocaleString('fr-FR')}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#64748b' }}>
                                    {sl.costPriceSnapshot ? sl.costPriceSnapshot.toLocaleString('fr-FR') : '-'}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                                    {sl.lineTotal.toLocaleString('fr-FR')} {sl.currency}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: (sl.grossMargin ?? 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {sl.grossMargin !== null ? `${sl.grossMargin.toLocaleString('fr-FR')} ${sl.currency}` : '-'}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: (sl.marginRate ?? 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {sl.marginRate !== null ? `${Math.round(sl.marginRate)}%` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* Onglet 4: Caractéristiques & Lots existants */}
                    {expandedTab === 'DETAILS' && (
                    <div className="page-note" style={{ textAlign: 'left', background: '#fff' }}>
                      <strong>Codes-barres</strong>
                      <ul>
                        {barcodes.map((b) => (
                          <li key={b.id}>{b.code}</li>
                        ))}
                        {barcodes.length === 0 && <li>Aucun</li>}
                      </ul>
                      <div className="inline-form">
                        <input
                          value={newBarcode}
                          onChange={(e) => setNewBarcode(e.target.value)}
                          placeholder="Nouveau code-barres"
                        />
                        <button type="button" onClick={() => addBarcode(p.id)}>
                          Ajouter
                        </button>
                      </div>

                      {p.type === 'BUNDLE' && (
                        <>
                          <strong>Composants du bundle</strong>
                          <ul>
                            {components.map((c) => (
                              <li key={c.id}>
                                {c.quantity} × {c.product?.name ?? c.componentProductId}
                              </li>
                            ))}
                            {components.length === 0 && <li>Aucun — le bundle ne peut pas être vendu tant qu'il est vide</li>}
                          </ul>
                          <div className="inline-form">
                            <select value={newComponentId} onChange={(e) => setNewComponentId(e.target.value)}>
                              <option value="">Produit composant...</option>
                              {products
                                .filter((cp) => cp.id !== p.id && cp.type !== 'BUNDLE')
                                .map((cp) => (
                                  <option key={cp.id} value={cp.id}>
                                    {cp.name}
                                  </option>
                                ))}
                            </select>
                            <input
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={newComponentQty}
                              onChange={(e) => setNewComponentQty(e.target.value)}
                            />
                            <button type="button" onClick={() => addComponent(p.id)}>
                              Ajouter
                            </button>
                          </div>
                        </>
                      )}

                      {hasCapability('variants') && p.type === 'PHYSICAL' && (
                        <>
                          <strong>Variantes</strong>
                          <ul>
                            {variants.map((v) => (
                              <li key={v.id}>
                                {v.sku} — {v.name}
                              </li>
                            ))}
                            {variants.length === 0 && <li>Aucune — ce produit se vend tel quel</li>}
                          </ul>
                          <div className="inline-form">
                            <input
                              value={newVariantSku}
                              onChange={(e) => setNewVariantSku(e.target.value)}
                              placeholder="SKU de la variante"
                            />
                            <input
                              value={newVariantAttrs}
                              onChange={(e) => setNewVariantAttrs(e.target.value)}
                              placeholder="Attributs (ex: couleur=Rouge, taille=XL)"
                              style={{ minWidth: 220 }}
                            />
                            <button type="button" onClick={() => addVariant(p.id)}>
                              Ajouter
                            </button>
                          </div>
                        </>
                      )}

                      {hasCapability('serial_numbers') && p.tracksSerialNumbers && (
                        <>
                          <strong>Numéros de série</strong>
                          <ul>
                            {serials.map((s) => (
                              <li key={s.id}>
                                {s.serial} — <span className={`badge badge-${s.status === 'AVAILABLE' ? 'success' : s.status === 'SOLD' ? 'info' : 'danger'}`}>{s.status}</span>
                              </li>
                            ))}
                            {serials.length === 0 && <li>Aucun numéro enregistré</li>}
                          </ul>
                          <div className="inline-form">
                            <select value={serialLocationId} onChange={(e) => setSerialLocationId(e.target.value)}>
                              {locations.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                            </select>
                            <textarea
                              value={newSerials}
                              onChange={(e) => setNewSerials(e.target.value)}
                              placeholder={'Un numéro par ligne'}
                              rows={2}
                              style={{ minWidth: 220 }}
                            />
                            <button type="button" onClick={() => registerSerials(p.id)}>
                              Enregistrer
                            </button>
                          </div>
                        </>
                      )}

                      {hasCapability('warranties') && (
                        <>
                          <strong>Politique de garantie</strong>
                          {warrantyPolicy ? (
                            <p>
                              {warrantyPolicy.durationDays} jours{warrantyPolicy.terms ? ` — ${warrantyPolicy.terms}` : ''}
                            </p>
                          ) : (
                            <p>Aucune — aucune garantie n'est créée à la vente de ce produit</p>
                          )}
                          <div className="inline-form">
                            <input
                              type="number"
                              min="1"
                              value={warrantyDuration}
                              onChange={(e) => setWarrantyDuration(e.target.value)}
                              placeholder="Durée (jours)"
                              style={{ maxWidth: 120 }}
                            />
                            <input
                              value={warrantyTerms}
                              onChange={(e) => setWarrantyTerms(e.target.value)}
                              placeholder="Conditions (optionnel)"
                              style={{ minWidth: 220 }}
                            />
                            <button type="button" onClick={() => saveWarrantyPolicy(p.id)}>
                              Enregistrer
                            </button>
                          </div>
                        </>
                      )}

                      {hasCapability('batch_tracking') && p.tracksBatches && (
                        <>
                          <strong>Lots / péremption</strong>
                          <ul>
                            {batches.map((b) => (
                              <li key={b.id}>
                                {b.lotNumber} — {b.quantity} restant
                                {b.expiresAt ? ` — expire le ${new Date(b.expiresAt).toLocaleDateString('fr-FR')}` : ''}
                              </li>
                            ))}
                            {batches.length === 0 && <li>Aucun lot enregistré</li>}
                          </ul>
                          <div className="inline-form">
                            <select value={batchLocationId} onChange={(e) => setBatchLocationId(e.target.value)}>
                              {locations.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                            </select>
                            <input
                              value={newBatchLot}
                              onChange={(e) => setNewBatchLot(e.target.value)}
                              placeholder="Numéro de lot"
                              style={{ maxWidth: 160 }}
                            />
                            <input
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={newBatchQty}
                              onChange={(e) => setNewBatchQty(e.target.value)}
                              placeholder="Quantité"
                              style={{ maxWidth: 120 }}
                            />
                            <input
                              type="date"
                              value={newBatchExpiry}
                              onChange={(e) => setNewBatchExpiry(e.target.value)}
                            />
                            <button type="button" onClick={() => registerBatch(p.id)}>
                              Enregistrer
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <Pagination
        currentPage={currentPage}
        totalItems={filteredProducts.length}
        pageSize={20}
        onPageChange={setCurrentPage}
        itemName="produits"
      />
      </>
      )}

      {/* ── MODAL IMPORTATION POLYVALENT (CSV & TXT) ── */}
      {showImportModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '750px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>Importer des produits (CSV & TXT)</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                  Formats acceptés : fichier CSV (séparateur virgule ou point-virgule) ou fichier TXT (séparateur tabulation).
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" onClick={downloadSampleCsv} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                  📄 Modèle CSV
                </button>
                <button type="button" onClick={downloadSampleTxt} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                  📝 Modèle TXT
                </button>
              </div>
            </div>

            {/* Zone de chargement de fichier physique */}
            <div
              style={{
                background: '#f8fafc',
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                marginBottom: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                <strong>Charger un fichier depuis votre appareil :</strong>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Sélectionnez un fichier .csv ou .txt exporté d'Excel ou Bloc-notes.</div>
              </div>
              <label
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-block',
                }}
              >
                Parcourir...
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Ou collez directement vos lignes de données ci-dessous :
            </p>

            <textarea
              rows={7}
              value={importCsvContent}
              onChange={(e) => {
                setImportCsvContent(e.target.value);
                setImportPreview(null);
              }}
              placeholder={`nom,sku,prix,type,unite,code_barre\nRiz Parfumé 25kg,RIZ-25KG,18500,PHYSICAL,Sac,6181100123456\nHuile 5L,HUILE-5L,6500,PHYSICAL,Bidon,\nInstallation Antenne,SRV-INST,10000,SERVICE,H,`}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.82rem', marginBottom: '0.85rem', padding: '0.65rem' }}
            />

            {importPreview && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  background: importPreview.errorCount > 0 ? '#fff1f2' : '#f0fdf4',
                  border: `1px solid ${importPreview.errorCount > 0 ? '#fecdd3' : '#bbf7d0'}`,
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ fontWeight: 700, color: importPreview.errorCount > 0 ? '#9f1239' : '#166534' }}>
                  Rapport de pré-vérification : {importPreview.validCount} article(s) conforme(s) à importer, {importPreview.errorCount} anomalie(s) sur {importPreview.totalRows} lignes.
                </div>
                {importPreview.preview && importPreview.preview.length > 0 && (
                  <div style={{ marginTop: '0.5rem', maxHeight: '120px', overflowY: 'auto' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#475569', marginBottom: '0.25rem' }}>Aperçu des premiers articles valides :</div>
                    {importPreview.preview.map((p, idx) => (
                      <div key={idx} style={{ fontSize: '0.78rem', color: '#334155' }}>
                        • <strong>{p.name}</strong> ({p.sku}) — {Number(p.price).toLocaleString('fr-FR')} XOF [{p.type}]
                      </div>
                    ))}
                  </div>
                )}
                {importPreview.errors.length > 0 && (
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: '#b91c1c', fontSize: '0.78rem' }}>
                    {importPreview.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>Ligne {err.row} : {err.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowImportModal(false)} className="btn-secondary">
                Fermer
              </button>
              <button
                type="button"
                onClick={handleDryRunImport}
                disabled={importing || !importCsvContent.trim()}
                className="btn-secondary"
              >
                🔍 Tester / Prévisualiser
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={Boolean(importing || !importCsvContent.trim() || (importPreview && importPreview.validCount === 0))}
                className="primary"
              >
                {importing ? 'Importation en cours...' : '🚀 Valider et Importer dans le catalogue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useMemo, useRef, type FormEvent } from 'react';
import { api, fetchBlob, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';
import { ReceiptViewModal } from '../components/ReceiptViewModal';
import { ProductSearchSelector } from '../components/ProductSearchSelector';
import { PostSaleSuccessModal } from '../components/PostSaleSuccessModal';

interface Location {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku?: string | null;
  basePrice: string;
  unit: string;
  isService?: boolean;
  hasVariants: boolean;
  tracksSerialNumbers: boolean;
  parentProductId: string | null;
  barcodes?: string[];
  brand?: string | null;
  stockOnHand?: number;
  stockReserved?: number;
  stockAvailable?: number;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SERVICE';
  otherLocationsStock?: {
    locationId: string;
    locationName: string;
    available: number;
  }[];
}

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  creditAccount?: {
    balance: string;
  } | null;
}

interface LineDraft {
  productId: string;
  quantity: string;
  unit: string;
  serialNumbers: string;
  immediateRestock?: boolean;
  immediateRestockQty?: string;
  immediateRestockSource?: string;
  immediateRestockCost?: string;
}

interface ProductUnit {
  unit: string;
  factor: string;
}

interface SerialNumberRow {
  serial: string;
  status: string;
}

interface SaleLineResult {
  id: string;
  productNameSnapshot: string;
  quantity: string;
  lineTotal: string;
}

interface SaleDocument {
  id: string;
  number: string;
}

interface SaleResult {
  id: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  paymentStatus: string;
  currency: string;
  lines: SaleLineResult[];
  documents: SaleDocument[];
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CARD', label: 'Carte Bancaire' },
  { value: 'BANK_TRANSFER', label: 'Virement' },
  { value: 'CHECK', label: 'Chèque' },
];

function getStoredOperationId(locId?: string): string {
  try {
    const key = `vtm_tab_sale_op_${locId || 'default'}`;
    let val = sessionStorage.getItem(key);
    if (!val) {
      val = crypto.randomUUID();
      sessionStorage.setItem(key, val);
    }
    return val;
  } catch {
    return crypto.randomUUID();
  }
}

function rotateOperationId(locId?: string): string {
  try {
    const key = `vtm_tab_sale_op_${locId || 'default'}`;
    const next = crypto.randomUUID();
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export function NewSalePage() {
  const { addToast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locationId, setLocationId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ productId: '', quantity: '1', unit: '', serialNumbers: '' }]);
  const [unitsByProduct, setUnitsByProduct] = useState<Record<string, ProductUnit[]>>({});
  const [availableSerialsByProduct, setAvailableSerialsByProduct] = useState<Record<string, SerialNumberRow[]>>({});
  const [fullPayment, setFullPayment] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [mobileMoneyReference, setMobileMoneyReference] = useState('');
  const [heldCarts, setHeldCarts] = useState<Array<{
    id: string;
    label: string;
    customerName?: string | null;
    estimatedTotal: string;
    items: Array<{ productId: string; quantity: string; unit?: string }>;
    createdAt: string;
  }>>([]);
  const [showHeldCartsModal, setShowHeldCartsModal] = useState(false);
  const [result, setResult] = useState<SaleResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);
  const currentOperationIdRef = useRef<string>(getStoredOperationId());
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [showImmediateRestockModal, setShowImmediateRestockModal] = useState(false);

  // Quick Customer Creation Modal State
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Receipt Preview Modal
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);

  // Post-Sale Modal (Choice: Receipt, Invoice, Both, Print, Download, WhatsApp)
  const [createdSaleData, setCreatedSaleData] = useState<{
    saleId: string;
    grandTotal: string | number;
    currency: string;
    lines: Array<{ productName: string; quantity: number | string; price: number | string }>;
  } | null>(null);

  // Initial load
  useEffect(() => {
    api
      .get<Location[]>('/locations')
      .then((l) => {
        setLocations(l);
        if (l[0]) setLocationId(l[0].id);
      })
      .catch(() => {});
    api.get<Customer[]>('/customers').then(setCustomers).catch(() => {});
    api
      .get<Record<string, unknown>>('/settings')
      .then((s) => setAllowNegativeStock(Boolean(s['inventory.allowNegativeStock'])))
      .catch(() => {});
  }, []);

  // Fetch products and held carts whenever locationId changes
  useEffect(() => {
    if (!locationId) return;
    currentOperationIdRef.current = getStoredOperationId(locationId);
    api
      .get<Product[]>(`/products?locationId=${locationId}`)
      .then(setProducts)
      .catch(() => {});
    api
      .get<any[]>(`/sales/held-carts?locationId=${locationId}`)
      .then(setHeldCarts)
      .catch(() => {});
  }, [locationId]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId);
  }, [customers, customerId]);

  const estimatedTotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const p = products.find((pp) => pp.id === l.productId);
      return sum + (p ? Number(p.basePrice) * Number(l.quantity || 0) : 0);
    }, 0);
  }, [lines, products]);

  const discountedTotal = useMemo(() => {
    const disc = Number(discountPercent || 0);
    if (disc > 0 && disc <= 100) {
      return estimatedTotal * (1 - disc / 100);
    }
    return estimatedTotal;
  }, [estimatedTotal, discountPercent]);

  // In-sales stock transfer modal state
  const [transferModalProduct, setTransferModalProduct] = useState<Product | null>(null);
  const [transferSourceLocId, setTransferSourceLocId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('1');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const handleExecuteTransfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferModalProduct || !transferSourceLocId || !locationId) return;
    setTransferSubmitting(true);
    try {
      const qtyInt = parseInt(transferQuantity, 10);
      if (isNaN(qtyInt) || qtyInt <= 0) {
        throw new Error('La quantité à transférer doit être un nombre entier positif.');
      }
      const transfer = await api.post<{ id: string }>('/stock-transfers', {
        fromLocationId: transferSourceLocId,
        toLocationId: locationId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: transferModalProduct.id, quantity: String(qtyInt) }],
      });
      await api.post(`/stock-transfers/${transfer.id}/confirm`, {});
      await api.post(`/stock-transfers/${transfer.id}/receive`, {});

      addToast(`Transfert de ${qtyInt} ${transferModalProduct.unit} réceptionné avec succès.`, 'success');
      setTransferModalProduct(null);
      setTransferQuantity('1');
      // Rafraîchir les stocks pour le dépôt courant
      const updated = await api.get<Product[]>(`/products?locationId=${locationId}`);
      setProducts(updated);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors du transfert de stock', 'error');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleHoldCart = async () => {
    const validLines = lines.filter((l) => l.productId);
    if (validLines.length === 0) {
      addToast('Ajoutez au moins un article dans la vente avant de mettre le panier en attente.', 'warning');
      return;
    }
    try {
      const items = validLines.map((l) => {
        const prod = products.find((p) => p.id === l.productId);
        return {
          productId: l.productId,
          productName: prod?.name || 'Article',
          quantity: l.quantity,
          unitPrice: String(prod?.basePrice || 0),
          unit: l.unit || undefined,
          serialNumbers: l.serialNumbers
            ? l.serialNumbers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
            : undefined,
        };
      });
      await api.post('/sales/held-carts', {
        locationId,
        customerId: customerId || undefined,
        customerName: selectedCustomer?.name || undefined,
        items,
        estimatedTotal: String(discountedTotal),
      });
      addToast('Panier mis en attente avec succès. Caisse libérée pour le client suivant.', 'success');
      setLines([{ productId: '', quantity: '1', unit: '', serialNumbers: '' }]);
      setCustomerId('');
      setTenderedAmount('');
      setDiscountPercent('');
      const updated = await api.get<any[]>(`/sales/held-carts?locationId=${locationId}`);
      setHeldCarts(updated);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la mise en attente', 'error');
    }
  };

  const handleResumeCart = async (cart: any) => {
    try {
      await api.post(`/sales/held-carts/${cart.id}/resume`);
      setCustomerId(cart.customerId || '');
      setLines(
        cart.items.map((it: any) => ({
          productId: it.productId,
          quantity: it.quantity,
          unit: it.unit || '',
          serialNumbers: it.serialNumbers ? it.serialNumbers.join('\n') : '',
        })),
      );
      setHeldCarts((prev) => prev.filter((x) => x.id !== cart.id));
      setShowHeldCartsModal(false);
      addToast(`Panier "${cart.label}" restauré en caisse.`, 'info');
    } catch (err) {
      if (locationId) {
        api.get<any[]>(`/sales/held-carts?locationId=${locationId}`).then(setHeldCarts).catch(() => {});
      }
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la reprise du panier', 'error');
    }
  };

  const unhandledOverStockLines = useMemo(() => {
    if (allowNegativeStock) return [];
    return lines.filter((line) => {
      if (!line.productId) return false;
      if (line.immediateRestock) return false;
      const p = products.find((pp) => pp.id === line.productId);
      if (!p || p.isService) return false;
      const qty = Number(line.quantity || 0);
      const avail = p.stockAvailable ?? 0;
      return qty > avail;
    });
  }, [lines, products, allowNegativeStock]);

  const hasStockExceeded = useMemo(() => {
    return unhandledOverStockLines.length > 0;
  }, [unhandledOverStockLines]);

  const hasImmediateRestockLines = useMemo(() => {
    return lines.some((l) => l.productId && l.immediateRestock);
  }, [lines]);

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, ...patch };
        if (patch.quantity !== undefined && next.immediateRestock) {
          const p = products.find((pp) => pp.id === next.productId);
          const avail = p ? p.stockAvailable ?? 0 : 0;
          const numQty = Number(patch.quantity || 0);
          next.immediateRestockQty = String(Math.max(1, numQty - avail));
        }
        return next;
      })
    );
  };

  const selectProduct = async (index: number, product: Product, autoImmediateRestock = false) => {
    setProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]));
    const isExceeded = !product.isService && (product.stockAvailable ?? 0) < 1;
    const shouldRestock = autoImmediateRestock || (isExceeded && !allowNegativeStock);

    updateLine(index, {
      productId: product.id,
      unit: product.unit ?? '',
      serialNumbers: '',
      immediateRestock: shouldRestock,
      immediateRestockQty: shouldRestock ? '1' : undefined,
      immediateRestockSource: 'Présent physiquement en boutique',
    });

    if (product.id && !unitsByProduct[product.id]) {
      try {
        const units = await api.get<ProductUnit[]>(`/units?productId=${product.id}`);
        setUnitsByProduct((prev) => ({ ...prev, [product.id]: units }));
      } catch {
        // Pas d'unités alternatives
      }
    }
    if (product.tracksSerialNumbers && !availableSerialsByProduct[product.id]) {
      try {
        const available = await api.get<SerialNumberRow[]>(`/products/${product.id}/serial-numbers?status=AVAILABLE`);
        setAvailableSerialsByProduct((prev) => ({ ...prev, [product.id]: available }));
      } catch {
        // Pas de liste de séries
      }
    }
  };

  const addLine = () => setLines((prev) => [...prev, { productId: '', quantity: '1', unit: '', serialNumbers: '' }]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const handleQuickCustomerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    setCreatingCustomer(true);
    try {
      const created = await api.post<Customer>('/customers', {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
        email: newCustomerEmail.trim() || undefined,
      });
      setCustomers((prev) => [...prev, created]);
      setCustomerId(created.id);
      setShowQuickCustomerModal(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      addToast(`Client « ${created.name} » créé et sélectionné.`, 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la création du client', 'error');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const executeSaleSubmission = async (overrideLines?: LineDraft[]) => {
    // 🛡️ Protection Anti-Double Clic / Clics Subits Multiples (Idempotence)
    const now = Date.now();
    if (isSubmittingRef.current || (now - lastSubmitTimeRef.current < 2000)) {
      addToast(
        "Opération déjà en cours de traitement. Les clics supplémentaires sont bloqués pour éviter tout doublon de vente ou d'encaissement. [Code : VTM-SALE-002]",
        'info',
      );
      return;
    }

    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;
    setResult(null);
    setSubmitting(true);

    const activeLines = overrideLines || lines;
    const immediateRestocks = activeLines
      .filter((l) => l.productId && l.immediateRestock)
      .map((l) => ({
        productId: l.productId,
        quantity: l.immediateRestockQty || l.quantity,
        source: l.immediateRestockSource || 'Présent physiquement en boutique',
        costPrice: l.immediateRestockCost || undefined,
      }));

    try {
      const sale = await api.post<SaleResult>('/sales', {
        locationId,
        customerId: customerId || undefined,
        operationId: currentOperationIdRef.current,
        lines: activeLines
          .filter((l) => l.productId)
          .map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unit: l.unit || undefined,
            serialNumbers: l.serialNumbers
              ? l.serialNumbers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
              : undefined,
          })),
        immediateRestocks: immediateRestocks.length > 0 ? immediateRestocks : undefined,
        tenderedAmount: tenderedAmount ? String(tenderedAmount) : undefined,
        discountPercent: discountPercent ? String(discountPercent) : undefined,
        payments: fullPayment
          ? undefined
          : [
              {
                method: paymentMethod,
                amount: paymentAmount || '0',
                reference: paymentMethod === 'MOBILE_MONEY' ? mobileMoneyReference.trim() : undefined,
                status: 'COMPLETED',
              },
            ],
      });
      setResult(sale);
      const lineDetails = activeLines
        .filter((l) => l.productId)
        .map((l) => {
          const prod = products.find((p) => p.id === l.productId);
          return {
            productName: prod?.name || 'Article',
            quantity: l.quantity,
            price: Number(prod?.basePrice || 0) * Number(l.quantity || 1),
          };
        });
      setCreatedSaleData({
        saleId: sale.id,
        grandTotal: sale.grandTotal,
        currency: sale.currency,
        lines: lineDetails,
      });
      setLines([{ productId: '', quantity: '1', unit: '', serialNumbers: '' }]);
      setPaymentAmount('');
      currentOperationIdRef.current = rotateOperationId(locationId);
      setShowImmediateRestockModal(false);
      addToast(`Vente validée avec succès (${sale.grandTotal} ${sale.currency}).`, 'success');

      // Refresh product stock levels after successful sale
      if (locationId) {
        api.get<Product[]>(`/products?locationId=${locationId}`).then(setProducts).catch(() => {});
      }
    } catch (err) {
      // Si échec certain côté serveur (erreur 4xx), la vente n'a pas été enregistrée.
      // Si rupture réseau ou coupure avant réponse, la clé est conservée dans localStorage
      // garantissant qu'une actualisation ou nouvel appui renvoie la même opération de manière idempotente.
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la validation de la vente', 'error');
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1500);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || (Date.now() - lastSubmitTimeRef.current < 2000)) {
      return;
    }
    if (!allowNegativeStock && unhandledOverStockLines.length > 0) {
      setShowImmediateRestockModal(true);
      return;
    }
    executeSaleSubmission();
  };

  const openReceiptPdf = async (documentId: string) => {
    try {
      const blob = await fetchBlob(`/documents/${documentId}/pdf`);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Impossible de générer le reçu PDF', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Nouvelle Vente / Caisse"
        subtitle="Disponibilité immédiate des stocks, vérification du client et encaissement sécurisé"
        badges={[
          { label: `${lines.filter((l) => l.productId).length} article(s)`, variant: 'info' },
          { label: `Total : ${estimatedTotal.toLocaleString('fr-FR')} XOF`, variant: 'primary' },
        ]}
      />

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Panneau Principal : Articles et Emplacement */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Ligne Contexte (Emplacement & Client) */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Emplacement / Dépôt de vente *
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Les stocks affichés ci-dessous sont calculés pour ce dépôt
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                    Client (optionnel)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCustomerModal(true)}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                  >
                    + Nouveau client
                  </button>
                </div>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Client comptoir (anonyme)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>

                {/* Encours / Solde client existant */}
                {selectedCustomer?.creditAccount && Number(selectedCustomer.creditAccount.balance) > 0 && (
                  <div
                    style={{
                      marginTop: '0.4rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <span>⚠️</span>
                    <span>
                      Solde dû client : <strong>{Number(selectedCustomer.creditAccount.balance).toLocaleString('fr-FR')} XOF</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Articles du panier */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Articles de la vente</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleHoldCart}
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}
                    title="Sauvegarder ce panier en attente pour servir le client suivant"
                  >
                    ⏸️ Mettre en attente
                  </button>
                  {heldCarts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHeldCartsModal(true)}
                      className="btn-secondary"
                      style={{ fontSize: '0.82rem', background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd', fontWeight: 700 }}
                    >
                      📋 Paniers en attente ({heldCarts.length})
                    </button>
                  )}
                  <button type="button" onClick={addLine} className="btn-secondary" style={{ fontSize: '0.82rem' }}>
                    + Ajouter une ligne
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {lines.map((line, i) => {
                  const product = products.find((p) => p.id === line.productId);
                  const altUnits = line.productId ? (unitsByProduct[line.productId] ?? []) : [];
                  const lineTotal = product ? Number(product.basePrice) * Number(line.quantity || 0) : 0;
                  const qty = Number(line.quantity || 0);
                  const avail = product?.stockAvailable ?? 0;
                  const isOverStock = product && !product.isService && qty > avail;

                  return (
                    <div
                      key={i}
                      style={{
                        background: 'var(--surface-muted, #f8fafc)',
                        border: isOverStock ? '1.5px solid #ef4444' : '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '1rem',
                        transition: 'border-color 0.2s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      {/* Zone 1 : Sélection & Fiche produit en pleine largeur */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                          Article N° {i + 1} {product ? `— ${product.name}` : ''}
                        </div>
                        <ProductSearchSelector
                          selectedProduct={product || null}
                          onSelect={(p, autoRestock) => selectProduct(i, p as any, autoRestock)}
                          onClear={() => updateLine(i, { productId: '', unit: '', quantity: '1' })}
                          locationId={locationId}
                          disabled={submitting}
                          onTransferClick={(p) => {
                            setTransferModalProduct(p as any);
                            const other = p.otherLocationsStock?.find((o) => o.available > 0);
                            if (other) setTransferSourceLocId(other.locationId);
                            setTransferQuantity('1');
                          }}
                        />
                      </div>

                      {/* Zone 2 : Paramètres de la ligne (Quantité avec steppers, Unité, Prix, Total, Suppression) */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          background: '#ffffff',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {/* Stepper de Quantité ergonomique */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                            Quantité :
                          </span>
                          <button
                            type="button"
                            disabled={Number(line.quantity || 1) <= 1}
                            onClick={() => updateLine(i, { quantity: String(Math.max(1, Number(line.quantity || 1) - 1)) })}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={line.quantity}
                            onChange={(e) => updateLine(i, { quantity: e.target.value })}
                            style={{
                              width: '65px',
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: '0.95rem',
                              padding: '0.25rem',
                              borderColor: isOverStock ? '#ef4444' : undefined,
                              background: isOverStock ? '#fff5f5' : undefined,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => updateLine(i, { quantity: String(Number(line.quantity || 0) + 1) })}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            +
                          </button>
                        </div>

                        {/* Unité de vente */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                            Unité :
                          </span>
                          {product ? (
                            <select
                              value={line.unit || product.unit}
                              onChange={(e) => updateLine(i, { unit: e.target.value })}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                            >
                              <option value={product.unit}>{product.unit}</option>
                              {altUnits.map((u) => (
                                <option key={u.unit} value={u.unit}>
                                  {u.unit} (×{u.factor})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </div>

                        {/* Prix unitaire */}
                        {product && (
                          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            P.U. : <strong>{Number(product.basePrice).toLocaleString('fr-FR')} XOF</strong>
                          </div>
                        )}

                        {/* Total de la ligne en grand */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Total ligne</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#16a34a' }}>
                              {lineTotal.toLocaleString('fr-FR')} XOF
                            </div>
                          </div>

                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(i)}
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                color: '#b91c1c',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                width: '30px',
                                height: '30px',
                                borderRadius: '5px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Supprimer cette ligne"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Indicateur de stock du produit sélectionné */}
                      {product && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.78rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {product.isService ? (
                              <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                                🛠️ Prestation de service (aucun stock requis)
                              </span>
                            ) : product.stockStatus === 'IN_STOCK' ? (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                                ✓ Stock disponible : {Math.round(product.stockAvailable ?? 0)} {product.unit} (En main : {Math.round(product.stockOnHand ?? 0)}, Réservé : {Math.round(product.stockReserved ?? 0)})
                              </span>
                            ) : product.stockStatus === 'LOW_STOCK' ? (
                              <span style={{ background: '#ffedd5', color: '#c2410c', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                                ⚠️ Stock faible : {Math.round(product.stockAvailable ?? 0)} {product.unit} disponible(s)
                              </span>
                            ) : (
                              <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                                ✕ Rupture de stock dans ce dépôt (0 {product.unit} dispo)
                              </span>
                            )}

                            {/* Autres emplacements */}
                            {product.otherLocationsStock && product.otherLocationsStock.some((o) => o.available > 0) && (
                              <span style={{ color: 'var(--text-muted)' }}>
                                · Disponible dans d'autres dépôts :{' '}
                                {product.otherLocationsStock
                                  .filter((o) => o.available > 0)
                                  .map((o) => `${o.locationName} (${Math.round(o.available)})`)
                                  .join(', ')}
                              </span>
                            )}
                          </div>

                          {product.otherLocationsStock && product.otherLocationsStock.some((o) => o.available > 0) && (
                            <button
                              type="button"
                              onClick={() => {
                                setTransferModalProduct(product);
                                const other = product.otherLocationsStock?.find((o) => o.available > 0);
                                if (other) setTransferSourceLocId(other.locationId);
                                setTransferQuantity('1');
                              }}
                              className="btn-secondary"
                              style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', color: '#1d4ed8', background: '#eff6ff' }}
                            >
                              Transférer du stock sans quitter la vente ⇄
                            </button>
                          )}
                        </div>
                      )}

                      {/* Alerte dépassement quantité, Vente en stock négatif ou Entrée immédiate & Vendre direct */}
                      {isOverStock && (
                        <div style={{ marginTop: '0.6rem' }}>
                          {allowNegativeStock ? (
                            <div
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                padding: '0.6rem 0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.82rem',
                                color: '#166534',
                                fontWeight: 600,
                              }}
                            >
                              <span>🟢</span>
                              <span>
                                <strong>Vente directe en stock négatif autorisée :</strong> Le stock informatique est à {avail} {product.unit}, la vente sera validée directement sans blocage et créera un solde négatif traçable ({avail} - {qty} = {avail - qty} {product.unit}).
                              </span>
                            </div>
                          ) : !line.immediateRestock ? (
                            <div
                              style={{
                                background: '#fffbeb',
                                border: '1.5px solid #fde68a',
                                borderRadius: '6px',
                                padding: '0.75rem 0.9rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem',
                                }}
                              >
                                <div>
                                  <div style={{ color: '#b45309', fontWeight: 700, fontSize: '0.88rem' }}>
                                    ⚡ Stock informatique insuffisant : {avail} {product.unit} disponible(s), {qty} demandé(s)
                                  </div>
                                  <div style={{ color: '#92400e', fontSize: '0.78rem', marginTop: '2px' }}>
                                    L'article est-il physiquement présent en rayon ou entre les mains du client ?
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {avail > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => updateLine(i, { quantity: String(avail), immediateRestock: false })}
                                      className="btn-secondary"
                                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: '#ffffff' }}
                                    >
                                      Ajuster au stock ({avail})
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateLine(i, {
                                        immediateRestock: true,
                                        immediateRestockQty: String(Math.max(1, qty - avail)),
                                        immediateRestockSource: 'Présent physiquement en boutique',
                                      })
                                    }
                                    style={{
                                      background: '#16a34a',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '0.45rem 0.9rem',
                                      fontSize: '0.84rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.4rem',
                                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                                    }}
                                  >
                                    ⚡ Entrée immédiate & Vendre direct (+{Math.max(1, qty - avail)})
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                background: '#f0fdf4',
                                border: '1.5px solid #86efac',
                                borderRadius: '6px',
                                padding: '0.75rem 0.9rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontWeight: 700, fontSize: '0.88rem' }}>
                                  <span>✓ Entrée immédiate activée (+{line.immediateRestockQty || Math.max(1, qty - avail)} {product?.unit})</span>
                                  <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                                    Vente débloquée
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => updateLine(i, { immediateRestock: false })}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#dc2626',
                                    fontSize: '0.76rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✕ Annuler le réassort
                                </button>
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#166534' }}>
                                Stock actuel : {avail} · Entrée traçable en magasin : +{line.immediateRestockQty || Math.max(1, qty - avail)} · Vente : -{qty} · Stock final estimé : {avail + Number(line.immediateRestockQty || Math.max(1, qty - avail)) - qty} {product?.unit}.
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Numéros de série si requis */}
                      {product?.tracksSerialNumbers && (
                        <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border)' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>
                            Traçabilité sérialisée — Exactement {line.quantity || '?'} numéro(s) requis :
                          </div>
                          <textarea
                            value={line.serialNumbers}
                            onChange={(e) => updateLine(i, { serialNumbers: e.target.value })}
                            placeholder="Saisissez ou scannez les numéros de série (1 par ligne)"
                            rows={2}
                            style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'monospace' }}
                            required
                          />
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Disponibles en stock : {(availableSerialsByProduct[product.id] ?? []).map((s) => s.serial).join(', ') || 'aucun en stock'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Panneau Latéral : Règlement & Validation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Règlement</h3>

              <div
                style={{
                  background: 'var(--primary-soft, #f5f7ff)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem',
                  marginBottom: '1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total à encaisser</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', margin: '0.2rem 0' }}>
                  {discountedTotal.toLocaleString('fr-FR')} XOF
                </div>
                {Number(discountPercent || 0) > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                    Remise globale {discountPercent}% appliquée (Initial : {estimatedTotal.toLocaleString('fr-FR')} XOF)
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Toutes taxes comprises</div>
              </div>

              {/* Remise commerciale globale sur le ticket */}
              <div
                style={{
                  background: 'var(--surface-muted, #f8fafc)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Remise commerciale ticket (%)
                  </label>
                  {Number(discountPercent || 0) > 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>
                      -{(estimatedTotal - discountedTotal).toLocaleString('fr-FR')} XOF
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="0"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Plafonds autorisés : Vendeur ≤ 5% | Manager ≤ 15% | Propriétaire illimité
                </div>
              </div>

              {hasStockExceeded ? (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1.5px solid #fde68a',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem',
                    marginBottom: '1rem',
                    fontSize: '0.82rem',
                    color: '#92400e',
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>⚡ Stock insuffisant détecté</div>
                  Un ou plusieurs articles ont un stock système à 0 ou insuffisant. En cliquant sur le bouton ci-dessous, vous pourrez confirmer l'entrée immédiate pour valider la vente directement sans blocage.
                </div>
              ) : hasImmediateRestockLines ? (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    fontSize: '0.82rem',
                    color: '#166534',
                    fontWeight: 600,
                  }}
                >
                  ✓ Approvisionnement immédiat activé : Les articles physiques manquants seront réceptionnés et vendus dans la même transaction.
                </div>
              ) : allowNegativeStock ? (
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem',
                    marginBottom: '1rem',
                    fontSize: '0.78rem',
                    color: '#1e40af',
                    fontWeight: 500,
                  }}
                >
                  🟢 Vente en stock négatif autorisée par vos paramètres d'entreprise.
                </div>
              ) : null}

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={fullPayment}
                  onChange={(e) => setFullPayment(e.target.checked)}
                />
                Paiement intégral comptant (espèces)
              </label>

              {fullPayment && (
                <div
                  style={{
                    background: 'var(--surface-muted, #f8fafc)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem',
                    marginBottom: '1rem',
                  }}
                >
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Montant remis par le client (espèces)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tenderedAmount}
                    onChange={(e) => setTenderedAmount(e.target.value)}
                    placeholder={`Ex: ${(Math.ceil(discountedTotal / 1000) * 1000 || discountedTotal)}`}
                    style={{ width: '100%' }}
                  />
                  {tenderedAmount && Number(tenderedAmount) >= discountedTotal && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: '#f0fdf4',
                        border: '1px solid #86efac',
                        borderRadius: '4px',
                        color: '#15803d',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>💰</span>
                      <span>
                        Monnaie à rendre : {(Number(tenderedAmount) - discountedTotal).toLocaleString('fr-FR')} XOF
                      </span>
                    </div>
                  )}
                  {tenderedAmount && Number(tenderedAmount) < discountedTotal && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.45rem 0.75rem',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '4px',
                        color: '#b45309',
                        fontSize: '0.78rem',
                      }}
                    >
                      ⚠️ Montant remis insuffisant (manque {(discountedTotal - Number(tenderedAmount)).toLocaleString('fr-FR')} XOF)
                    </div>
                  )}
                </div>
              )}

              {!fullPayment && (
                <div
                  style={{
                    background: 'var(--surface-muted, #f8fafc)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Mode de paiement
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Montant perçu immédiatement
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`Total dû : ${discountedTotal}`}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  {paymentMethod === 'CASH' && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Montant remis en espèces
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={tenderedAmount}
                        onChange={(e) => setTenderedAmount(e.target.value)}
                        placeholder="Montant du billet remis"
                        style={{ width: '100%' }}
                      />
                      {tenderedAmount && Number(tenderedAmount) >= Number(paymentAmount || 0) && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            borderRadius: '4px',
                            color: '#15803d',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          💰 Monnaie à rendre : {(Number(tenderedAmount) - Number(paymentAmount || 0)).toLocaleString('fr-FR')} XOF
                        </div>
                      )}
                    </div>
                  )}

                  {paymentMethod === 'MOBILE_MONEY' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Référence de transaction opérateur (Requis)
                      </label>
                      <input
                        type="text"
                        value={mobileMoneyReference}
                        onChange={(e) => setMobileMoneyReference(e.target.value)}
                        placeholder="Ex: OM-20261101-8493, Wave-TX774"
                        required
                        style={{ width: '100%' }}
                      />
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        La référence SMS/API reçue est obligatoire pour la traçabilité comptable anti-fraude.
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || estimatedTotal <= 0}
                className="primary"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  background: hasImmediateRestockLines || hasStockExceeded ? '#16a34a' : undefined,
                  borderColor: hasImmediateRestockLines || hasStockExceeded ? '#15803d' : undefined,
                }}
              >
                {submitting
                  ? 'Validation...'
                  : hasImmediateRestockLines
                    ? '⚡ Valider la vente (avec réassort direct)'
                    : hasStockExceeded
                      ? '⚡ Valider la vente (entrée immédiate)'
                      : '✓ Valider la vente'}
              </button>
            </div>

            {/* Reçu et actions après validation */}
            {result && (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '2px solid var(--success)',
                  borderRadius: 'var(--radius)',
                  padding: '1.25rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 700, marginBottom: '0.5rem' }}>
                  <span>✓</span> Vente confirmée !
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Réf: <strong>#{result.id.slice(0, 8)}</strong>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Total : {Number(result.grandTotal).toLocaleString('fr-FR')} {result.currency}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Payé : {Number(result.amountPaid).toLocaleString('fr-FR')} {result.currency}
                  {Number(result.balanceDue) > 0 && (
                    <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                      {' '}· Solde restant dû : {Number(result.balanceDue).toLocaleString('fr-FR')} {result.currency}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {result.documents[0] && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveReceiptId(result.documents[0].id)}
                        className="primary"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        🧾 Afficher le reçu à l'écran
                      </button>
                      <button
                        type="button"
                        onClick={() => openReceiptPdf(result.documents[0].id)}
                        className="btn-secondary"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        📄 Télécharger le reçu PDF
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="btn-secondary"
                    style={{ width: '100%', fontSize: '0.82rem', marginTop: '0.25rem' }}
                  >
                    Nouvelle opération
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Modal interactif : Approvisionnement Immédiat & Vendre Direct (Section 9 CDC) */}
      {showImmediateRestockModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImmediateRestockModal(false);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '540px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  flexShrink: 0,
                }}
              >
                ⚡
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', color: '#0f172a' }}>
                  Stock informatique insuffisant : Vendre direct ?
                </h3>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b', lineHeight: 1.45 }}>
                  Certains articles ont un stock système à 0 ou insuffisant. Si ces articles sont physiquement présents en magasin, confirmez pour effectuer l'entrée en stock traçable et finaliser la vente directement sans interruption.
                </p>
              </div>
            </div>

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxHeight: '180px',
                overflowY: 'auto',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e' }}>
                Articles nécessitant un réassort immédiat ({unhandledOverStockLines.length}) :
              </div>
              {unhandledOverStockLines.map((l) => {
                const p = products.find((pp) => pp.id === l.productId);
                const avail = p ? p.stockAvailable ?? 0 : 0;
                const qty = Number(l.quantity || 0);
                const missing = Math.max(1, qty - avail);
                return (
                  <div
                    key={l.productId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.84rem',
                      borderBottom: '1px dashed #fcd34d',
                      paddingBottom: '0.35rem',
                    }}
                  >
                    <div>
                      <strong>{p?.name || 'Article'}</strong>
                      <span style={{ color: '#b45309', marginLeft: '0.4rem', fontSize: '0.78rem' }}>
                        (Dispo : {avail} {p?.unit})
                      </span>
                    </div>
                    <div style={{ color: '#16a34a', fontWeight: 700 }}>
                      Entrée requise : +{missing} {p?.unit}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setShowImmediateRestockModal(false)}
                className="btn-secondary"
                style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}
              >
                Ajuster les quantités
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  const upgradedLines = lines.map((l) => {
                    const p = products.find((pp) => pp.id === l.productId);
                    if (!p || p.isService) return l;
                    const avail = p.stockAvailable ?? 0;
                    const qty = Number(l.quantity || 0);
                    if (qty > avail) {
                      return {
                        ...l,
                        immediateRestock: true,
                        immediateRestockQty: String(Math.max(1, qty - avail)),
                        immediateRestockSource: 'Présent physiquement en boutique',
                      };
                    }
                    return l;
                  });
                  setLines(upgradedLines);
                  executeSaleSubmission(upgradedLines);
                }}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.55rem 1.15rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 5px rgba(22, 163, 74, 0.3)',
                }}
              >
                {submitting ? 'Validation...' : '⚡ Oui, entrée immédiate & valider la vente direct'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Customer Modal */}
      {showQuickCustomerModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQuickCustomerModal(false);
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              width: '100%',
              maxWidth: '420px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Création rapide de client</h3>
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleQuickCustomerSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Nom ou Raison sociale *
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Ex: Société ABC / M. Traoré"
                    required
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Ex: +226 70 00 00 00"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder="Ex: contact@client.com"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingCustomer || !newCustomerName.trim()}
                  className="primary"
                  style={{ fontSize: '0.85rem' }}
                >
                  {creatingCustomer ? 'Création...' : 'Créer et associer à la vente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de transfert de stock en cours de vente (Section 8 CDC) */}
      {transferModalProduct && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Transfert de stock en cours de vente</h3>
              <button type="button" onClick={() => setTransferModalProduct(null)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleExecuteTransfer}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>Article</label>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{transferModalProduct.name}</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>Dépôt d'origine (Source)</label>
                  <select
                    value={transferSourceLocId}
                    onChange={(e) => setTransferSourceLocId(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  >
                    <option value="" disabled>Sélectionner le dépôt source...</option>
                    {transferModalProduct.otherLocationsStock
                      ?.filter((o) => o.available > 0)
                      .map((o) => (
                        <option key={o.locationId} value={o.locationId}>
                          {o.locationName} ({Math.round(o.available)} {transferModalProduct.unit} disponibles)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>Dépôt de destination (Vente courante)</label>
                  <input
                    type="text"
                    value={locations.find((l) => l.id === locationId)?.name || 'Boutique courante'}
                    disabled
                    style={{ width: '100%', background: 'var(--bg-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>Quantité à transférer (Nombre entier)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max={transferModalProduct.otherLocationsStock?.find((o) => o.locationId === transferSourceLocId)?.available || 9999}
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setTransferModalProduct(null)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={transferSubmitting || !transferSourceLocId} className="primary">
                  {transferSubmitting ? 'Transfert en cours...' : 'Transférer et réceptionner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'aperçu / impression du reçu */}
      {activeReceiptId && (
        <ReceiptViewModal
          documentId={activeReceiptId}
          onClose={() => setActiveReceiptId(null)}
        />
      )}

      {/* Modal des Paniers en Attente / Suspendus */}
      {showHeldCartsModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '640px', width: '92%' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '0.5rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⏸️</span> Paniers suspendus en caisse ({heldCarts.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowHeldCartsModal(false)}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            {heldCarts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                Aucun panier en attente pour cet emplacement.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '60vh', overflowY: 'auto' }}>
                {heldCarts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.85rem',
                      background: 'var(--surface-muted, #f8fafc)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          {c.label || 'Panier sans titre'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Client : <strong>{c.customerName || 'Passage / Anonyme'}</strong> • {c.items?.length || 0} article(s)
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
                          {Number(c.estimatedTotal || 0).toLocaleString('fr-FR')} XOF
                        </div>
                        {c.createdAt && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(c.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      {c.items?.map((it: any) => `${it.productName || 'Article'} (x${it.quantity})`).join(', ') || 'Articles'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm('Voulez-vous supprimer définitivement ce panier en attente ?')) {
                            try {
                              await api.delete(`/sales/held-carts/${c.id}`);
                              setHeldCarts((prev) => prev.filter((x) => x.id !== c.id));
                              addToast('Panier supprimé.', 'info');
                            } catch {
                              addToast('Erreur suppression panier', 'error');
                            }
                          }
                        }}
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem', color: '#dc2626' }}
                      >
                        Supprimer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResumeCart(c)}
                        className="primary"
                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
                      >
                        Reprendre ce panier en caisse ➔
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowHeldCartsModal(false)}
                className="btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de post-vente immédiat : Facture, Reçu ou Les Deux + WhatsApp */}
      {createdSaleData && (
        <PostSaleSuccessModal
          saleId={createdSaleData.saleId}
          grandTotal={createdSaleData.grandTotal}
          currency={createdSaleData.currency}
          customer={customers.find((c) => c.id === customerId)}
          lines={createdSaleData.lines}
          onClose={() => setCreatedSaleData(null)}
          onNewSale={() => {
            setCreatedSaleData(null);
            setResult(null);
            setLines([{ productId: '', quantity: '1', unit: '', serialNumbers: '' }]);
            setCustomerId('');
          }}
        />
      )}
    </div>
  );
}

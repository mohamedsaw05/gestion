import { useState, useEffect, useRef, type FormEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';

export interface ResellerReceiptItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ResellerReceipt {
  id: string;
  receiptNumber: string;
  date: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  paymentMethod: string;
  notes: string;
  items: ResellerReceiptItem[];
  discount: number;
  totalAmount: number;
  createdAt: string;
}

const STORAGE_KEY = 'vtm_reseller_receipts';

export function ResellerReceiptsPage() {
  const { addToast } = useToast();
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  // Form state
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState('+226 70 00 00 00');
  const [shopAddress, setShopAddress] = useState('Avenue de la Nation, Ouagadougou');
  const [receiptNumber, setReceiptNumber] = useState(() => `REV-${Date.now().toString().slice(-6)}`);
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [clientName, setClientName] = useState('Client Revendeur / Ami');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Espèces');
  const [notes, setNotes] = useState('Marchandise vendue en l’état. Facture émise à titre de quittance revendeur.');

  // Arbitrary product lines
  const [items, setItems] = useState<ResellerReceiptItem[]>([
    {
      id: 'item-1',
      description: '100 Portes métalliques sécurisées haute résistance',
      quantity: 100,
      unitPrice: 30000,
      total: 3000000,
    },
  ]);

  const [discount, setDiscount] = useState<number>(0);
  const [printFormat, setPrintFormat] = useState<'A4' | 'THERMAL'>('A4');

  // Local storage history (100% isolated sandbox)
  const [savedReceipts, setSavedReceipts] = useState<ResellerReceipt[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [selectedHistoryReceipt, setSelectedHistoryReceipt] = useState<ResellerReceipt | null>(null);

  // Save history on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReceipts));
    } catch (err) {
      console.warn('Storage error:', err);
    }
  }, [savedReceipts]);

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (it.total || 0), 0);
  const totalGeneral = Math.max(0, subtotal - discount);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddItem = () => {
    const newItem: ResellerReceiptItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      addToast('Le reçu doit contenir au moins un article', 'warning');
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof ResellerReceiptItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = field === 'quantity' ? Number(value) || 0 : it.quantity;
          const price = field === 'unitPrice' ? Number(value) || 0 : it.unitPrice;
          updated.total = qty * price;
        }
        return updated;
      }),
    );
  };

  const handleSaveToLocalCarnet = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!clientName.trim()) {
      addToast('Veuillez renseigner le nom du client', 'error');
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      addToast('Veuillez donner une désignation à chaque article', 'error');
      return;
    }

    const receipt: ResellerReceipt = {
      id: `receipt-${Date.now()}`,
      receiptNumber,
      date: receiptDate,
      shopName,
      shopPhone,
      shopAddress,
      clientName,
      clientPhone,
      clientAddress,
      paymentMethod,
      notes,
      items,
      discount,
      totalAmount: totalGeneral,
      createdAt: new Date().toISOString(),
    };

    setSavedReceipts((prev) => [receipt, ...prev]);
    addToast('Reçu revendeur enregistré dans votre carnet local !', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLoadReceipt = (r: ResellerReceipt) => {
    setReceiptNumber(r.receiptNumber);
    setReceiptDate(r.date);
    setShopName(r.shopName);
    setShopPhone(r.shopPhone);
    setShopAddress(r.shopAddress);
    setClientName(r.clientName);
    setClientPhone(r.clientPhone);
    setClientAddress(r.clientAddress);
    setPaymentMethod(r.paymentMethod);
    setNotes(r.notes);
    setItems(r.items);
    setDiscount(r.discount || 0);
    setSelectedHistoryReceipt(r);
    addToast(`Reçu #${r.receiptNumber} chargé pour consultation`, 'info');
  };

  const handleResetForm = () => {
    setReceiptNumber(`REV-${Date.now().toString().slice(-6)}`);
    setReceiptDate(new Date().toISOString().slice(0, 10));
    setClientName('');
    setClientPhone('');
    setClientAddress('');
    setItems([
      {
        id: `item-${Date.now()}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
    setDiscount(0);
    setSelectedHistoryReceipt(null);
    addToast('Nouveau reçu vierge initialisé', 'info');
  };

  const handleDeleteHistoryReceipt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Voulez-vous supprimer ce reçu de l’historique local ?')) {
      setSavedReceipts((prev) => prev.filter((r) => r.id !== id));
      addToast('Reçu supprimé de l’historique', 'info');
      if (selectedHistoryReceipt?.id === id) {
        setSelectedHistoryReceipt(null);
      }
    }
  };

  return (
    <div className="reseller-receipts-page">
      <PageHeader
        title="Reçus Revendeur & Factures Spéciales"
        subtitle="Personnalisez n'importe quel produit et prix à la volée pour vos clients et amis — 100% indépendant du vrai stock"
        primaryAction={{
          label: '🖨️ Imprimer le Reçu',
          onClick: handlePrint,
        }}
      />

      {/* Strict Isolation Notice Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b, #311042)',
          border: '2px solid #818cf8',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          color: '#ffffff',
          marginBottom: '1.5rem',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <span style={{ fontSize: '2rem' }}>🛡️</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#c7d2fe', marginBottom: '0.25rem' }}>
            ESPACE ISOLÉ / BAC À SABLE REVENDEUR (ZÉRO IMPACT GESTIONNAIRE)
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: 1.5, color: '#e0e7ff' }}>
            Ce module est <strong>totalement déconnecté de votre comptabilité</strong>. Vous pouvez y créer librement n'importe quel produit
            (ex: <em>100 portes métalliques à 3 000 000 F CFA</em>), fixer le montant de votre choix et délivrer la facture immédiatement à votre client.
            <strong> Aucun montant ni article créé ici ne sera jamais imputé au chiffre d'affaires, ni aux statistiques, ni au stock réel.</strong>
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 1.1fr) minmax(340px, 0.9fr)', gap: '1.5rem', alignItems: 'start' }}>
        {/* Colonne Gauche : Formulaire de création / personnalisation */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>✍️</span> Paramètres du Reçu
            </h3>
            <button
              type="button"
              onClick={handleResetForm}
              className="secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
            >
              🔄 Nouveau Reçu
            </button>
          </div>

          <form onSubmit={handleSaveToLocalCarnet}>
            {/* Header info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                  N° Facture / Reçu :
                </label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                  Date d'émission :
                </label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Client info */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.5rem' }}>
                👤 Informations du Client / Destinataire
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <div>
                  <input
                    type="text"
                    placeholder="Nom du client / Entreprise *"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.84rem' }}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Téléphone client"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.84rem' }}
                  />
                </div>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Adresse / Ville de livraison"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            {/* Items table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                  📦 Articles Personnalisés (Quantités et Prix Libres)
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Ajouter un Produit
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {items.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.8fr 70px 105px 110px 32px',
                      gap: '0.45rem',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.55rem',
                    }}
                  >
                    <div>
                      <input
                        type="text"
                        placeholder="Désignation du produit (ex: 100 portes)"
                        value={it.description}
                        onChange={(e) => handleUpdateItem(it.id, 'description', e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', borderRadius: '5px', border: '1px solid var(--border)' }}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qté"
                        value={it.quantity}
                        onChange={(e) => handleUpdateItem(it.id, 'quantity', e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', borderRadius: '5px', border: '1px solid var(--border)' }}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Prix unit."
                        value={it.unitPrice}
                        onChange={(e) => handleUpdateItem(it.id, 'unitPrice', e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', borderRadius: '5px', border: '1px solid var(--border)' }}
                      />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#1e40af', textAlign: 'right' }}>
                      {formatMoney(it.total)}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                        title="Supprimer cette ligne"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Règlement & Remise */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                  Mode de règlement affiché :
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                >
                  <option value="Espèces">💵 Espèces (Comptant)</option>
                  <option value="Mobile Money (Orange/Wave/MTN)">📱 Mobile Money</option>
                  <option value="Virement Bancaire">🏦 Virement Bancaire</option>
                  <option value="Chèque">🧾 Chèque Bancaire</option>
                  <option value="À terme / Crédit">⏳ À terme</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                  Remise accordée (F CFA) :
                </label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                Mentions / Conditions imprimées sur le reçu :
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem' }}
              />
            </div>

            {/* Total Recap */}
            <div
              style={{
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>TOTAL FACTURE REVENDEUR</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
                  {formatMoney(totalGeneral)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setPrintFormat('A4')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: printFormat === 'A4' ? '#2563eb' : '#ffffff',
                    color: printFormat === 'A4' ? '#ffffff' : '#0f172a',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  📄 Format A4
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('THERMAL')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: printFormat === 'THERMAL' ? '#2563eb' : '#ffffff',
                    color: printFormat === 'THERMAL' ? '#ffffff' : '#0f172a',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  🧾 Ticket 80mm
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                className="secondary"
                style={{ flex: 1, padding: '0.75rem', fontWeight: 700, fontSize: '0.88rem' }}
              >
                💾 Sauvegarder dans Carnet Local
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="primary"
                style={{ flex: 1, padding: '0.75rem', fontWeight: 800, fontSize: '0.88rem', background: '#2563eb' }}
              >
                🖨️ Imprimer le Reçu
              </button>
            </div>
          </form>
        </div>

        {/* Colonne Droite : Aperçu Live & Historique Local */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Live Printable Receipt Preview */}
          <div
            style={{
              background: '#ffffff',
              border: '2px solid #cbd5e1',
              borderRadius: '12px',
              padding: printFormat === 'A4' ? '2rem' : '1.25rem',
              maxWidth: printFormat === 'A4' ? '100%' : '380px',
              margin: '0 auto',
              width: '100%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
              color: '#0f172a',
              fontFamily: printFormat === 'THERMAL' ? 'monospace' : 'inherit',
            }}
            ref={printAreaRef}
            className="printable-receipt-card"
          >
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 900, fontSize: printFormat === 'A4' ? '1.35rem' : '1.1rem', textTransform: 'uppercase' }}>
                {shopName}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                {shopAddress} • Tél: {shopPhone}
              </div>
              <div
                style={{
                  display: 'inline-block',
                  marginTop: '0.5rem',
                  padding: '2px 10px',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  borderRadius: '4px',
                  letterSpacing: '0.04em',
                }}
              >
                REÇU REVENDER / FACTURE PERSONNALISÉE
              </div>
            </div>

            {/* Meta infos */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '1rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.6rem' }}>
              <div>
                <div><strong>N° :</strong> {receiptNumber}</div>
                <div><strong>Date :</strong> {receiptDate}</div>
                <div><strong>Règlement :</strong> {paymentMethod}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><strong>Client :</strong> {clientName}</div>
                {clientPhone && <div><strong>Tél :</strong> {clientPhone}</div>}
                {clientAddress && <div><strong>Lieu :</strong> {clientAddress}</div>}
              </div>
            </div>

            {/* Items list */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #0f172a', textAlign: 'left' }}>
                  <th style={{ padding: '4px 0' }}>Désignation</th>
                  <th style={{ textAlign: 'center', padding: '4px 0' }}>Qté</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>P.U.</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 0', fontWeight: 600 }}>{it.description || 'Article personnalisé'}</td>
                    <td style={{ textAlign: 'center', padding: '6px 0' }}>{it.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0' }}>{formatMoney(it.unitPrice)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: 700 }}>{formatMoney(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ borderTop: '2px solid #0f172a', paddingTop: '0.6rem', textAlign: 'right', fontSize: '0.86rem' }}>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', marginBottom: '0.2rem' }}>
                  <span>Remise déduite :</span>
                  <span>- {formatMoney(discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.15rem' }}>
                <span>NET À PAYER :</span>
                <span>{formatMoney(totalGeneral)}</span>
              </div>
            </div>

            {/* Footer notes */}
            {notes && (
              <div style={{ marginTop: '1.25rem', fontSize: '0.74rem', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', textAlign: 'center' }}>
                {notes}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.7rem', color: '#94a3b8' }}>
              *** Document Revendeur Émis avec Succès ***
            </div>
          </div>

          {/* Historique Local des Reçus Revendeur */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                📁 Carnet Local des Reçus Revendeur ({savedReceipts.length})
              </div>
              <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                Bac à Sable Isolé
              </span>
            </div>

            {savedReceipts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Aucun reçu enregistré dans ce carnet. Remplissez le formulaire et cliquez sur "Sauvegarder dans Carnet Local".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {savedReceipts.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => handleLoadReceipt(r)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      background: selectedHistoryReceipt?.id === r.id ? '#eff6ff' : '#f8fafc',
                      border: selectedHistoryReceipt?.id === r.id ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                        #{r.receiptNumber} — {r.clientName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {r.date} • {r.items.length} article(s) • {r.paymentMethod}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e40af' }}>
                        {formatMoney(r.totalAmount)}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteHistoryReceipt(r.id, e)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

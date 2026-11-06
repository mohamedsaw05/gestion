import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastContext';
import { SUPPORTED_COUNTRIES, DEFAULT_COUNTRY, formatPhoneNumber, buildWhatsAppLink, type CountryDefinition } from '../lib/countryPhone.config';
import { INVOICE_TEMPLATES_10, RECEIPT_TEMPLATES_10 } from '../lib/templates.config';

interface PostSaleSuccessModalProps {
  saleId: string;
  grandTotal: string | number;
  currency: string;
  customer?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  lines: Array<{
    productName: string;
    quantity: number | string;
    price: number | string;
  }>;
  onClose: () => void;
  onNewSale: () => void;
}

export function PostSaleSuccessModal({
  saleId,
  grandTotal,
  currency,
  customer,
  lines,
  onClose,
  onNewSale,
}: PostSaleSuccessModalProps) {
  const { addToast } = useToast();
  const { profile } = useAuth();

  const [documentChoice, setDocumentChoice] = useState<'RECEIPT' | 'INVOICE' | 'BOTH'>('RECEIPT');
  const [selectedReceiptTemplate, setSelectedReceiptTemplate] = useState<string>(() => {
    return localStorage.getItem('vtm_default_receipt_template') || 'THERMAL_80MM_STANDARD';
  });
  const [selectedInvoiceTemplate, setSelectedInvoiceTemplate] = useState<string>(() => {
    return localStorage.getItem('vtm_default_invoice_template') || 'STANDARD_PRO';
  });

  const [selectedCountry, setSelectedCountry] = useState<CountryDefinition>(DEFAULT_COUNTRY);
  const [customerPhoneInput, setCustomerPhoneInput] = useState<string>(() => customer?.phone || '');

  // Message WhatsApp formaté pour le client
  const storeName = profile?.organizationName?.trim() || "Informations de l'entreprise à compléter";
  const formattedItems = lines
    .map((l) => `• ${l.productName} (x${l.quantity}) : ${Number(l.price).toLocaleString('fr-FR')} ${currency}`)
    .join('\n');

  const formattedTotal = `${Number(grandTotal).toLocaleString('fr-FR')} ${currency}`;

  const generatedWhatsAppMessage =
    `*${storeName.toUpperCase()} — REÇU DE VENTE*\n` +
    `Bonjour ${customer?.name || 'Cher client'},\n` +
    `Merci pour votre achat ce jour (${new Date().toLocaleDateString('fr-FR')}) !\n\n` +
    `*Détail de vos articles :*\n${formattedItems}\n\n` +
    `*Total Réglé : ${formattedTotal}*\n` +
    `Réf Vente : #${saleId.slice(0, 8).toUpperCase()}\n\n` +
    `Conservez ce message pour toute garantie ou échange sous 7 jours. À très bientôt !`;

  const handlePrint = (type: 'RECEIPT' | 'INVOICE' | 'BOTH') => {
    window.print();
    addToast(`Impression lancée pour : ${type === 'BOTH' ? 'Facture & Reçu' : type === 'INVOICE' ? 'Facture A4' : 'Reçu de Caisse'}`, 'info');
  };

  const handleSendWhatsApp = () => {
    if (!customerPhoneInput.trim()) {
      addToast('Veuillez renseigner le numéro WhatsApp du client.', 'warning');
      return;
    }
    const link = buildWhatsAppLink(customerPhoneInput, generatedWhatsAppMessage, selectedCountry);
    window.open(link, '_blank');
    addToast('Lien WhatsApp ouvert avec le reçu pré-rempli.', 'success');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '620px',
          padding: '2rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid #e2e8f0',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        {/* En-tête de validation de la vente */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#15803d',
              fontSize: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
            }}
          >
            ✓
          </div>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            Vente Validée avec Succès !
          </h2>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', margin: '0.2rem 0' }}>
            {formattedTotal}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Client : <strong>{customer?.name || 'Client comptoir (anonyme)'}</strong> • Réf : #{saleId.slice(0, 8).toUpperCase()}
          </div>
        </div>

        {/* Question Principale : Que souhaite le client ? (Facture, Reçu ou Les Deux) */}
        <div
          style={{
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', textAlign: 'center' }}>
            Que souhaite délivrer le client ?
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
            {/* Choix 1 : Reçu de caisse */}
            <button
              type="button"
              onClick={() => setDocumentChoice('RECEIPT')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.85rem 0.5rem',
                borderRadius: '12px',
                border: '2px solid',
                borderColor: documentChoice === 'RECEIPT' ? '#2563eb' : '#cbd5e1',
                background: documentChoice === 'RECEIPT' ? '#eff6ff' : '#ffffff',
                color: documentChoice === 'RECEIPT' ? '#1d4ed8' : '#334155',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>🧾</span>
              <span>1. Reçu de Caisse</span>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>Ticket thermique 58/80 mm</span>
            </button>

            {/* Choix 2 : Facture commerciale */}
            <button
              type="button"
              onClick={() => setDocumentChoice('INVOICE')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.85rem 0.5rem',
                borderRadius: '12px',
                border: '2px solid',
                borderColor: documentChoice === 'INVOICE' ? '#2563eb' : '#cbd5e1',
                background: documentChoice === 'INVOICE' ? '#eff6ff' : '#ffffff',
                color: documentChoice === 'INVOICE' ? '#1d4ed8' : '#334155',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>📑</span>
              <span>2. Facture Commerciale</span>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>Format A4 Officiel / B2B</span>
            </button>

            {/* Choix 3 : Les Deux (Reçu ET Facture) */}
            <button
              type="button"
              onClick={() => setDocumentChoice('BOTH')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.85rem 0.5rem',
                borderRadius: '12px',
                border: '2px solid',
                borderColor: documentChoice === 'BOTH' ? '#16a34a' : '#cbd5e1',
                background: documentChoice === 'BOTH' ? '#f0fdf4' : '#ffffff',
                color: documentChoice === 'BOTH' ? '#15803d' : '#334155',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>✨</span>
              <span>3. Les Deux</span>
              <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Reçu + Facture A4</span>
            </button>
          </div>
        </div>

        {/* Sélecteur de Thème du Document selon le choix */}
        <div style={{ display: 'grid', gridTemplateColumns: documentChoice === 'BOTH' ? '1fr 1fr' : '1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
          {(documentChoice === 'RECEIPT' || documentChoice === 'BOTH') && (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>
                Thème Reçu Thermique (10 Modèles) :
              </label>
              <select
                value={selectedReceiptTemplate}
                onChange={(e) => {
                  setSelectedReceiptTemplate(e.target.value);
                  localStorage.setItem('vtm_default_receipt_template', e.target.value);
                }}
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.84rem' }}
              >
                {RECEIPT_TEMPLATES_10.map((tmpl) => (
                  <option key={tmpl.key} value={tmpl.key}>
                    {tmpl.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(documentChoice === 'INVOICE' || documentChoice === 'BOTH') && (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>
                Thème Facture A4 (10 Modèles) :
              </label>
              <select
                value={selectedInvoiceTemplate}
                onChange={(e) => {
                  setSelectedInvoiceTemplate(e.target.value);
                  localStorage.setItem('vtm_default_invoice_template', e.target.value);
                }}
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.84rem' }}
              >
                {INVOICE_TEMPLATES_10.map((tmpl) => (
                  <option key={tmpl.key} value={tmpl.key}>
                    {tmpl.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section Envoi WhatsApp Direct avec Choix du Pays & Drapeaux (+226 Burkina par défaut) */}
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📱</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#166534' }}>
              Envoi Direct au Client sur WhatsApp :
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
            {/* Sélecteur de Pays avec Drapeau */}
            <select
              value={selectedCountry.code}
              onChange={(e) => {
                const found = SUPPORTED_COUNTRIES.find((c) => c.code === e.target.value);
                if (found) setSelectedCountry(found);
              }}
              style={{ padding: '0.5rem', fontSize: '0.84rem', fontWeight: 600, background: '#ffffff', margin: 0 }}
            >
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.dialCode})
                </option>
              ))}
            </select>

            {/* Numéro avec masque de formatage */}
            <input
              type="tel"
              placeholder={`Ex: ${selectedCountry.phonePlaceholder}`}
              value={customerPhoneInput}
              onChange={(e) => setCustomerPhoneInput(formatPhoneNumber(e.target.value, selectedCountry))}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem', margin: 0, fontWeight: 600 }}
            />

            {/* Bouton d'envoi WhatsApp */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              style={{
                background: '#25d366',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.35)',
              }}
            >
              <span>Envoyer</span>
              <span>➤</span>
            </button>
          </div>
        </div>

        {/* Boutons d'Action Principaux (Imprimer, Télécharger, Nouvelle Vente) */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handlePrint(documentChoice)}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.65rem 1.25rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              <span>🖨️</span>
              <span>
                Imprimer {documentChoice === 'BOTH' ? 'Facture & Reçu' : documentChoice === 'INVOICE' ? 'Facture A4' : 'Reçu Thermique'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={onNewSale}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '0.65rem 1.5rem',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
            }}
          >
            <span>+</span>
            <span>Nouvelle Vente</span>
          </button>
        </div>
      </div>
    </div>
  );
}

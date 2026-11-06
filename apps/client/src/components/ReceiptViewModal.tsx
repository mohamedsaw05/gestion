import { useEffect, useState } from 'react';
import { api, fetchBlob, ApiError } from '../lib/api';
import { useToast } from '../components/ToastContext';

interface DocumentLine {
  productNameSnapshot: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

interface DocumentPayment {
  method: string;
  amount: string;
}

interface DocumentContent {
  documentNumber: string;
  saleId?: string;
  createdAt: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  paymentStatus: string;
  currency: string;
  tenderedAmount?: string | null;
  changeGiven?: string | null;
  lines: DocumentLine[];
  payments?: DocumentPayment[];
  customer?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  } | null;
  // Branding & Company Identity
  logoDataUri?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  headerText?: string | null;
  footerText?: string | null;
}

interface DocumentDetails {
  id: string;
  type: string;
  number: string;
  createdAt: string;
  contentSnapshot: DocumentContent;
}

interface ReceiptViewModalProps {
  documentId: string;
  onClose: () => void;
}

export function ReceiptViewModal({ documentId, onClose }: ReceiptViewModalProps) {
  const { addToast } = useToast();
  const [doc, setDoc] = useState<DocumentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api
      .get<DocumentDetails>(`/documents/${documentId}`)
      .then((data) => {
        if (isMounted) setDoc(data);
      })
      .catch((err) => {
        if (isMounted) {
          addToast(err instanceof ApiError ? err.message : 'Impossible de charger le document', 'error');
          onClose();
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [documentId, addToast, onClose]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const blob = await fetchBlob(`/documents/${documentId}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc?.type || 'DOCUMENT'}_${doc?.number || documentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Téléchargement du PDF lancé', 'info');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de téléchargement PDF', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const content = doc?.contentSnapshot;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          borderRadius: 'var(--radius, 8px)',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid var(--border, #e2e8f0)',
        }}
      >
        {/* Header barre d'actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            background: 'var(--surface-muted, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🧾</span>
            <strong style={{ fontSize: '1rem', color: 'var(--text-main, #0f172a)' }}>
              {doc?.type === 'RECEIPT' ? 'Reçu de Caisse' : doc?.type === 'INVOICE' ? 'Facture' : 'Document'}{' '}
              {doc?.number ? `#${doc.number}` : ''}
            </strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
              title="Imprimer directement"
            >
              🖨️ Imprimer
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
              title="Télécharger le fichier PDF"
            >
              {downloading ? 'Génération...' : '⬇️ PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.4rem',
                cursor: 'pointer',
                color: 'var(--text-muted, #64748b)',
                padding: '0 0.25rem',
              }}
              title="Fermer"
            >
              ×
            </button>
          </div>
        </div>

        {/* Corps du document avec aperçu thermique / format professionnel */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            background: '#fafafa',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Chargement du reçu...
            </div>
          ) : !content ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)' }}>
              Document introuvable ou illisible.
            </div>
          ) : (
            <div
              id="printable-receipt"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '1.5rem',
                fontFamily: 'monospace, "Courier New", Courier, sans-serif',
                fontSize: '0.82rem',
                color: '#1e293b',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                margin: '0 auto',
                maxWidth: '420px',
              }}
            >
              {/* En-tête : Logo & Entreprise */}
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '1rem', marginBottom: '1rem' }}>
                {content.logoDataUri && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <img
                      src={content.logoDataUri}
                      alt="Logo Entreprise"
                      style={{ maxHeight: '55px', maxWidth: '180px', objectFit: 'contain' }}
                    />
                  </div>
                )}
                <div style={{ fontWeight: 800, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {content.legalName || 'VIRALTECH MARKET'}
                </div>
                {content.taxId && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>NIF / RCCM : {content.taxId}</div>}
                {content.address && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{content.address}</div>}
                {(content.phone || content.email) && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {[content.phone && `Tél: ${content.phone}`, content.email && `Email: ${content.email}`].filter(Boolean).join(' | ')}
                  </div>
                )}
                {content.headerText && (
                  <div style={{ fontSize: '0.72rem', fontStyle: 'italic', marginTop: '0.35rem', color: '#475569' }}>
                    {content.headerText}
                  </div>
                )}
              </div>

              {/* Métadonnées du reçu */}
              <div style={{ fontSize: '0.75rem', marginBottom: '1rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span>N° Reçu :</span>
                  <strong>{content.documentNumber}</strong>
                </div>
                {content.saleId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span>Vente :</span>
                    <span>#{content.saleId.slice(0, 8)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span>Date :</span>
                  <span>{new Date(content.createdAt).toLocaleString('fr-FR')}</span>
                </div>
                {content.customer && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', paddingTop: '0.3rem', borderTop: '1px dotted #e2e8f0' }}>
                    <span>Client :</span>
                    <strong>{content.customer.name}</strong>
                  </div>
                )}
              </div>

              {/* Tableau des articles */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr', fontWeight: 700, fontSize: '0.75rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.3rem', marginBottom: '0.4rem' }}>
                  <span>Article</span>
                  <span style={{ textAlign: 'center' }}>Qté</span>
                  <span style={{ textAlign: 'right' }}>P.U</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                </div>
                {content.lines.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1.2fr',
                      fontSize: '0.75rem',
                      padding: '0.25rem 0',
                      borderBottom: '1px dotted #f1f5f9',
                    }}
                  >
                    <span style={{ wordBreak: 'break-word', paddingRight: '0.25rem' }}>{line.productNameSnapshot}</span>
                    <span style={{ textAlign: 'center' }}>{line.quantity}</span>
                    <span style={{ textAlign: 'right' }}>{Number(line.unitPrice).toLocaleString('fr-FR')}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{Number(line.lineTotal).toLocaleString('fr-FR')}</span>
                  </div>
                ))}
              </div>

              {/* Récapitulatif Financier */}
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 800, margin: '0.35rem 0' }}>
                  <span>TOTAL :</span>
                  <span>
                    {Number(content.grandTotal).toLocaleString('fr-FR')} {content.currency}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '0.2rem' }}>
                  <span>Montant perçu :</span>
                  <span>
                    {Number(content.amountPaid).toLocaleString('fr-FR')} {content.currency}
                  </span>
                </div>
                {content.tenderedAmount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '0.2rem' }}>
                    <span>Montant remis :</span>
                    <span>
                      {Number(content.tenderedAmount).toLocaleString('fr-FR')} {content.currency}
                    </span>
                  </div>
                )}
                {content.changeGiven && Number(content.changeGiven) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.2rem' }}>
                    <span>Monnaie rendue :</span>
                    <span>
                      {Number(content.changeGiven).toLocaleString('fr-FR')} {content.currency}
                    </span>
                  </div>
                )}
                {Number(content.balanceDue) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: '#dc2626' }}>
                    <span>Reste à payer :</span>
                    <span>
                      {Number(content.balanceDue).toLocaleString('fr-FR')} {content.currency}
                    </span>
                  </div>
                )}
                {content.payments && content.payments.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.4rem' }}>
                    Modes de règlement : {content.payments.map((p) => `${p.method}: ${Number(p.amount).toLocaleString('fr-FR')}`).join(', ')}
                  </div>
                )}
              </div>

              {/* Pied de page & Message de courtoisie */}
              <div style={{ textAlign: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem', fontSize: '0.72rem', color: '#64748b' }}>
                <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>
                  {content.footerText || 'Merci pour votre confiance et à bientôt !'}
                </div>
                <div>Document généré par Gestionnaire SaaS</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';
import { DISCHARGE_TEMPLATES_5, type DischargeTemplate } from '../lib/discharges.config';
import { api } from '../lib/api';

interface CustomerOption {
  id: string;
  name: string;
  phone?: string | null;
}

export function DischargesPage() {
  const { addToast } = useToast();

  const [templates] = useState<DischargeTemplate[]>(DISCHARGE_TEMPLATES_5);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    return localStorage.getItem('vtm_default_discharge_template') || 'REPAIR_ATELIER';
  });

  // Formulaire d'édition des données de l'acte
  const [clientName, setClientName] = useState('M. Ouedraogo Moussa');
  const [clientPhone, setClientPhone] = useState('+226 70 12 34 56');
  const [companyName, setCompanyName] = useState('');
  const [itemDescription, setItemDescription] = useState('iPhone 13 Pro 128Go Bleu Sidéral');
  const [serialNumber, setSerialNumber] = useState('F17X8920PLQ1');
  const [amount, setAmount] = useState('45 000 FCFA');
  const [customNotes, setCustomNotes] = useState('Écran fissuré face avant, châssis rayé au coin supérieur droit.');

  // TEXTE LIBRE MODIFIABLE EN TEMPS RÉEL (Demandé par l'utilisateur)
  const [customText, setCustomText] = useState<string>('');
  const [customLegalTerms, setCustomLegalTerms] = useState<string>('');

  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Synchroniser le texte libre lors du changement de modèle
  useEffect(() => {
    setCustomText(activeTemplate.defaultText);
    setCustomLegalTerms(activeTemplate.legalTerms);
  }, [activeTemplate]);

  useEffect(() => {
    api.get<CustomerOption[]>('/customers')
      .then((data) => {
        if (data && data.length > 0) setCustomers(data);
      })
      .catch(() => {});

    // Charger le nom officiel de l'entreprise
    api.get<Record<string, unknown>>('/settings')
      .then((settings) => {
        const legalName = (settings['organization.legalName'] || settings['brand.legalName'] || settings['company.name']) as string;
        if (legalName) setCompanyName(legalName);
      })
      .catch(() => {});
  }, []);

  const handleSetDefault = (tId: string) => {
    localStorage.setItem('vtm_default_discharge_template', tId);
    setSelectedTemplateId(tId);
    addToast(`Le modèle « ${templates.find((t) => t.id === tId)?.title} » est désormais votre modèle par défaut.`, 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCustomerSelect = (custId: string) => {
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setClientName(found.name);
      if (found.phone) setClientPhone(found.phone);
    }
  };

  // Remplacement dynamique des variables dans le texte de la décharge
  const compiledBodyText = (customText || activeTemplate.defaultText)
    .replace(/\{\{clientName\}\}/g, clientName || '[Nom du client]')
    .replace(/\{\{companyName\}\}/g, companyName || '[Entreprise]')
    .replace(/\{\{itemDescription\}\}/g, itemDescription || '[Description du bien]')
    .replace(/\{\{serialNumber\}\}/g, serialNumber || '[N° Série / IMEI]')
    .replace(/\{\{amount\}\}/g, amount || '[Montant]');

  const activeClause = customLegalTerms || activeTemplate.legalTerms;

  const whatsappMessage = `*${activeTemplate.title.toUpperCase()}*\nÉtablie par : ${companyName}\nClient : ${clientName}\nBien / Objet : ${itemDescription}\nN° Série : ${serialNumber}\nDate : ${new Date().toLocaleDateString('fr-FR')}\n\n${compiledBodyText}\n\nClause légale : ${activeClause}`;

  return (
    <div style={{ padding: '1.75rem 2rem', background: '#f8fafc', minHeight: '100vh' }}>
      <PageHeader
        title="Gestionnaire des Décharges & Attestations Légales"
        subtitle="5 modèles uniques aux présentations visuelles distinctes. Modifiez le texte, personnalisez les clauses et imprimez vos documents conformes."
        badges={[
          { label: 'Exactement 5 Modèles Uniques', variant: 'primary' },
          { label: `Modèle Actuel : ${activeTemplate.badge}`, variant: 'info' },
          { label: 'Texte & Clauses Modifiables en Direct', variant: 'success' },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(500px, 1.45fr)', gap: '1.75rem', marginTop: '1.25rem' }}>
        {/* COLONNE GAUCHE : CHOIX DU MODÈLE (5) + ÉDITION DU TEXTE & DONNÉES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* SÉLECTEUR DES 5 MODÈLES UNIQUES */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                📑 Choisir parmi les 5 Modèles Uniques :
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                Chaque modèle a un design spécifique
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {templates.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplateId;
                const isDefault = localStorage.getItem('vtm_default_discharge_template') === tmpl.id;

                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplateId(tmpl.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      background: isSelected ? '#eff6ff' : '#f8fafc',
                      border: '2px solid',
                      borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.12)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem', flexShrink: 0, marginTop: '2px' }}>{tmpl.icon}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.92rem', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                            {tmpl.title}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              background: isSelected ? '#bfdbfe' : '#e2e8f0',
                              color: isSelected ? '#1e40af' : '#475569',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontWeight: 700,
                            }}
                          >
                            {tmpl.badge}
                          </span>
                          {isDefault && (
                            <span style={{ fontSize: '0.68rem', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                              PAR DÉFAUT
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                          {tmpl.tagline}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(tmpl.id);
                      }}
                      title="Définir comme modèle par défaut"
                      style={{
                        background: isDefault ? '#dcfce7' : '#ffffff',
                        border: `1px solid ${isDefault ? '#86efac' : '#cbd5e1'}`,
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: isDefault ? '#15803d' : '#475569',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {isDefault ? '★ Actif' : 'Défaut'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ZONE D'ÉDITION DIRECTE DU TEXTE DE LA DÉCHARGE (DEMANDE UTILISATEUR) */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem',
              border: '2px solid #3b82f6',
              boxShadow: '0 4px 15px -3px rgba(59, 130, 246, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>✍️</span>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#1e3a8a' }}>
                  Personnalisation directe du Texte de la Décharge
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomText(activeTemplate.defaultText);
                  setCustomLegalTerms(activeTemplate.legalTerms);
                  addToast('Texte et clause réinitialisés aux valeurs standards du modèle.', 'info');
                }}
                style={{
                  fontSize: '0.72rem',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                ↺ Réinitialiser au texte du modèle
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Corps du texte de la décharge (variables autorisées : {'{{clientName}}, {{companyName}}, {{itemDescription}}, {{serialNumber}}'}) :
              </label>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Clause légale / Mentions de décharge de responsabilité :
              </label>
              <textarea
                value={customLegalTerms}
                onChange={(e) => setCustomLegalTerms(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                  color: '#991b1b',
                  background: '#fef2f2',
                }}
              />
            </div>
          </div>

          {/* FORMULAIRE DE DONNÉES DU MATÉRIEL & DU CLIENT */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
              📋 Paramètres de Remplissage :
            </h3>

            {/* Sélection rapide du client */}
            {customers.length > 0 && (
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                  Sélectionner un client existant :
                </label>
                <select
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  defaultValue=""
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.84rem' }}
                >
                  <option value="">-- Choisir parmi les clients enregistrés --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                  Nom du Client / Bénéficiaire * :
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.84rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                  Téléphone du Client :
                </label>
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                Description détaillée du Matériel / Bien confié * :
              </label>
              <input
                type="text"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Ex : iPhone 13 Pro 128Go Bleu Sidéral"
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.84rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                  N° de Série / IMEI / Immatriculation :
                </label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Ex : F17X8920PLQ1"
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.84rem', fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                  Montant estimatif / Acompte :
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex : 45 000 FCFA"
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                État cosmétique & constat contradictoire à la réception :
              </label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.84rem' }}
              />
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : LES 5 PRÉSENTATIONS VISUELLES UNIQUES D'APERÇU & IMPRESSION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* BARRE D'ACTIONS D'IMPRESSION / EXPORT */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
              background: '#ffffff',
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                Rendu Réel du {activeTemplate.title}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Présentation visuelle exclusive selon le modèle choisi
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  background: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                }}
              >
                <span>🖨️</span>
                <span>Imprimer la Décharge (A4)</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem 1rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  background: '#16a34a',
                  color: '#ffffff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >
                <span>💬</span> WhatsApp
              </a>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              LES 5 PRÉSENTATIONS VISUELLES DISTINCTES SELON LE MODÈLE
             ═══════════════════════════════════════════════════════════════════════ */}
          
          {/* MODÈLE 1 : ATELIER TECHNIQUE & RISQUES SAV (TECHNICAL_BORDER) */}
          {activeTemplate.visualStyle === 'TECHNICAL_BORDER' && (
            <div
              className="printable-discharge"
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                border: '3px solid #1e293b',
                padding: '2.5rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                fontFamily: "'Segoe UI', Roboto, Helvetica, sans-serif",
                color: '#0f172a',
              }}
            >
              {/* Header technique avec grille */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', background: '#0f172a', color: '#ffffff', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase' }}>
                    ATELIER TECHNIQUE & DIAGNOSTIC SAV
                  </div>
                  <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase' }}>
                    {companyName}
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                    Fiche de Prise en Charge Matériel & Décharge Technique
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>N° DOSSIER SAV</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, fontFamily: 'monospace', color: '#2563eb' }}>
                    SAV-{new Date().getFullYear()}-{serialNumber.slice(-4) || '8920'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.2rem' }}>
                    Date : {new Date().toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>

              {/* Bloc client & matériel technique */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Client Propriétaire :</div>
                  <div style={{ fontWeight: 800, fontSize: '0.98rem' }}>{clientName}</div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>Tél : {clientPhone}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Appareil & Réf :</div>
                  <div style={{ fontWeight: 800, fontSize: '0.98rem' }}>{itemDescription}</div>
                  <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#0f172a' }}>IMEI / S/N : <strong>{serialNumber}</strong></div>
                </div>
              </div>

              {/* Checklist contradictoire atelier */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.85rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Constat Visuel & État Cosmétique Déclaré :
                </div>
                <div style={{ fontSize: '0.84rem', color: '#1e293b', fontStyle: 'italic', marginBottom: '0.6rem' }}>
                  « {customNotes} »
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.76rem', color: '#475569' }}>
                  <span>☑ Sauvegarde effectuée par le client</span>
                  <span>☑ Traces de choc / oxydation notées</span>
                  <span>☑ Acompte versé : {amount}</span>
                </div>
              </div>

              {/* Corps modifiable */}
              <div style={{ fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.25rem', color: '#1e293b' }}>
                {compiledBodyText}
              </div>

              {/* Clause d'exonération technique */}
              <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', padding: '0.85rem', fontSize: '0.78rem', color: '#991b1b', lineHeight: 1.45, marginBottom: '2rem' }}>
                <strong>CLAUSE TECHNIQUE LIMITATIVE :</strong> {activeClause}
              </div>

              {/* Double émargement */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', borderTop: '2px dashed #cbd5e1', paddingTop: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '2.5rem' }}>Signature du Client (Mention "Bon pour accord") :</div>
                  <div style={{ borderBottom: '1px solid #94a3b8', width: '80%' }}></div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '2.5rem' }}>Cachet Atelier & Signature Technicien :</div>
                  <div style={{ borderBottom: '1px solid #94a3b8', width: '80%' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* MODÈLE 2 : JURIDIQUE & RESPONSABILITÉ STRICTE (SOLEMN_DOUBLE_BORDER) */}
          {activeTemplate.visualStyle === 'SOLEMN_DOUBLE_BORDER' && (
            <div
              className="printable-discharge"
              style={{
                background: '#ffffff',
                border: '4px double #0f172a',
                padding: '2.5rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                fontFamily: "'Georgia', 'Times New Roman', serif",
                color: '#0f172a',
                position: 'relative',
              }}
            >
              {/* En-tête protocolaire */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1.25rem', marginBottom: '1.75rem' }}>
                <div style={{ fontSize: '0.82rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#475569', marginBottom: '0.35rem' }}>
                  RÉPUBLIQUE • ÉTABLISSEMENT COMMERCIAL OFFICIEL
                </div>
                <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  ACTE SOLENNEL DE DÉCHARGE TOTALE & RENONCIATION À RECOURS
                </h1>
                <div style={{ fontSize: '0.86rem', fontStyle: 'italic', marginTop: '0.35rem', color: '#334155' }}>
                  Établi sous l’autorité de la société {companyName}
                </div>
              </div>

              {/* Préambule légal */}
              <div style={{ fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.25rem', textAlign: 'justify' }}>
                {compiledBodyText}
              </div>

              {/* Articles juridiques numérotés */}
              <div style={{ border: '1px solid #0f172a', padding: '1rem', marginBottom: '1.5rem', background: '#fafafa' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  ARTICLE UNIQUE — EXTINCTION DES RECOURS ET LIBÉRATION DÉFINITIVE
                </div>
                <div style={{ fontSize: '0.84rem', lineHeight: 1.5, color: '#1e293b' }}>
                  {activeClause}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.75rem', fontSize: '0.84rem' }}>
                <div>Fait à : <strong>Siège social de l’Entreprise</strong></div>
                <div style={{ textAlign: 'right' }}>Le : <strong>{new Date().toLocaleDateString('fr-FR')}</strong></div>
              </div>

              {/* Cartouche solennel de signature */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', borderTop: '1px solid #0f172a', paddingTop: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3rem' }}>
                    Pour le Bénéficiaire (Signature précédée de la mention manuscrite « Lu et approuvé, bon pour décharge ») :
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Nom : {clientName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3rem' }}>
                    Pour l’Établissement (Sceau & Signature de la Direction) :
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{companyName}</div>
                </div>
              </div>
            </div>
          )}

          {/* MODÈLE 3 : ÉPURÉ & ÉMARGEMENT MODERNE (MODERN_CLEAN_CARD) */}
          {activeTemplate.visualStyle === 'MODERN_CLEAN_CARD' && (
            <div
              className="printable-discharge"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                borderTop: '6px solid #4f46e5',
                padding: '2.5rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                fontFamily: "'Inter', sans-serif",
                color: '#0f172a',
              }}
            >
              {/* Header moderne asymétrique */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca', padding: '3px 10px', borderRadius: '999px', fontWeight: 800 }}>
                    ÉMARGEMENT & RESTITUTION MODERNE
                  </span>
                  <h2 style={{ margin: '0.5rem 0 0.15rem', fontSize: '1.35rem', fontWeight: 800, color: '#1e1b4b' }}>
                    {companyName}
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Bordereau numérique de remise physique</div>
                </div>
                <div style={{ width: '56px', height: '56px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
                  📱
                </div>
              </div>

              {/* Cartes côte-à-côte Émetteur / Récepteur */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Partie Émettrice :</div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0f172a' }}>{companyName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Remise certifiée conforme</div>
                </div>
                <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase' }}>Partie Réceptrice :</div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#1e3a8a' }}>{clientName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#475569' }}>Tél : {clientPhone}</div>
                </div>
              </div>

              {/* Détails du matériel */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <strong style={{ fontSize: '0.92rem' }}>{itemDescription}</strong>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                    S/N : {serialNumber}
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.6 }}>
                  {compiledBodyText}
                </div>
              </div>

              {/* Clause moderne */}
              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '0.85rem', fontSize: '0.8rem', color: '#5b21b6', marginBottom: '2rem' }}>
                <strong>ENGAGEMENT :</strong> {activeClause}
              </div>

              {/* Emargement signature moderne */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '2.5rem' }}>Signature Émetteur :</div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Horodaté : {new Date().toLocaleDateString('fr-FR')}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '2.5rem' }}>Signature Récepteur :</div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Émargement physique sans réserve</div>
                </div>
              </div>
            </div>
          )}

          {/* MODÈLE 4 : BORDEREAU LOGISTIQUE & CONFORMITÉ (LOGISTICS_CHECKLIST) */}
          {activeTemplate.visualStyle === 'LOGISTICS_CHECKLIST' && (
            <div
              className="printable-discharge"
              style={{
                background: '#ffffff',
                border: '2px solid #059669',
                padding: '2.5rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                fontFamily: "'Segoe UI', Tahoma, sans-serif",
                color: '#0f172a',
              }}
            >
              {/* Header logistique */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #059669', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', background: '#059669', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                    LOGISTIQUE, TRANSPORT & LIVRAISON
                  </span>
                  <h2 style={{ margin: '0.35rem 0 0.15rem', fontSize: '1.35rem', fontWeight: 900 }}>
                    {companyName}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>Bordereau de Livraison & Décharge sans Réserve</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>BORDEREAU N°</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, fontFamily: 'monospace', color: '#059669' }}>
                    BL-{new Date().getFullYear()}-{serialNumber.slice(-4) || '1042'}
                  </div>
                </div>
              </div>

              {/* Grille de vérification logistique physique */}
              <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.65rem 1rem', fontWeight: 800, fontSize: '0.82rem', borderBottom: '1px solid #cbd5e1', textTransform: 'uppercase' }}>
                  Contrôle Contradictoire lors du Déchargement :
                </div>
                <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <div>☑ <strong>Emballages & Scellés :</strong> Intacts, conformes et sans ouverture non autorisée</div>
                  <div>☑ <strong>Absence d’avarie :</strong> Aucun choc, humidité ou détérioration physique apparente</div>
                  <div>☑ <strong>Quantité livrée :</strong> 100% conforme au bon de commande initial</div>
                </div>
              </div>

              <div style={{ fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                {compiledBodyText}
              </div>

              {/* Clause logistique */}
              <div style={{ background: '#ecfdf5', borderLeft: '4px solid #059669', padding: '0.85rem', fontSize: '0.8rem', color: '#065f46', marginBottom: '2rem' }}>
                <strong>STIPULATION DE TRANSPORT :</strong> {activeClause}
              </div>

              {/* Signatures logistiques */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', borderTop: '2px solid #e2e8f0', paddingTop: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '2.5rem' }}>Le Chauffeur / Transporteur :</div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Livraison effectuée avec succès</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '2.5rem' }}>Le Réceptionnaire (Client) :</div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Signature & Mention "Reçu sans réserve"</div>
                </div>
              </div>
            </div>
          )}

          {/* MODÈLE 5 : CERTIFICAT OFFICIEL AVEC SCEAU (OFFICIAL_SEAL_CERTIFICATE) */}
          {activeTemplate.visualStyle === 'OFFICIAL_SEAL_CERTIFICATE' && (
            <div
              className="printable-discharge"
              style={{
                background: '#ffffff',
                border: '3px solid #b45309',
                padding: '2.75rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                fontFamily: "'Georgia', serif",
                color: '#0f172a',
                position: 'relative',
              }}
            >
              {/* Sceau rond officiel décoratif */}
              <div
                style={{
                  position: 'absolute',
                  top: '2.5rem',
                  right: '2.5rem',
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  border: '3px dashed #b45309',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#b45309',
                  textAlign: 'center',
                  transform: 'rotate(-12deg)',
                  background: 'rgba(245, 158, 11, 0.05)',
                }}
              >
                <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em' }}>★ VTM ★</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 900 }}>CERTIFIÉ</div>
                <div style={{ fontSize: '0.55rem', fontWeight: 700 }}>OFFICIEL</div>
              </div>

              {/* Titre officiel du certificat */}
              <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid #d97706' }}>
                <div style={{ fontSize: '0.76rem', color: '#b45309', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.35rem' }}>
                  CERTIFICAT D’HONNEUR & ATTESTATION FORMELLE
                </div>
                <h1 style={{ margin: '0.35rem 0', fontSize: '1.6rem', fontWeight: 900, color: '#78350f', letterSpacing: '0.02em' }}>
                  {companyName}
                </h1>
                <div style={{ fontSize: '0.84rem', fontStyle: 'italic', color: '#64748b' }}>
                  Délivré en bonne et due forme sous le contrôle du registre officiel
                </div>
              </div>

              <div style={{ fontSize: '0.92rem', lineHeight: 1.8, marginBottom: '1.5rem', textAlign: 'justify', color: '#1e293b' }}>
                {compiledBodyText}
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem', fontSize: '0.84rem', color: '#92400e', marginBottom: '2.25rem', fontStyle: 'italic' }}>
                « {activeClause} »
              </div>

              {/* Signatures officielles & sceau */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', borderTop: '1px solid #fde68a', paddingTop: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#78350f', marginBottom: '3rem' }}>
                    Le Titulaire Bénéficiaire :
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>M./Mme {clientName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#78350f', marginBottom: '3rem' }}>
                    Pour l'Autorité Émettrice :
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>La Direction Générale</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

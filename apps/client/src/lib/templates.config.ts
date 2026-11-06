export interface TemplateModel {
  key: string;
  name: string;
  tagline: string;
  category: 'INVOICE' | 'RECEIPT';
  color: string;
  icon: string;
  format: 'A4' | 'A5' | 'THERMAL_80MM' | 'THERMAL_58MM';
  bestFor: string;
  printerType: 'LASER_INKJET_A4' | 'THERMAL_POS_80MM' | 'THERMAL_POS_58MM';
}

// ══════════════════════════════════════════════════════════════════════════════
// 3 MODÈLES DE FACTURES UNIQUES (Format A4 / A5 feuilles volantes pour imprimante Laser ou Jet d'encre)
// ══════════════════════════════════════════════════════════════════════════════
export const INVOICE_TEMPLATES_3: TemplateModel[] = [
  {
    key: 'STANDARD_CORPORATE',
    name: '1. Facture B2B Corporate & Classique',
    tagline: 'Structure officielle stricte — En-tête légal complet, IFU, RCCM, NIF, ventilation TVA et conditions de règlement',
    category: 'INVOICE',
    color: '#1e3a8a',
    icon: '🏢',
    format: 'A4',
    printerType: 'LASER_INKJET_A4',
    bestFor: 'Entreprises, grossistes, PME, administrations et transactions B2B formelles',
  },
  {
    key: 'MODERNE_PRESTIGE',
    name: '2. Facture Moderne & Prestige',
    tagline: 'Design asymétrique soigné — Accents violet royal & indigo, badges de statut nets et QR Code de vérification',
    category: 'INVOICE',
    color: '#6366f1',
    icon: '✨',
    format: 'A4',
    printerType: 'LASER_INKJET_A4',
    bestFor: 'Boutiques haut de gamme, agences de services, informatique et commerce moderne',
  },
  {
    key: 'ECO_MINIMALISTE',
    name: '3. Facture Éco-Minimaliste (A4 / A5)',
    tagline: 'Lignes épurées noir & blanc — Conçue pour consommer le minimum d’encre, adaptable en demi-page A5 ou A4',
    category: 'INVOICE',
    color: '#0f172a',
    icon: '🌱',
    format: 'A5',
    printerType: 'LASER_INKJET_A4',
    bestFor: 'Commerces de proximité, quincailleries, impressions économiques rapides',
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 3 MODÈLES DE REÇUS DE CAISSE UNIQUES (Rouleau continu pour Imprimante Thermique POS)
// ══════════════════════════════════════════════════════════════════════════════
export const RECEIPT_TEMPLATES_3: TemplateModel[] = [
  {
    key: 'THERMAL_80MM_STANDARD',
    name: '1. Reçu Thermique 80 mm Standard (Epson/Xprinter)',
    tagline: 'Flux thermique continu avec découpe automatique (cutter) — Logo centré, N° séquentiel, détail articles, rendu monnaie et remerciement',
    category: 'RECEIPT',
    color: '#2563eb',
    icon: '🧾',
    format: 'THERMAL_80MM',
    printerType: 'THERMAL_POS_80MM',
    bestFor: 'Imprimantes thermiques de comptoir 80 mm (Epson TM-T88, Xprinter, Star)',
  },
  {
    key: 'THERMAL_58MM_COMPACT',
    name: '2. Reçu Thermique 58 mm Compact & Mobile',
    tagline: 'Largeur étroite optimisée pour imprimantes mobiles Bluetooth et mini-terminaux — Police condensée sans coupure',
    category: 'RECEIPT',
    color: '#059669',
    icon: '📱',
    format: 'THERMAL_58MM',
    printerType: 'THERMAL_POS_58MM',
    bestFor: 'Imprimantes mobiles de poche 58 mm, livraison, vente nomade et caisses d’appoint',
  },
  {
    key: 'THERMAL_MODERN_SLIP',
    name: '3. Reçu Épuré avec QR Code & Mentions Légales',
    tagline: 'Mise en page aérée — QR code pour consultation en ligne, ventilation TVA/HT et pied de reçu personnalisable',
    category: 'RECEIPT',
    color: '#7c3aed',
    icon: '📲',
    format: 'THERMAL_80MM',
    printerType: 'THERMAL_POS_80MM',
    bestFor: 'Magasins connectés, garanties immédiates et fidélisation client',
  },
];

// Alias pour compatibilité
export const INVOICE_TEMPLATES_10 = INVOICE_TEMPLATES_3;
export const RECEIPT_TEMPLATES_10 = RECEIPT_TEMPLATES_3;

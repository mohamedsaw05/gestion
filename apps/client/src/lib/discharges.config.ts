export interface DischargeTemplate {
  id: string;
  number: number;
  title: string;
  category: 'ATELIER' | 'JURIDIQUE' | 'MODERNE' | 'LOGISTIQUE' | 'OFFICIEL';
  icon: string;
  tagline: string;
  badge: string;
  visualStyle: 'TECHNICAL_BORDER' | 'SOLEMN_DOUBLE_BORDER' | 'MODERN_CLEAN_CARD' | 'LOGISTICS_CHECKLIST' | 'OFFICIAL_SEAL_CERTIFICATE';
  defaultText: string;
  legalTerms: string;
  requiresClientSignature: boolean;
  requiresCompanySignature: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// 5 MODÈLES DE DÉCHARGES UNIQUES & PERSONNALISABLES
// ══════════════════════════════════════════════════════════════════════════════
export const DISCHARGE_TEMPLATES_5: DischargeTemplate[] = [
  {
    id: 'REPAIR_ATELIER',
    number: 1,
    title: '1. Modèle Atelier Technique & Risques SAV',
    category: 'ATELIER',
    icon: '🛠️',
    badge: 'Atelier & Réparation',
    visualStyle: 'TECHNICAL_BORDER',
    tagline: 'Encadré technique avec diagnostic, état cosmétique, IMEI/Série et clauses d’exonération pour pièces oxydées ou perte de données.',
    defaultText:
      'Je soussigné(e) {{clientName}}, propriétaire légitime de l’appareil {{itemDescription}} (N° Série / IMEI : {{serialNumber}}), confie ce matériel à l’établissement {{companyName}} pour diagnostic et remise en état technique. Je certifie avoir effectué la sauvegarde préalable de mes données personnelles.',
    legalTerms:
      'L’atelier décline formellement toute responsabilité en cas d’altération de circuits pré-endommagés par choc ou liquide, ou en cas d’effacement accidentel de données logicielles non sauvegardées.',
    requiresClientSignature: true,
    requiresCompanySignature: true,
  },
  {
    id: 'LEGAL_LIABILITY',
    number: 2,
    title: '2. Modèle Juridique & Responsabilité Stricte',
    category: 'JURIDIQUE',
    icon: '⚖️',
    badge: 'Juridique Solennel',
    visualStyle: 'SOLEMN_DOUBLE_BORDER',
    tagline: 'Présentation protocolaire avec double bordure solennelle, renonciation formelle à recours et décharge totale de responsabilité.',
    defaultText:
      'Par la présente, {{clientName}} atteste avoir réceptionné ce jour de la part de {{companyName}} l’ensemble des biens, fonds ou appareils désignés sous la référence : {{itemDescription}} (Réf : {{serialNumber}}).',
    legalTerms:
      'Le signataire libère irrévocablement et définitivement l’entreprise de toute obligation de garde, réclamation financière ou recours ultérieur afférent à la détention ou à la restitution desdits biens.',
    requiresClientSignature: true,
    requiresCompanySignature: true,
  },
  {
    id: 'MODERN_HANDOVER',
    number: 3,
    title: '3. Modèle Épuré & Émargement Moderne',
    category: 'MODERNE',
    icon: '📱',
    badge: 'Contemporain Épuré',
    visualStyle: 'MODERN_CLEAN_CARD',
    tagline: 'Mise en page asymétrique contemporaine, cartes d’émargement distinctes pour l’employé/client et signatures électroniques côte-à-côte.',
    defaultText:
      'Bordereau d’émargement constatant la remise physique du matériel professionnel {{itemDescription}} (Numéro d’inventaire : {{serialNumber}}) entre {{companyName}} et {{clientName}}.',
    legalTerms:
      'L’attributaire s’engage à un usage loyal et soigneux, et s’engage à restituer le bien dans son état d’origine sur simple notification.',
    requiresClientSignature: true,
    requiresCompanySignature: true,
  },
  {
    id: 'LOGISTICS_CONFORMITY',
    number: 4,
    title: '4. Modèle Bordereau Logistique & Conformité',
    category: 'LOGISTIQUE',
    icon: '📦',
    badge: 'Logistique & Transport',
    visualStyle: 'LOGISTICS_CHECKLIST',
    tagline: 'Grille d’inspection physique avec cases à cocher de vérification des emballages, état sans avarie et conformité quantitative.',
    defaultText:
      'Le destinataire {{clientName}} confirme la prise en charge sans réserve des colis et articles suivants : {{itemDescription}} livrés par {{companyName}} ce jour.',
    legalTerms:
      'La signature sans mention expresse de réserve manuscrite éteint toute réclamation pour avarie apparente ou manquant survenue lors du transport.',
    requiresClientSignature: true,
    requiresCompanySignature: false,
  },
  {
    id: 'CERTIFICATE_SEAL',
    number: 5,
    title: '5. Modèle Certificat Officiel avec Sceau',
    category: 'OFFICIEL',
    icon: '🎖️',
    badge: 'Certificat & Sceau',
    visualStyle: 'OFFICIAL_SEAL_CERTIFICATE',
    tagline: 'Disposition certificat d’honneur avec filigrane, cartouche de certification, numéro d’enregistrement séquentiel et sceau d’authenticité.',
    defaultText:
      'Certificat officiel délivré par {{companyName}} attestant en bonne et due forme de la conformité, de l’authenticité et de la cession du bien : {{itemDescription}} à M./Mme {{clientName}}.',
    legalTerms:
      'Fait pour servir et valoir ce que de droit, scellé et authentifié par les registres de l’entreprise sous le numéro de contrôle officiel.',
    requiresClientSignature: true,
    requiresCompanySignature: true,
  },
];

// Alias pour compatibilité
export const DISCHARGE_TEMPLATES_15 = DISCHARGE_TEMPLATES_5;

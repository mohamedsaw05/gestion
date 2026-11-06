import os

HELP_PAGE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "client", "src", "pages", "HelpCenterPage.tsx"))

with open(HELP_PAGE_PATH, "r", encoding="utf-8") as f:
    original_code = f.read()

# We preserve everything up to EXTENSIVE_GUIDES definition end
cutoff_marker = "export function HelpCenterPage() {"
if cutoff_marker not in original_code:
    print("Marker not found!")
    exit(1)

guides_part = original_code.split(cutoff_marker)[0]

new_code = guides_part + '''
export interface TutorialVideo {
  id: string;
  episode: number;
  titleFr: string;
  titleEn: string;
  secTitleFr: string;
  secTitleEn: string;
  duration: string;
  categoryFr: string;
  categoryEn: string;
  badge: string;
  summaryFr: string;
  summaryEn: string;
  mp4: string;
  vtt: string;
  thumb: string;
  txt: string;
  keyPointsFr: string[];
  keyPointsEn: string[];
  transcriptionFr: string[];
}

export const VTM_TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    id: 'VTM_01_Presentation_Generale_FR',
    episode: 1,
    titleFr: '1. VTM — Présentation Générale de la Plateforme',
    titleEn: '1. VTM — General Platform Overview',
    secTitleFr: 'Gestion commerciale SaaS tout-en-un pour entreprises et réseaux de boutiques',
    secTitleEn: 'All-in-one SaaS retail platform for multi-store networks',
    duration: '36s',
    categoryFr: 'Présentation',
    categoryEn: 'Overview',
    badge: 'Épisode 1 • Présentation (36s)',
    summaryFr: 'Découvrez la solution SaaS tout-en-un VTM : pilotage multi-boutiques, isolation étanche des données, caisse tactile et rentabilité réelle.',
    summaryEn: 'Discover VTM all-in-one SaaS: multi-store control, isolated data security, tactile checkout and real profitability.',
    mp4: '/videos/VTM_01_Presentation_Generale_FR.mp4',
    vtt: '/videos/VTM_01_Presentation_Generale_FR.vtt',
    thumb: '/videos/VTM_01_Presentation_Generale_FR_thumb.jpg',
    txt: '/videos/VTM_01_Presentation_Generale_FR_transcription.txt',
    keyPointsFr: [
      'Architecture multi-tenant avec isolation stricte des données (RLS PostgreSQL)',
      'Tableau de bord de rentabilité globale et marge brute temps réel',
      'Caisse tactile POS ultra-rapide avec tickets thermiques et formats A4/A5',
      'Module d\\'atelier et prestations pour réparations sans bloquer le stock',
    ],
    keyPointsEn: [
      'Multi-tenant architecture with strict data isolation (PostgreSQL RLS)',
      'Real-time gross margin and business profitability dashboard',
      'Ultra-fast POS checkout with thermal receipts and A4/A5 formats',
      'Workshop and service ticketing without blocking inventory',
    ],
    transcriptionFr: [
      '[00:00:00.000] Bienvenue chez VTM, ViralTech Market ! Découvrez le Gestionnaire Universel de Commerce, la solution SaaS tout-en-un pour piloter votre entreprise.',
      '[00:00:09.500] Depuis votre tableau de bord, gérez vos ventes, vos stocks multi-boutiques et vos collaborateurs avec une isolation totale des données.',
      '[00:00:18.200] Profitez de la caisse tactile rapide, de la rentabilité exacte par produit et d\\'un atelier complet pour vos prestations de services.',
      '[00:00:27.400] Dans la prochaine vidéo, découvrez comment configurer votre espace de travail, vos coordonnées et votre logo officiel.',
    ],
  },
  {
    id: 'VTM_02_Configurer_Son_Espace_FR',
    episode: 2,
    titleFr: '2. Configurer son Espace de Travail',
    titleEn: '2. Workspaces & Store Setup',
    secTitleFr: 'Raison sociale, devise, logo officiel et création des boutiques',
    secTitleEn: 'Legal name, currency, official logo and retail locations',
    duration: '35s',
    categoryFr: 'Configuration',
    categoryEn: 'Setup',
    badge: 'Épisode 2 • Configuration (35s)',
    summaryFr: 'Renseignez le nom de votre magasin, choisissez votre devise principale (XOF, EUR, USD), importez votre logo et créez vos points de vente et dépôts.',
    summaryEn: 'Enter business name, select main currency (XOF, EUR, USD), upload official logo and create stores and warehouses.',
    mp4: '/videos/VTM_02_Configurer_Son_Espace_FR.mp4',
    vtt: '/videos/VTM_02_Configurer_Son_Espace_FR.vtt',
    thumb: '/videos/VTM_02_Configurer_Son_Espace_FR_thumb.jpg',
    txt: '/videos/VTM_02_Configurer_Son_Espace_FR_transcription.txt',
    keyPointsFr: [
      'Personnalisation du nom commercial et des mentions légales',
      'Choix de la devise officielle (ex : XOF Franc CFA BCEAO)',
      'Téléversement du logo imprimé sur les tickets thermiques et factures',
      'Création des emplacements physiques (boutiques de vente et entrepôts)',
    ],
    keyPointsEn: [
      'Business trade name and legal imprint customization',
      'Official currency selection (e.g. XOF CFA Franc BCEAO)',
      'Logo upload for automatic thermal ticket and invoice printing',
      'Physical location management (retail shops and storage warehouses)',
    ],
    transcriptionFr: [
      '[00:00:00.000] Tutoriel VTM : Configurer votre espace. Rendez-vous dans le menu Paramètres situé dans la barre latérale gauche.',
      '[00:00:08.500] Renseignez la raison sociale de votre entreprise, vos coordonnées de contact et sélectionnez votre devise principale, comme le Franc CFA.',
      '[00:00:17.300] Importez votre logo officiel au format PNG ou JPEG : il figurera automatiquement sur tous vos tickets de caisse et factures.',
      '[00:00:26.100] Créez vos boutiques de vente et vos entrepôts de stockage. Épisode suivant : la recherche d\\'articles et la consultation des stocks !',
    ],
  },
  {
    id: 'VTM_03_Rechercher_Produit_Stock_FR',
    episode: 3,
    titleFr: '3. Rechercher un Produit & Consulter les Stocks',
    titleEn: '3. Instant Product Lookup & Live Stock',
    secTitleFr: 'Raccourci instantané Ctrl + K, scanners codes-barres et stock réel',
    secTitleEn: 'Ctrl + K shortcut, barcode scanners and live inventory',
    duration: '36s',
    categoryFr: 'Articles',
    categoryEn: 'Products',
    badge: 'Épisode 3 • Articles (36s)',
    summaryFr: 'Recherche instantanée en moins de 50ms, prise en charge de toutes les douchettes codes-barres USB et consultation du stock disponible en direct.',
    summaryEn: 'Instant product search in under 50ms, plug-and-play USB barcode scanners and live real-time stock levels.',
    mp4: '/videos/VTM_03_Rechercher_Produit_Stock_FR.mp4',
    vtt: '/videos/VTM_03_Rechercher_Produit_Stock_FR.vtt',
    thumb: '/videos/VTM_03_Rechercher_Produit_Stock_FR_thumb.jpg',
    txt: '/videos/VTM_03_Rechercher_Produit_Stock_FR_transcription.txt',
    keyPointsFr: [
      'Raccourci universel Ctrl + K disponible depuis n\\'importe quel écran',
      'Prise en charge native des lecteurs et douchettes codes-barres USB',
      'Affichage instantané des quantités disponibles en magasin et en dépôt',
      'Signalement visuel des alertes de rupture pour protéger la rentabilité',
    ],
    keyPointsEn: [
      'Universal Ctrl + K keyboard shortcut on any page',
      'Native plug-and-play USB barcode scanner compatibility',
      'Live stock count displayed for both store shelves and back warehouse',
      'Visual low stock indicators to prevent stockouts',
    ],
    transcriptionFr: [
      '[00:00:00.000] Tutoriel VTM : Recherche d\\'articles et consultation des stocks. Trouvez n\\'importe quelle référence en moins de cinquante millisecondes.',
      '[00:00:09.100] Utilisez le raccourci universel Contrôle plus K ou scannez directement le code-barres avec votre douchette USB.',
      '[00:00:17.800] Le sélecteur contextuel affiche immédiatement la fiche produit complète, le stock disponible en temps réel et le prix unitaire.',
      '[00:00:26.700] Les ruptures de stock sont signalées par une alerte visuelle protectrice. Épisode suivant : le passage en caisse et les encaissements !',
    ],
  },
  {
    id: 'VTM_04_Point_De_Vente_Et_Encaissement_FR',
    episode: 4,
    titleFr: '4. Point de Vente POS & Encaissement Rapide',
    titleEn: '4. Fast POS Checkout & Receipt Printing',
    secTitleFr: 'Panier tactile, Mobile Money (Wave, Orange Money), Espèces et Reçu',
    secTitleEn: 'Touch cart, Mobile Money (Wave, Orange Money), Cash and Receipts',
    duration: '35s',
    categoryFr: 'Caisse',
    categoryEn: 'Checkout',
    badge: 'Épisode 4 • Caisse (35s)',
    summaryFr: 'Enregistrez une vente en moins de 30 secondes, encaissez par Espèces ou Mobile Money, et imprimez automatiquement le ticket de caisse certifié.',
    summaryEn: 'Process customer sales in under 30 seconds, accept Cash or Mobile Money, and automatically print verified receipts.',
    mp4: '/videos/VTM_04_Point_De_Vente_Et_Encaissement_FR.mp4',
    vtt: '/videos/VTM_04_Point_De_Vente_Et_Encaissement_FR.vtt',
    thumb: '/videos/VTM_04_Point_De_Vente_Et_Encaissement_FR_thumb.jpg',
    txt: '/videos/VTM_04_Point_De_Vente_Et_Encaissement_FR_transcription.txt',
    keyPointsFr: [
      'Passage en caisse rapide en moins de 30 secondes sans attente',
      'Multi-moyens de paiement : Espèces, Mobile Money (Wave, Orange), Carte, Crédit',
      'Garde-fou anti-survente empêchant les erreurs d\\'inventaire',
      'Génération instantanée du ticket de caisse certifié',
    ],
    keyPointsEn: [
      'Rapid counter checkout under 30 seconds without wait times',
      'Multi-payment: Cash, Mobile Money (Wave, Orange), Card, Customer Credit',
      'Oversell safeguard preventing negative inventory errors',
      'Instant verified thermal receipt printing',
    ],
    transcriptionFr: [
      '[00:00:00.000] Tutoriel VTM : Caisse et Encaissement. Réalisez des ventes fluides au comptoir en moins de trente secondes par client.',
      '[00:00:08.400] Ajoutez les articles au panier d\\'un simple clic ou scan. Choisissez le moyen de paiement : Espèces, Mobile Money, Carte ou Crédit client.',
      '[00:00:17.200] Le système contrôle les quantités disponibles et empêche les ventes en rupture non autorisées.',
      '[00:00:25.800] Validez la transaction : le reçu certifié s\\'affiche instantanément pour impression. Épisode suivant : la gestion des prestations et ateliers !',
    ],
  },
  {
    id: 'VTM_05_Prestations_Et_Atelier_FR',
    episode: 5,
    titleFr: '5. Prestations de Services & Atelier de Réparation',
    titleEn: '5. Services, Maintenance & Repair Workshop',
    secTitleFr: 'Dossiers de réparation, pièces sorties du stock et facturation directe',
    secTitleEn: 'Service work orders, spare parts deduction and billing',
    duration: '35s',
    categoryFr: 'Atelier',
    categoryEn: 'Workshop',
    badge: 'Épisode 5 • Atelier (35s)',
    summaryFr: 'Gérez vos réparations et SAV sans bloquer vos prestations : assignez un technicien, sortez automatiquement les pièces détachées du stock et facturez le dossier.',
    summaryEn: 'Manage repairs and service tickets smoothly: assign technicians, automatically consume spare parts from stock, and invoice in one click.',
    mp4: '/videos/VTM_05_Prestations_Et_Atelier_FR.mp4',
    vtt: '/videos/VTM_05_Prestations_Et_Atelier_FR.vtt',
    thumb: '/videos/VTM_05_Prestations_Et_Atelier_FR_thumb.jpg',
    txt: '/videos/VTM_05_Prestations_Et_Atelier_FR_transcription.txt',
    keyPointsFr: [
      'Création et suivi des dossiers de réparation avec diagnostic précis',
      'Affectation nominative du technicien ou artisan responsable',
      'Décrémentation physique automatique des pièces de rechange du dépôt',
      'Facturation directe regroupant main-d\\'œuvre et pièces utilisées',
    ],
    keyPointsEn: [
      'Creation and tracking of repair orders with clear diagnostic notes',
      'Technician assignment and labor tracking',
      'Automatic spare parts stock consumption from depot',
      'Consolidated final invoicing with labor and parts breakdown',
    ],
    transcriptionFr: [
      '[00:00:00.000] Tutoriel VTM : Prestations et Services d\\'Atelier. Gérez vos réparations et interventions sans bloquer vos services par un stock inexistant.',
      '[00:00:09.100] Créez un dossier client, indiquez le diagnostic et affectez un technicien. Ajoutez les heures de main-d\\'œuvre et les pièces nécessaires.',
      '[00:00:18.000] Les pièces détachées consommées sont automatiquement décrémentées du stock physique et valorisées à leur coût d\\'achat exact.',
      '[00:00:26.800] Une fois l\\'intervention achevée, facturez le dossier en un clic. Épisode suivant : le suivi des dépenses d\\'exploitation !',
    ],
  },
  {
    id: 'VTM_06_Depenses_Et_Tresorerie_FR',
    episode: 6,
    titleFr: '6. Dépenses d\\'Exploitation & Trésorerie',
    titleEn: '6. Operational Expenses & Cash Management',
    secTitleFr: 'Charges courantes, justificatifs, réconciliation caisse et validation gérant',
    secTitleEn: 'Operating costs, attachments, cash reconciliation and manager approval',
    duration: '35s',
    categoryFr: 'Comptabilité',
    categoryEn: 'Expenses',
    badge: 'Épisode 6 • Dépenses (35s)',
    summaryFr: 'Maîtrisez les dépenses de votre boutique : enregistrez loyers et factures, joignez le justificatif, réconciliez les espèces et appliquez le circuit d\\'approbation.',
    summaryEn: 'Track store operating expenses: log rent and bills, attach invoices, reconcile cash registers and apply approval workflows.',
    mp4: '/videos/VTM_06_Depenses_Et_Tresorerie_FR.mp4',
    vtt: '/videos/VTM_06_Depenses_Et_Tresorerie_FR.vtt',
    thumb: '/videos/VTM_06_Depenses_Et_Tresorerie_FR_thumb.jpg',
    txt: '/videos/VTM_06_Depenses_Et_Tresorerie_FR_transcription.txt',
    keyPointsFr: [
      'Classification comptable des dépenses (loyer, salaires, fournitures)',
      'Attachement numérique obligatoire du reçu ou de la facture justificative',
      'Réconciliation en temps réel avec le tiroir-caisse espèces',
      'Circuit de validation hiérarchique au-delà de 500 000 FCFA',
    ],
    keyPointsEn: [
      'Expense categories (rent, wages, transport, utilities)',
      'Digital receipt and proof attachment',
      'Instant reconciliation against physical cash drawer',
      'Managerial approval threshold above 500,000 FCFA',
    ],
    transcriptionFr: [
      '[00:00:00.000] Tutoriel VTM : Dépenses et Trésorerie. Maîtrisez les charges opérationnelles de votre commerce avec précision.',
      '[00:00:08.500] Enregistrez loyers, factures et salaires en attachant le justificatif. Les dépenses en espèces se réconcilient immédiatement avec la caisse.',
      '[00:00:17.300] Au-delà de cinq cent mille Francs CFA, un circuit d\\'approbation gérant se déclenche pour sécuriser vos décaissements.',
      '[00:00:26.100] Consultez vos rapports de charges par catégorie. Prochain épisode : la traçabilité des mouvements de stock !',
    ],
  },
  {
    id: 'VTM_07_Stocks_Et_Mouvements_FR',
    episode: 7,
    titleFr: '7. Traçabilité des Stocks & Transferts Inter-Dépôts',
    titleEn: '7. Stock Movements & Inter-Depot Transfers',
    secTitleFr: 'Journal append-only, alertes de rupture, réapprovisionnements et transferts',
    secTitleEn: 'Append-only ledger, threshold alerts, restocking and transfers',
    duration: '35s',
    categoryFr: 'Stocks',
    categoryEn: 'Inventory',
    badge: 'Épisode 7 • Stocks (35s)',
    summaryFr: 'Traçabilité absolue de chaque entrée, sortie ou transfert : journal immuable, gestion des transferts en transit et valorisation au coût moyen pondéré.',
    summaryEn: 'Complete traceability for every inventory movement: append-only ledger, in-transit transfer tracking and weighted average cost.',
    mp4: '/videos/VTM_07_Stocks_Et_Mouvements_FR.mp4',
    vtt: '/videos/VTM_07_Stocks_Et_Mouvements_FR.vtt',
    thumb: '/videos/VTM_07_Stocks_Et_Mouvements_FR_thumb.jpg',
    txt: '/videos/VTM_07_Stocks_Et_Mouvements_FR_transcription.txt',
    keyPointsFr: [
      'Journal d\\'audit immuable (append-only) infalsifiable',
      'Alertes préventives anti-rupture avec seuils de commande automatiques',
      'Bordereaux de transfert formalisés avec statut « en transit »',
      'Valorisation de l\\'inventaire au Coût Moyen Unitaire Pondéré (CMUP)',
    ],
    keyPointsEn: [
      'Immutable append-only audit trail for all stock transactions',
      'Proactive low-stock alarms with automatic reorder triggers',
      'Formal transfer waybills with in-transit status tracking',
      'Accurate inventory valuation using Weighted Average Unit Cost',
    ],
    transcriptionFr: [
      '[00:00:00.000] Tutoriel VTM : Gestion des Stocks et Mouvements. Assurez la traçabilité intégrale de vos marchandises entre vos dépôts.',
      '[00:00:08.600] Chaque entrée, vente ou ajustement est inscrit dans un journal immuable. Les alertes automatiques préviennent toute rupture.',
      '[00:00:17.400] Transférez facilement des marchandises d\\'un entrepôt vers une boutique avec suivi rigoureux des quantités en transit.',
      '[00:00:26.200] Valorisez votre inventaire au coût moyen pondéré. Prochain épisode : les créances clients et le recouvrement !',
    ],
  },
  {
    id: 'VTM_08_Credits_Et_Recouvrement_FR',
    episode: 8,
    titleFr: '8. Crédits Clients & Recouvrement Conforme',
    titleEn: '8. Customer Credit & Compliant Recovery',
    secTitleFr: 'Plafonds de dette, balance âgée, relevé PDF et politique stricte WhatsApp Meta',
    secTitleEn: 'Credit caps, aging balance, PDF statements and strict WhatsApp Meta policy',
    duration: '36s',
    categoryFr: 'Crédit',
    categoryEn: 'Credit',
    badge: 'Épisode 8 • Crédit (36s)',
    summaryFr: 'Pilotez les crédits accordés à vos clients : respect des plafonds de dette, balance âgée des impayés, téléchargement du relevé officiel PDF et conformité WhatsApp Meta.',
    summaryEn: 'Manage customer credit safely: strict debt limits, aging balances, downloadable certified PDF statements and WhatsApp Meta compliance.',
    mp4: '/videos/VTM_08_Credits_Et_Recouvrement_FR.mp4',
    vtt: '/videos/VTM_08_Credits_Et_Recouvrement_FR.vtt',
    thumb: '/videos/VTM_08_Credits_Et_Recouvrement_FR_thumb.jpg',
    txt: '/videos/VTM_08_Credits_Et_Recouvrement_FR_transcription.txt',
    keyPointsFr: [
      'Plafonds de crédit paramétrables individuellement par client',
      'Balance âgée pour identifier les créances échues à 30, 60 et 90 jours',
      'Génération du relevé de compte officiel en PDF pour remise au client',
      'Règle stricte Meta : relances d\\'impayés formellement interdites sur WhatsApp, autorisées par SMS et Email',
    ],
    keyPointsEn: [
      'Configurable individual credit limits per customer account',
      'Aging balance reports identifying dues at 30, 60 and 90 days',
      'Official printable PDF account statements for customer delivery',
      'Strict Meta policy: debt collection notices prohibited on WhatsApp, authorized via SMS and Email',
    ],
    transcriptionFr: [
      '[00:00:00.000] Tutoriel VTM : Crédit Client et Recouvrement Conforme. Suivez vos créances avec rigueur tout en respectant les plafonds autorisés.',
      '[00:00:08.700] Consultez la balance âgée de chaque client, enregistrez les règlements partiels et téléchargez le relevé de compte officiel en PDF.',
      '[00:00:17.500] Pour vos relances, privilégiez l\\'Email ou le SMS. Rappel strict : les relances d\\'impayés sont formellement bloquées sur WhatsApp selon la politique Meta.',
      '[00:00:26.800] Félicitations ! Vous maîtrisez désormais les fonctionnalités fondamentales du Gestionnaire SaaS VTM — ViralTech Market.',
    ],
  },
];

export function HelpCenterPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [activeTab, setActiveTab] = useState<'videos' | 'guides'>('videos');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('VTM_01_Presentation_Generale_FR');
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>('setup-store');

  const selectedVideo = useMemo(() => {
    return VTM_TUTORIAL_VIDEOS.find((v) => v.id === selectedVideoId) || VTM_TUTORIAL_VIDEOS[0];
  }, [selectedVideoId]);

  const nextVideo = useMemo(() => {
    const curIdx = VTM_TUTORIAL_VIDEOS.findIndex((v) => v.id === selectedVideo.id);
    if (curIdx >= 0 && curIdx < VTM_TUTORIAL_VIDEOS.length - 1) {
      return VTM_TUTORIAL_VIDEOS[curIdx + 1];
    }
    return VTM_TUTORIAL_VIDEOS[0];
  }, [selectedVideo]);

  const filteredGuides = useMemo(() => {
    return EXTENSIVE_GUIDES.filter((g) => {
      const matchesCat =
        selectedCategory === 'ALL' ||
        (lang === 'fr' ? g.categoryFr === selectedCategory : g.categoryEn === selectedCategory);

      const q = search.toLowerCase().trim();
      const title = lang === 'fr' ? g.titleFr : g.titleEn;
      const summary = lang === 'fr' ? g.summaryFr : g.summaryEn;
      const goal = lang === 'fr' ? g.goalFr : g.goalEn;
      const example = lang === 'fr' ? g.exampleFr : g.exampleEn;

      const matchesSearch =
        !q ||
        title.toLowerCase().includes(q) ||
        summary.toLowerCase().includes(q) ||
        goal.toLowerCase().includes(q) ||
        example.toLowerCase().includes(q);

      return matchesCat && matchesSearch;
    });
  }, [lang, search, selectedCategory]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const g of EXTENSIVE_GUIDES) {
      set.add(lang === 'fr' ? g.categoryFr : g.categoryEn);
    }
    return Array.from(set);
  }, [lang]);

  return (
    <div className="page-container" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '4rem' }}>
      <PageHeader
        title={lang === 'fr' ? '🎥 Centre d’Aide & Vidéos VTM' : '🎥 Help Center & VTM Videos'}
        subtitle={
          lang === 'fr'
            ? 'VTM — ViralTech Market : Tutoriels vidéo professionnels Full HD et guides pratiques concrets'
            : 'VTM — ViralTech Market: Professional Full HD video tutorials and practical operational guides'
        }
        secondaryActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ffffff', padding: '0.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              type="button"
              className={`btn btn-sm ${lang === 'fr' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{
                background: lang === 'fr' ? '#2563eb' : 'transparent',
                color: lang === 'fr' ? '#ffffff' : '#475569',
                border: 'none',
                fontWeight: 600,
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
              }}
              onClick={() => {
                setLang('fr');
                setSelectedCategory('ALL');
              }}
            >
              🇫🇷 Français (FR)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{
                background: lang === 'en' ? '#2563eb' : 'transparent',
                color: lang === 'en' ? '#ffffff' : '#475569',
                border: 'none',
                fontWeight: 600,
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
              }}
              onClick={() => {
                setLang('en');
                setSelectedCategory('ALL');
              }}
            >
              🇬🇧 English (EN)
            </button>
          </div>
        }
      />

      {/* Onglets Principaux : Vidéos VTM vs Guides Écrits */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('videos')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'videos' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'videos' ? '#ffffff' : '#475569',
            boxShadow: activeTab === 'videos' ? '0 4px 12px rgba(37,99,235,0.25)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <span>🎥</span>
          <span>{lang === 'fr' ? 'Vidéos & Tutoriels VTM (8)' : 'VTM Video Tutorials (8)'}</span>
          <span style={{
            background: activeTab === 'videos' ? '#1d4ed8' : '#e2e8f0',
            color: activeTab === 'videos' ? '#ffffff' : '#64748b',
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '999px',
            fontWeight: 800,
          }}>
            1080p
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guides')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'guides' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'guides' ? '#ffffff' : '#475569',
            boxShadow: activeTab === 'guides' ? '0 4px 12px rgba(37,99,235,0.25)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <span>📖</span>
          <span>{lang === 'fr' ? 'Guides Pratiques Détaillés (12)' : 'Practical Guides (12)'}</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* SECTION ONGLET 1 : VIDÉOS & TUTORIELS VTM                     */}
      {/* ============================================================ */}
      {activeTab === 'videos' && (
        <div>
          {/* Bannière Présentation Vidéo */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.5rem',
              border: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                <span style={{ background: '#2563eb', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>VTM</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  {lang === 'fr' ? 'Série Vidéo Officielle — Formation au Gestionnaire SaaS' : 'Official Video Series — SaaS Platform Onboarding'}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                {lang === 'fr'
                  ? '8 épisodes courts (35 à 36 secondes), fluides, commentés en français avec sous-titres synchronisés et transcription.'
                  : '8 short episodes (35 to 36 seconds), narrated in clear French with synced karaoke subtitles and full transcripts.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ background: '#1e293b', border: '1px solid #475569', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                🎙️ {lang === 'fr' ? 'Voix française officielle' : 'Official French Voiceover'}
              </span>
              <span style={{ background: '#1e293b', border: '1px solid #475569', color: '#34d399', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                ⚡ {lang === 'fr' ? 'Format < 60s' : '< 60s micro-format'}
              </span>
              <span style={{ background: '#1e293b', border: '1px solid #475569', color: '#fbbf24', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                🎯 {lang === 'fr' ? 'Interface réelle VTM' : 'Real VTM UI'}
              </span>
            </div>
          </div>

          {/* Grille Lecteur Vidéo + Playlist */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Colonne Gauche : Lecteur Vidéo Principal */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              
              {/* Balise Vidéo HTML5 avec Controls & Subtitles */}
              <div style={{ position: 'relative', background: '#0f172a', borderRadius: '10px', overflow: 'hidden', border: '2px solid #1e293b', marginBottom: '1rem' }}>
                <video
                  key={selectedVideo.id}
                  controls
                  autoPlay
                  playsInline
                  poster={selectedVideo.thumb}
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '450px', background: '#0f172a' }}
                >
                  <source src={selectedVideo.mp4} type="video/mp4" />
                  <track src={selectedVideo.vtt} kind="subtitles" srcLang="fr" label="Français" default />
                  Votre navigateur ne supporte pas la balise vidéo HTML5.
                </video>
              </div>

              {/* Barre de métadonnées de la vidéo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {selectedVideo.badge}
                    </span>
                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                      ⏱️ {selectedVideo.duration}
                    </span>
                    <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                      1080p Full HD
                    </span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    {lang === 'fr' ? selectedVideo.titleFr : selectedVideo.titleEn}
                  </h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    {lang === 'fr' ? selectedVideo.secTitleFr : selectedVideo.secTitleEn}
                  </p>
                </div>

                {/* Bouton Épisode Suivant */}
                <button
                  type="button"
                  onClick={() => setSelectedVideoId(nextVideo.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                  }}
                >
                  <span>{lang === 'fr' ? 'Épisode suivant' : 'Next episode'}</span>
                  <span>⏭️</span>
                </button>
              </div>

              {/* Boutons d'actions ressources */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9', marginBottom: '1rem' }}>
                <a
                  href={selectedVideo.mp4}
                  download
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <span>⬇️</span>
                  <span>{lang === 'fr' ? 'Télécharger MP4' : 'Download MP4'}</span>
                </a>

                <a
                  href={selectedVideo.vtt}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <span>📄</span>
                  <span>{lang === 'fr' ? 'Sous-titres VTT' : 'VTT Subtitles'}</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowTranscript(!showTranscript)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: showTranscript ? '#eff6ff' : '#f8fafc',
                    color: showTranscript ? '#1d4ed8' : '#334155',
                    border: showTranscript ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>📝</span>
                  <span>{showTranscript ? (lang === 'fr' ? 'Masquer transcription' : 'Hide transcript') : (lang === 'fr' ? 'Voir la transcription' : 'Show transcript')}</span>
                </button>
              </div>

              {/* Bloc Transcription Déroulante */}
              {showTranscript && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.5rem' }}>
                    🎙️ {lang === 'fr' ? 'Transcription intégrale synchronisée :' : 'Full synchronized transcript:'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
                    {selectedVideo.transcriptionFr.map((line, lIdx) => (
                      <div key={lIdx} style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ color: '#2563eb', fontWeight: 700, fontFamily: 'monospace' }}>{line.slice(0, 14)}</span>
                        <span>{line.slice(15)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Points Clés Pédagogiques */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#15803d', marginBottom: '0.5rem' }}>
                  ✅ {lang === 'fr' ? 'Points clés démontrés dans cette vidéo :' : 'Key takeaways demonstrated in this video:'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(lang === 'fr' ? selectedVideo.keyPointsFr : selectedVideo.keyPointsEn).map((point, pIdx) => (
                    <div key={pIdx} style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', fontSize: '0.84rem', color: '#166534', lineHeight: 1.4 }}>
                      <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Colonne Droite : Playlist des 8 épisodes */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  📋 {lang === 'fr' ? 'Playlist VTM (8 épisodes)' : 'VTM Playlist (8 episodes)'}
                </h3>
                <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                  ~ 4.5 min total
                </span>
              </div>

              {/* Liste cliquable des vidéos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {VTM_TUTORIAL_VIDEOS.map((video) => {
                  const isCurrent = video.id === selectedVideo.id;
                  return (
                    <div
                      key={video.id}
                      onClick={() => setSelectedVideoId(video.id)}
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        padding: '0.65rem',
                        borderRadius: '8px',
                        border: isCurrent ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isCurrent ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Miniature */}
                      <div style={{ position: 'relative', width: '100px', height: '62px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#0f172a' }}>
                        <img
                          src={video.thumb}
                          alt={video.titleFr}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '3px',
                            right: '3px',
                            background: 'rgba(0,0,0,0.75)',
                            color: '#ffffff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '1px 4px',
                            borderRadius: '3px',
                          }}
                        >
                          {video.duration}
                        </span>
                      </div>

                      {/* Infos Épisode */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isCurrent ? '#2563eb' : '#64748b' }}>
                            {lang === 'fr' ? `Épisode ${video.episode}` : `Episode ${video.episode}`}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>•</span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {lang === 'fr' ? video.categoryFr : video.categoryEn}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: isCurrent ? '#1d4ed8' : '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {lang === 'fr' ? video.titleFr : video.titleEn}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#64748b',
                            marginTop: '0.15rem',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {lang === 'fr' ? video.summaryFr : video.summaryEn}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION ONGLET 2 : GUIDES PRATIQUES DÉTAILLÉS (12)           */}
      {/* ============================================================ */}
      {activeTab === 'guides' && (
        <div>
          {/* Bannière de Bienvenue pédagogique */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '1.5rem 1.75rem',
              marginBottom: '1.75rem',
              boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '2rem' }}>💡</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                  {lang === 'fr' ? 'Guides Pratiques du Magasin — Étapes & Bonnes Pratiques' : 'Store Operational Guides — Steps & Best Practices'}
                </h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', color: '#cbd5e1' }}>
                  {lang === 'fr'
                    ? '12 fiches détaillées avec étapes pas-à-pas, scénarios réels, conseils anti-erreurs et foires aux questions pour votre commerce.'
                    : '12 detailed guides with step-by-step procedures, store scenarios, pro tips and FAQs for your business.'}
                </p>
              </div>
            </div>

            {/* Barre des 3 règles d'or */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#e2e8f0' }}>
                <span>⚡</span>
                <span>{lang === 'fr' ? 'Touche Ctrl + K : recherche rapide d’article ou de page' : 'Ctrl + K shortcut: instant product or page search'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#e2e8f0' }}>
                <span>🔒</span>
                <span>{lang === 'fr' ? 'Données protégées : seul votre magasin a accès à vos comptes' : 'Tenant isolation: 100% private & secure store data'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#e2e8f0' }}>
                <span>📦</span>
                <span>{lang === 'fr' ? 'Douchette code-barres : prête à l’emploi dès le branchement' : 'Barcode scanners: plug-and-play ready out of the box'}</span>
              </div>
            </div>
          </div>

          {/* Barre de Recherche et Catégories */}
          <div
            className="card"
            style={{
              padding: '1.1rem 1.25rem',
              marginBottom: '1.5rem',
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', color: '#64748b' }}>
                🔍
              </span>
              <input
                type="search"
                placeholder={
                  lang === 'fr'
                    ? 'Rechercher un guide (ex : caisse, code-barres, crédit, inventaire, dépense, reçu...)'
                    : 'Search any guide (e.g., cash register, barcode, credit, inventory, expenses, receipt...)'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: '0.95rem',
                  padding: '0.65rem 1rem 0.65rem 2.6rem',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  outline: 'none',
                }}
              />
            </div>

            {/* Boutons de catégories */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: selectedCategory === 'ALL' ? '#2563eb' : '#f8fafc',
                  color: selectedCategory === 'ALL' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedCategory('ALL')}
              >
                {lang === 'fr' ? '🌟 Tous les guides (12)' : '🌟 All Guides (12)'}
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="btn btn-sm"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: selectedCategory === c ? '#2563eb' : '#f8fafc',
                    color: selectedCategory === c ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Liste des Guides Pédagogiques Détaillés */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredGuides.length === 0 ? (
              <div
                style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔎</div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#1e293b' }}>
                  {lang === 'fr' ? 'Aucun guide ne correspond à votre recherche' : 'No guides match your search'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  {lang === 'fr'
                    ? `Essayez avec un mot plus simple comme « vente », « stock » ou « caisse ».`
                    : `Try using simpler words like "sale", "stock" or "cash".`}
                </p>
              </div>
            ) : (
              filteredGuides.map((guide) => {
                const isExpanded = expandedId === guide.id;
                const title = lang === 'fr' ? guide.titleFr : guide.titleEn;
                const summary = lang === 'fr' ? guide.summaryFr : guide.summaryEn;
                const goal = lang === 'fr' ? guide.goalFr : guide.goalEn;
                const steps = lang === 'fr' ? guide.stepsFr : guide.stepsEn;
                const example = lang === 'fr' ? guide.exampleFr : guide.exampleEn;
                const tips = lang === 'fr' ? guide.tipsFr : guide.tipsEn;
                const category = lang === 'fr' ? guide.categoryFr : guide.categoryEn;
                const faq = lang === 'fr' ? guide.faqFr : guide.faqEn;

                return (
                  <div
                    key={guide.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '10px',
                      border: isExpanded ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      boxShadow: isExpanded ? '0 10px 25px rgba(37,99,235,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* En-tête cliquable du guide */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(isExpanded ? null : guide.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setExpandedId(isExpanded ? null : guide.id);
                        }
                      }}
                      style={{
                        padding: '1.25rem 1.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        background: isExpanded ? '#f8fafc' : '#ffffff',
                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '2rem', flexShrink: 0 }}>{guide.icon}</span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span
                              style={{
                                background: '#eff6ff',
                                color: '#2563eb',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                              }}
                            >
                              {category}
                            </span>
                          </div>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                            {title}
                          </h3>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                            {summary}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: '#2563eb',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          {isExpanded
                            ? lang === 'fr'
                              ? 'Fermer ▲'
                              : 'Collapse ▲'
                            : lang === 'fr'
                            ? 'Lire le guide ▼'
                            : 'Read guide ▼'}
                        </span>
                      </div>
                    </div>

                    {/* Contenu Déroulé du Guide */}
                    {isExpanded && (
                      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Objectif */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderLeft: '4px solid #2563eb',
                            padding: '0.85rem 1rem',
                            borderRadius: '4px',
                          }}
                        >
                          <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>
                            🎯 {lang === 'fr' ? 'À quoi ça sert ?' : 'What is this for?'}
                          </strong>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                            {goal}
                          </p>
                        </div>

                        {/* Étapes pas à pas */}
                        <div>
                          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                            📋 {lang === 'fr' ? 'Étapes à suivre pas-à-pas :' : 'Step-by-step instructions:'}
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {steps.map((step, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '0.75rem',
                                  fontSize: '0.88rem',
                                  color: '#334155',
                                  lineHeight: 1.5,
                                }}
                              >
                                <span
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: '#2563eb',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                    marginTop: '1px',
                                  }}
                                >
                                  {idx + 1}
                                </span>
                                <span style={{ flex: 1 }}>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Exemple concret */}
                        <div
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '8px',
                            padding: '1rem',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1d4ed8', marginBottom: '0.35rem' }}>
                            🏪 {lang === 'fr' ? 'Exemple pratique du quotidien :' : 'Real-world store example:'}
                          </div>
                          <div style={{ fontSize: '0.88rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                            {example}
                          </div>
                        </div>

                        {/* Conseil du pro */}
                        <div
                          style={{
                            background: '#fffbeb',
                            borderLeft: '4px solid #f59e0b',
                            padding: '0.85rem 1rem',
                            borderRadius: '6px',
                            fontSize: '0.88rem',
                            color: '#92400e',
                            lineHeight: 1.5,
                          }}
                        >
                          <strong>💡 {lang === 'fr' ? 'Conseil du pro :' : 'Pro Tip:'}</strong> {tips}
                        </div>

                        {/* FAQ spécifique */}
                        {faq && faq.length > 0 && (
                          <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.92rem', fontWeight: 700, color: '#1e293b' }}>
                              ❓ {lang === 'fr' ? 'Questions fréquentes des commerçants :' : 'Frequently Asked Questions:'}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              {faq.map((item, qIdx) => (
                                <div key={qIdx} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                                    Q : {item.question}
                                  </div>
                                  <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
                                    R : {item.answer}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
'''

with open(HELP_PAGE_PATH, "w", encoding="utf-8") as f:
    f.write(new_code)

print("HelpCenterPage.tsx updated successfully!")

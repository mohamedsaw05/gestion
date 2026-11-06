import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';

interface DetailedGuide {
  id: string;
  categoryFr: string;
  categoryEn: string;
  roles?: ('CASHIER' | 'WAREHOUSE' | 'MANAGER' | 'ACCOUNTANT' | 'TECH')[];
  icon: string;
  titleFr: string;
  titleEn: string;
  summaryFr: string;
  summaryEn: string;
  goalFr: string;
  goalEn: string;
  stepsFr: string[];
  stepsEn: string[];
  exampleFr: string;
  exampleEn: string;
  tipsFr: string;
  tipsEn: string;
  faqFr?: { question: string; answer: string }[];
  faqEn?: { question: string; answer: string }[];
}

const STARTER_JOURNEY = [
  { key: 'workspace', label: 'Découvrir le tableau de bord et les menus' },
  { key: 'company', label: 'Configurer l’entreprise et son profil commercial', module: 'settings' },
  { key: 'business', label: 'Renseigner les informations commerciales et l’identité des documents', module: 'settings' },
  { key: 'locations', label: 'Créer les boutiques et dépôts', module: 'multiple_locations' },
  { key: 'categories', label: 'Créer les catégories', module: 'catalog' },
  { key: 'products', label: 'Enregistrer les premiers produits', module: 'catalog' },
  { key: 'stock', label: 'Configurer les stocks', module: 'inventory' },
  { key: 'customers', label: 'Créer les clients', module: 'customers' },
  { key: 'suppliers', label: 'Créer les fournisseurs', module: 'suppliers' },
  { key: 'payments', label: 'Vérifier les méthodes de paiement', module: 'settings' },
  { key: 'users', label: 'Créer les utilisateurs et leurs permissions', module: 'users' },
  { key: 'permissions', label: 'Vérifier les permissions de chaque rôle', module: 'users' },
  { key: 'cash', label: 'Ouvrir la caisse', module: 'cash' },
  { key: 'sale', label: 'Réaliser une première vente', module: 'sales' },
  { key: 'reports', label: 'Consulter les rapports actifs', module: 'reports' },
];
const GUIDE_MODULES: Record<string, string> = {
  'catalog-products': 'catalog', 'pos-sales-operation': 'sales', 'cash-register-sessions': 'cash',
  'customer-credit': 'credit', 'inventory-reconciliation': 'inventory', 'stock-transfers': 'inventory',
  'supplier-purchases': 'suppliers', 'expenses-charges': 'expenses', 'reports-kpi': 'reports',
  'returns-warranties': 'returns', 'backups-portability': 'settings',
};

const EXTENSIVE_GUIDES: DetailedGuide[] = [
  {
    id: 'setup-store',
    categoryFr: 'Configuration',
    categoryEn: 'Setup',
    icon: '🏬',
    titleFr: '1. Démarrage & Configuration Initiale de votre Commerce',
    titleEn: '1. Getting Started & Store Setup',
    summaryFr: 'Comment renseigner les informations de votre entreprise, choisir votre devise et créer vos boutiques et dépôts.',
    summaryEn: 'How to enter your business info, select your default currency and create retail stores and warehouses.',
    goalFr: 'Personnaliser le logiciel avec le nom de votre magasin, vos coordonnées et créer les lieux où se trouvent vos marchandises.',
    goalEn: 'Customize the software with your store name, contact info, and create locations where items are stored.',
    stepsFr: [
      'Allez dans le menu « Paramètres » puis cliquez sur « Profil du commerce » dans le menu à gauche.',
      'Saisissez la raison sociale ou le nom commercial de votre boutique (ex : « Établissements Savadogo & Frères »).',
      'Indiquez votre adresse physique, votre numéro de téléphone et votre adresse email de contact.',
      'Vérifiez la devise principale (par exemple « XOF » pour le Franc CFA, ou « EUR » / « USD » selon votre pays). Les tickets de caisse afficheront automatiquement cette devise.',
      'Dans « Configuration », créez vos emplacements physiques : une « Boutique de vente » pour le comptoir et un « Dépôt » pour la réserve de stock.',
      'Invitez vos employés (vendeurs, caissiers, magasiniers, comptables) dans « Utilisateurs » en leur attribuant un mot de passe sécurisé.',
    ],
    stepsEn: [
      'Navigate to "Settings" then click "Business Profile" in the left navigation menu.',
      'Enter your business legal name or store trade name (e.g., "Savadogo Trading & Retail").',
      'Provide your physical store address, official contact phone number, and support email.',
      'Verify your base currency (e.g., "XOF" for CFA Francs, or "EUR" / "USD"). Receipts will display this currency.',
      'In "Configuration", add your physical locations: create a "Retail Store" for counter sales and a "Warehouse" for storage.',
      'Invite team members (cashiers, sales clerks, warehouse staff) in "Users" with secure credentials.',
    ],
    exampleFr: 'Exemple : Si vous gérez une boutique au centre-ville et un dépôt au quartier Nord, créez deux emplacements : « Magasin Centre » et « Dépôt Principal ». Vos vendeurs vendront depuis le « Magasin Centre » et les réceptions de camions se feront au « Dépôt Principal ».',
    exampleEn: 'Example: If you run a downtown store and an uptown storage unit, create two locations: "Main Store" and "Central Depot". Cashiers will sell from "Main Store" and bulk supplier deliveries will arrive at "Central Depot".',
    tipsFr: 'Règle essentielle : Même si le propriétaire ou directeur est en voyage ou ne se connecte pas pendant un mois, les vendeurs et caissiers continuent de travailler normalement sans interruption.',
    tipsEn: 'Golden rule: Even if the business owner is traveling or absent for a month, employees and cashiers can continue working normally without disruption.',
    faqFr: [
      {
        question: 'Puis-je changer le nom de mon magasin plus tard ?',
        answer: 'Oui, à tout moment dans Paramètres > Profil du commerce. Les futures factures prendront le nouveau nom immédiatement.',
      },
      {
        question: 'Mes employés peuvent-ils voir le bénéfice de mon magasin ?',
        answer: 'Non. Seuls les gérants et administrateurs ont accès aux marges et bénéfices. Les caissiers ne voient que le prix de vente public.',
      },
    ],
  },
  {
    id: 'catalog-products',
    categoryFr: 'Articles & Catalogue',
    categoryEn: 'Products & Catalog',
    icon: '📦',
    titleFr: '2. Créer et Gérer votre Catalogue de Produits & Variantes',
    titleEn: '2. Creating & Managing Products & Variants',
    summaryFr: 'Ajouter des articles simples, des produits avec tailles/couleurs, renseigner les codes-barres et les prix.',
    summaryEn: 'Add single products, size/color variants, barcodes and selling prices.',
    goalFr: 'Enregistrer vos articles avec leur référence, leur prix de vente et leur code-barres pour les retrouver en une seconde lors des ventes.',
    goalEn: 'Save your inventory items with SKU references, selling prices, and barcodes for instant lookup at checkout.',
    stepsFr: [
      'Cliquez sur « Catalogue & Stocks » dans le menu, puis sur « Produits ».',
      'Cliquez sur le bouton bleu « + Nouveau produit » en haut à droite.',
      'Renseignez la référence SKU (ex: « CHAUSS-01 ») et le nom complet (ex: « Chaussure Cuir Homme Taille 42 »).',
      'Choisissez le type d’article : « Produit physique » (stocké), « Prestation de service » (réparation, livraison) ou « Pack / Composition » (lot de plusieurs articles vendus ensemble).',
      'Indiquez le prix de vente normal (ex: 25 000 XOF) et l’unité de mesure (pièce, carton, paquet, kilogramme, litre).',
      'Pour ajouter un code-barres : ouvrez la fiche de l’article, cliquez sur « Gérer », scannez le code-barres avec votre douchette ou tapez les chiffres.',
      'Si vous vendez par carton et par pièce, vous pouvez définir des unités secondaires (ex: 1 carton = 12 pièces).',
    ],
    stepsEn: [
      'Click on "Catalog & Stock" in the sidebar, then select "Products".',
      'Click the blue "+ New Product" button in the upper right corner.',
      'Fill in the SKU code (e.g. "SHOE-01") and full title (e.g. "Men Genuine Leather Shoes Size 42").',
      'Choose the product type: "Physical Product" (tracked in stock), "Service" (repair, delivery), or "Bundle" (bundle of multiple items).',
      'Set the standard selling price (e.g. 25,000 XOF) and the unit of measure (piece, box, pack, kg, liter).',
      'To assign a barcode: open the item, click "Manage", scan the barcode with your scanner or type the numbers manually.',
      'If you sell by box and individual units, you can configure secondary units (e.g. 1 box = 12 pieces).',
    ],
    exampleFr: 'Exemple : Pour du riz, créez le produit « Riz Parfumé 25kg » avec SKU « RIZ-25KG », prix de vente 18 500 XOF, unité « sac ». Si vous le vendez aussi au détail, vous pouvez ajouter une unité « kg » avec facteur de conversion.',
    exampleEn: 'Example: For rice, create "Jasmine Rice 25kg" with SKU "RICE-25KG", price 18,500 XOF, unit "bag". You can also add conversion units if sold in smaller quantities.',
    tipsFr: 'Conseil utile : Donnez des noms complets et précis à vos articles (évitez d’écrire juste « Robe », écrivez plutôt « Robe Soie Rouge Taille M ») afin que vos vendeurs ne fassent jamais d’erreur d’article.',
    tipsEn: 'Pro tip: Use descriptive names (avoid vague names like "Dress", write "Red Silk Evening Dress Size M") so staff never confuse items.',
    faqFr: [
      {
        question: 'Comment importer ma liste existante depuis Excel ?',
        answer: 'Sur la page Produits, cliquez sur « Importer des articles via CSV ». Vous pouvez télécharger un modèle type, copier vos colonnes et importer des centaines d’articles d’un coup.',
      },
    ],
  },
  {
    id: 'pos-sales-operation',
    categoryFr: 'Ventes & Caisse',
    categoryEn: 'Sales & POS',
    icon: '🛒',
    titleFr: '3. Enregistrer une Vente au Comptoir & Imprimer le Reçu',
    titleEn: '3. Processing Counter Sales & Printing Receipts',
    summaryFr: 'Comment rechercher un article rapidement, choisir le moyen de paiement et imprimer le ticket de caisse en moins de 30 secondes.',
    summaryEn: 'How to look up items quickly, select payment methods and print receipts in under 30 seconds.',
    goalFr: 'Encaisser les clients rapidement sans file d’attente, mettre le stock à jour automatiquement et délivrer un reçu propre.',
    goalEn: 'Checkout shoppers quickly without waiting lines, update stock automatically and deliver a clean receipt.',
    stepsFr: [
      'Cliquez sur « Vendre » dans le menu ou appuyez sur « Ctrl + K » sur votre clavier.',
      'Dans la case de recherche, tapez les premières lettres du produit OU scannez directement son code-barres avec la douchette.',
      'Le sélecteur affiche immédiatement la fiche complète de l’article avec son stock disponible et son prix.',
      'Ajustez la quantité vendue à l’aide des boutons « - » et « + » ou en tapant directement le nombre.',
      'Pour ajouter un deuxième article, cliquez sur « + Ajouter une ligne » et répétez la recherche.',
      'Si le client est un habitué, sélectionnez son nom dans la case « Client » (ou cliquez sur « + Nouveau client » pour l’enregistrer vite).',
      'Choisissez le moyen de paiement : « Espèces » (comptant), « Mobile Money » (Orange Money, Wave, Moov), « Carte bancaire », « Virement » ou « Crédit client ».',
      'Cliquez sur le bouton vert « Valider la vente » : la vente est enregistrée et le reçu officiel s’affiche pour impression immédiate.',
    ],
    stepsEn: [
      'Click "New Sale" in the navigation menu or press "Ctrl + K" on your keyboard.',
      'In the search box, type the first letters of the product OR scan its barcode with your barcode reader.',
      'The selector instantly shows the full product card with available stock and unit price.',
      'Adjust the sold quantity using the "-" and "+" stepper buttons or type the number directly.',
      'To add another item, click "+ Add line" and look up the second product.',
      'If the customer is known, pick their name in the "Customer" field (or click "+ Quick Customer" to add them).',
      'Select payment method: "Cash", "Mobile Money" (Wave, Orange Money), "Card", "Transfer", or "Customer Credit".',
      'Click the green "Confirm Sale" button: the sale is finalized and the official receipt pops up ready for printing.',
    ],
    exampleFr: 'Exemple : Un client achète 3 paquets de café à 1 500 XOF et paie par Wave. Vous scannez le café, mettez quantité 3, choisissez « Mobile Money », notez la référence de transaction Wave, puis cliquez sur Valider. Le stock diminue de 3 et le reçu affiche 4 500 XOF réglés.',
    exampleEn: 'Example: A shopper buys 3 packs of coffee at 1,500 XOF and pays with Wave. You scan the coffee, set quantity to 3, select "Mobile Money", note the transaction code, and confirm. Stock drops by 3 and the receipt shows 4,500 XOF paid.',
    tipsFr: 'Protection anti-erreur : Si vous tentez de vendre une quantité supérieure au stock présent dans le magasin, le système vous avertit en rouge pour éviter de vendre un article qui n’existe pas.',
    tipsEn: 'Oversell protection: If you enter a quantity greater than available stock, the system warns you in red to prevent ghost sales.',
  },
  {
    id: 'cash-register-sessions',
    categoryFr: 'Ventes & Caisse',
    categoryEn: 'Cash Register',
    icon: '💵',
    titleFr: '4. Gestion du Tiroir-Caisse : Ouverture, Suivi et Clôture du Soir',
    titleEn: '4. Daily Cash Register: Opening, Monitoring & Nightly Closing',
    summaryFr: 'Compter le fond de caisse le matin, suivre les encaissements en espèces et vérifier les comptes le soir.',
    summaryEn: 'Counting opening cash floats, tracking physical cash during the day and closing sessions at night.',
    goalFr: 'Garantir que chaque franc en espèces dans le tiroir-caisse correspond exactement aux ventes de la journée, sans vol ni oubli.',
    goalEn: 'Ensure every physical currency note in the drawer matches recorded sales, eliminating shortages and losses.',
    stepsFr: [
      'Le matin à l’ouverture du magasin : rendez-vous dans « Ventes & Caisse » > « Caisse ».',
      'Cliquez sur « Ouvrir une session de caisse ». Saisissez la monnaie de départ (fond de caisse, ex : 20 000 XOF).',
      'Pendant la journée : chaque vente en espèces augmente automatiquement le montant attendu dans le tiroir.',
      'Si vous payez une dépense en espèces (ex : 2 000 XOF pour du carburant), enregistrez la dépense : le tiroir se décompte automatiquement !',
      'Le soir à la fermeture : comptez physiquement les billets et pièces dans votre tiroir.',
      'Cliquez sur « Clôturer la caisse » et saisissez le montant physique réel que vous avez compté.',
      'Le système compare votre comptage au montant attendu. S’il y a un écart (surplus ou manque), vous pouvez noter une explication pour le gérant.',
    ],
    stepsEn: [
      'Every morning: go to "Sales & Cash" > "Cash Register".',
      'Click "Open Session". Enter the initial cash float amount (e.g. 20,000 XOF).',
      'During the day: every cash sale automatically increments expected cash in the drawer.',
      'If you pay an operating expense in cash (e.g. 2,000 XOF for fuel), record it: cash drawer deducts it automatically!',
      'At store closing: physically count notes and coins in your cash drawer.',
      'Click "Close Session" and input the actual counted cash amount.',
      'The software compares physical cash with theoretical balance and records any surplus or shortage with your notes.',
    ],
    exampleFr: 'Exemple : Fond de caisse le matin = 25 000 XOF. Ventes de la journée = 120 000 XOF. Dépense ampoules = 5 000 XOF. Le soir, le tiroir doit contenir exactement 140 000 XOF (25 000 + 120 000 - 5 000). Vous comptez 140 000 XOF : écart = 0 XOF, caisse parfaite !',
    exampleEn: 'Example: Opening float = 25,000 XOF. Daily cash sales = 120,000 XOF. Cash expense = 5,000 XOF. Closing drawer must have 140,000 XOF. You count 140,000 XOF: zero discrepancy, perfect balance!',
    tipsFr: 'Bonne pratique : Ne laissez jamais une caisse ouverte plusieurs jours d’affilée. Fermez la caisse chaque soir pour avoir des rapports quotidiens irréprochables.',
    tipsEn: 'Best practice: Always close your register session every evening to keep daily financial statements crystal clear.',
  },
  {
    id: 'customer-credit',
    categoryFr: 'Crédit & Dettes',
    categoryEn: 'Credit & Debts',
    icon: '🤝',
    titleFr: '5. Ventes à Crédit, Suivi des Dettes Clients & Remboursements',
    titleEn: '5. Customer Credit, Debt Tracking & Payment Collection',
    summaryFr: 'Vendre à un client qui paiera plus tard, fixer un plafond de crédit et enregistrer les paiements partiels.',
    summaryEn: 'Selling on credit to trusted buyers, setting credit limits and recording partial repayments.',
    goalFr: 'Servir vos clients fidèles à crédit sans perdre la trace de qui vous doit de l’argent ni combien.',
    goalEn: 'Serve trusted customers on credit without ever losing track of who owes you money and exact balances.',
    stepsFr: [
      'Pour vendre à crédit, le client doit être enregistré dans « Clients » avec au moins son nom et numéro de téléphone.',
      'Lors de la vente, sélectionnez le client, puis dans « Mode de règlement », choisissez « Crédit client » (ou versez un acompte en espèces et laissez le reste à crédit).',
      'Validez la vente : le stock sort, le reçu indique le solde restant dû et le compte du client est débité.',
      'Pour voir qui vous doit de l’argent : allez dans « Crédit & Créances » > « Comptes clients ». La liste affiche chaque client avec son solde de dette.',
      'Quand le client vient rembourser : ouvrez sa fiche, cliquez sur « Enregistrer un remboursement », saisissez le montant (total ou partiel, ex : 10 000 XOF) et le moyen reçu.',
      'Un reçu de paiement est généré et la dette du client diminue immédiatement.',
    ],
    stepsEn: [
      'To sell on credit, the customer must be registered in "Customers" with at least their name and phone number.',
      'During checkout, select the customer, and set payment to "Customer Credit" (or pay a partial deposit and leave the rest on credit).',
      'Confirm the sale: inventory updates, receipt shows balance due, and customer account is debited.',
      'To review debts: go to "Credit & Receivables" > "Customer Accounts" to see all outstanding balances.',
      'When customer repays: open their account, click "Record Payment", enter amount (partial or full) and payment method.',
      'A payment receipt is generated and the customer balance decreases instantly.',
    ],
    exampleFr: 'Exemple : M. Diallo achète pour 40 000 XOF de matériel. Il donne 15 000 XOF en espèces et demande crédit pour les 25 000 XOF restants. Lors de la vente, cochez paiement partiel : perçu 15 000 XOF, reste 25 000 XOF. Trois jours plus tard, il apporte 25 000 XOF : vous enregistrez le remboursement et sa dette retombe à zéro.',
    exampleEn: 'Example: Mr. Diallo buys 40,000 XOF worth of goods. He pays 15,000 XOF cash and asks for 25,000 XOF on credit. You record 15,000 XOF paid and 25,000 XOF balance due. Days later, he repays 25,000 XOF: balance becomes zero.',
    tipsFr: 'Sécurité : Vous pouvez définir une « Limite de crédit » sur la fiche d’un client (ex : max 100 000 XOF). Si sa dette dépasse cette limite, le système empêche une nouvelle vente à crédit sans accord du gérant.',
    tipsEn: 'Safety: You can set a "Credit Limit" per customer (e.g. max 100,000 XOF). If debt exceeds the ceiling, further credit sales are locked.',
  },
  {
    id: 'inventory-reconciliation',
    categoryFr: 'Stocks & Dépôts',
    categoryEn: 'Inventory & Stock',
    icon: '📊',
    titleFr: '6. Suivi des Stocks, Alertes et Inventaire Physique Réel',
    titleEn: '6. Stock Tracking, Low Stock Alerts & Physical Inventory Count',
    summaryFr: 'Consulter vos niveaux de stock en direct, recevoir des alertes de rupture et faire l’inventaire de fin de mois.',
    summaryEn: 'Monitor live stock levels, receive low stock alerts and conduct monthly physical stock counts.',
    goalFr: 'Avoir l’assurance que le stock affiché dans l’ordinateur correspond exactement aux cartons et pièces sur vos étagères.',
    goalEn: 'Ensure digital stock figures perfectly match physical boxes and items on your shelves.',
    stepsFr: [
      'Allez dans « Catalogue & Stocks » > « Niveaux de stock » pour voir tout votre magasin en un coup d’œil.',
      'Les couleurs vous guident : Vert = En stock, Orange = Stock faible (il faut recommander), Rouge = Rupture totale.',
      'Faire l’inventaire mensuel : allez dans « Stock » > « Réconciliation d’inventaire ».',
      'Prenez une feuille ou votre tablette, comptez physiquement vos articles sur les étagères et saisissez le chiffre réel.',
      'Le logiciel calcule automatiquement la différence : si l’ordinateur disait 10 et que vous en avez 8, il enregistre un écart de -2 avec la date et le nom de l’employé.',
      'Une fois validé, votre stock système repart sur des bases 100% justes.',
    ],
    stepsEn: [
      'Go to "Catalog & Stock" > "Stock Levels" to review your entire catalog at a glance.',
      'Color tags help you: Green = In Stock, Orange = Low Stock (reorder soon), Red = Completely Out of Stock.',
      'Conducting physical count: navigate to "Stock" > "Inventory Reconciliation".',
      'Physically count items on your shelves and type the real counted quantity.',
      'The software automatically computes discrepancies (e.g. system showed 10, counted 8 = difference of -2) with audit trail.',
      'Once confirmed, your digital inventory is refreshed to 100% accurate physical reality.',
    ],
    exampleFr: 'Exemple : En fin de mois, le magasinier compte les sacs de sucre. L’ordinateur prévoyait 45 sacs. Le comptage physique donne 44 sacs. L’écart de -1 sac est consigné avec le motif « Sac percé lors de la manipulation ». Tout est clair et transparent.',
    exampleEn: 'Example: At month end, warehouse staff counts sugar bags. System expected 45 bags. Physical count finds 44 bags. The -1 discrepancy is audited with reason "Torn bag during transport". Complete accountability.',
    tipsFr: 'Règle stricte : Le système enregistre chaque mouvement dans un journal protégé (append-only). Personne ne peut modifier un chiffre en cachette sans laisser de trace.',
    tipsEn: 'Audit integrity: Every stock movement is logged in an append-only ledger. Nobody can alter inventory numbers secretly.',
  },
  {
    id: 'stock-transfers',
    categoryFr: 'Stocks & Dépôts',
    categoryEn: 'Stock Transfers',
    icon: '🚚',
    titleFr: '7. Transfert de Marchandises entre Magasins et Dépôts',
    titleEn: '7. Inter-Store Inventory Transfers & Dispatch',
    summaryFr: 'Envoyer des articles du grand dépôt vers la boutique sans risque de perte en cours de route.',
    summaryEn: 'Dispatch goods from central warehouse to branch store without risk of shrinkage.',
    goalFr: 'Transférer du stock en toute sécurité avec validation au départ et vérification à l’arrivée.',
    goalEn: 'Safely transfer goods with departure verification and destination receiving confirmation.',
    stepsFr: [
      'Rendez-vous dans « Catalogue & Stocks » > « Transferts de stock ».',
      'Cliquez sur « + Nouveau transfert ».',
      'Sélectionnez l’emplacement de départ (ex : « Dépôt Principal ») et l’emplacement d’arrivée (ex : « Magasin Centre »).',
      'Ajoutez les articles et quantités à expédier.',
      'Cliquez sur « Valider l’expédition » : les articles quittent le dépôt de départ et passent au statut « EN TRANSIT ».',
      'Quand le livreur arrive à la boutique destinataire, le caissier ouvre le transfert, vérifie les colis et clique sur « Confirmer la réception ».',
      'Le stock de la boutique augmente alors instantanément.',
    ],
    stepsEn: [
      'Go to "Catalog & Stock" > "Stock Transfers".',
      'Click "+ New Transfer".',
      'Select source location (e.g. "Main Warehouse") and destination (e.g. "Downtown Store").',
      'Add items and quantities to be dispatched.',
      'Click "Confirm Dispatch": items leave source location and enter "IN TRANSIT" status.',
      'When goods arrive at destination, the store clerk inspects boxes and clicks "Confirm Receipt".',
      'Destination inventory updates immediately.',
    ],
    exampleFr: 'Astuce rapide pendant une vente : Si un client veut un produit en rupture au magasin mais disponible au dépôt, le sélecteur de vente affiche un bouton bleu « Transférer ici ⇄ ». Vous pouvez lancer le transfert en 1 clic sans fermer la vente !',
    exampleEn: 'Speedy sales tip: If a shopper wants an item out of stock locally but available in another depot, the sales selector shows a blue "Transfer here ⇄" button. You can request stock without canceling the sale!',
    tipsFr: 'Sécurité : Tant que le magasin destinataire n’a pas cliqué sur « Confirmer la réception », les articles restent marqués « EN TRANSIT ». Ainsi, en cas de perte, on sait exactement qui avait la marchandise en main.',
    tipsEn: 'Chain of custody: Until destination store clicks "Confirm Receipt", items remain flagged as "IN TRANSIT", ensuring full responsibility.',
  },
  {
    id: 'supplier-purchases',
    categoryFr: 'Achats & Fournisseurs',
    categoryEn: 'Purchases & Suppliers',
    icon: '🏭',
    titleFr: '8. Achats Fournisseurs, Commandes et Réceptions de Marchandises',
    titleEn: '8. Supplier Purchases, Purchase Orders & Receiving',
    summaryFr: 'Passer commande auprès de vos grossistes, réceptionner les livraisons et enregistrer les factures d’achat.',
    summaryEn: 'Order from wholesale suppliers, receive deliveries and log purchase invoices.',
    goalFr: 'Approvisionner votre boutique au bon prix d’achat et savoir exactement ce que vous devez à vos fournisseurs.',
    goalEn: 'Restock your store at correct cost prices and track outstanding supplier balances.',
    stepsFr: [
      'Enregistrez vos fournisseurs dans « Achats & Fournisseurs » > « Fournisseurs » avec leur contact et adresse.',
      'Pour passer commande : cliquez sur « Commandes fournisseurs » > « + Nouvelle commande ».',
      'Choisissez le fournisseur, ajoutez les produits souhaités avec leur quantité et leur prix d’achat négocié.',
      'Quand la marchandise arrive dans votre magasin : ouvrez la commande et cliquez sur « Réceptionner la livraison ».',
      'Le stock augmente automatiquement dans l’emplacement sélectionné sans aucune ressaisie !',
      'Enregistrez le règlement versé au fournisseur (comptant, chèque ou virement bancaire).',
    ],
    stepsEn: [
      'Register your suppliers in "Purchases & Suppliers" > "Suppliers" with contact details.',
      'To order goods: click "Purchase Orders" > "+ New Order".',
      'Select supplier, specify products, quantities and agreed wholesale unit costs.',
      'When shipment arrives: open the purchase order and click "Receive Delivery".',
      'Inventory increases automatically in the target location with zero manual re-entry!',
      'Record your supplier payment (cash, check, or bank transfer).',
    ],
    exampleFr: 'Exemple : Vous commandez 100 cartons de jus auprès du grossiste Brama à 6 000 XOF le carton. À la livraison au dépôt, vous cliquez sur Réceptionner : votre stock de jus passe immédiatement de 12 à 112 cartons.',
    exampleEn: 'Example: You order 100 juice boxes from Brama Wholesalers at 6,000 XOF per box. Upon arrival, you click Receive: juice stock jumps from 12 to 112 boxes instantly.',
    tipsFr: 'Calcul de marge : En renseignant le prix d’achat exact lors de vos réceptions, le système peut calculer votre bénéfice réel et votre marge brute sur chaque vente.',
    tipsEn: 'Margin precision: Entering exact purchase costs allows the system to compute true gross margins and net profits on every sale.',
  },
  {
    id: 'expenses-charges',
    categoryFr: 'Finance & Dépenses',
    categoryEn: 'Finance & Expenses',
    icon: '💸',
    titleFr: '9. Enregistrer les Dépenses du Commerce (Loyer, Factures, Salaires)',
    titleEn: '9. Recording Operating Expenses (Rent, Utilities, Wages)',
    summaryFr: 'Déclarer les frais du quotidien, joindre les reçus et éviter de compter deux fois les mêmes montants.',
    summaryEn: 'Log daily store expenses, attach receipts and eliminate double-counting.',
    goalFr: 'Garder une vision 100% nette de vos bénéfices après déduction du loyer, du courant, de l’eau et des salaires.',
    goalEn: 'Keep clear visibility into net profits after deducting rent, power, water, transport and wages.',
    stepsFr: [
      'Dans le menu « Rapports & Contrôle », cliquez sur « Dépenses & Charges ».',
      'Cliquez sur le bouton bleu « + Nouvelle dépense ».',
      'Indiquez le montant (ex : 35 000 XOF) et choisissez la catégorie : « Loyer », « Électricité / Eau », « Transport / Livraison », « Salaires », « Fournitures » ou « Autre ».',
      'Rédigez une description claire (ex : « Facture électricité Sonabel du mois de mai »).',
      'Indiquez le moyen de paiement : si vous payez en espèces depuis la caisse du magasin, le montant sera automatiquement soustrait du tiroir-caisse sans double saisie !',
      'Vous pouvez joindre une photo ou un fichier PDF de la facture ou du reçu.',
      'Cliquez sur « Enregistrer la dépense ». Pour les grosses dépenses (au-dessus de 500 000 XOF), une validation par le propriétaire est demandée.',
    ],
    stepsEn: [
      'In "Reports & Control", click on "Expenses".',
      'Click the "+ New Expense" button.',
      'Enter amount (e.g. 35,000 XOF) and category: "Rent", "Utilities", "Logistics", "Payroll", "Supplies", or "Other".',
      'Provide a clear description (e.g. "May electricity bill").',
      'Select payment method: if paid in cash from active register session, funds are deducted from the drawer automatically!',
      'You can upload a receipt photo or PDF bill.',
      'Click "Save Expense". High-value expenses over 500,000 XOF require manager approval.',
    ],
    exampleFr: 'Exemple : Le livreur apporte de l’eau minérale pour la boutique pour 4 000 XOF. Le caissier prend 4 000 XOF dans le tiroir, enregistre la dépense « Eau minérale bureau » en Espèces. Le tiroir-caisse diminue immédiatement de 4 000 XOF et le rapport de fin de journée est 100% juste.',
    exampleEn: 'Example: Courier delivers 4,000 XOF office water. Cashier takes 4,000 XOF from drawer, records expense "Office drinking water" in Cash. Drawer balance drops by 4,000 XOF and daily closure matches perfectly.',
    tipsFr: 'Traçabilité financière : Une dépense validée ne peut jamais être effacée en secret. Si une erreur a été commise, elle doit être annulée avec un motif pour garantir un audit propre.',
    tipsEn: 'Audit protection: Validated expenses cannot be deleted silently. Corrections require an audit trail note.',
  },
  {
    id: 'reports-kpi',
    categoryFr: 'Rapports & Gestion',
    categoryEn: 'Reports & KPIs',
    icon: '📈',
    titleFr: '10. Comprendre vos Chiffres : Ventes, Bénéfices & Meilleurs Articles',
    titleEn: '10. Understanding Business Reports: Revenue, Profits & Best Sellers',
    summaryFr: 'Analyser vos performances sans être comptable : chiffre d’affaires du jour, marge réelle et articles stars.',
    summaryEn: 'Analyze store metrics without accounting degrees: daily revenue, gross margins, and top items.',
    goalFr: 'Savoir exactement si votre commerce gagne de l’argent et quels articles rapportent le plus.',
    goalEn: 'Know exactly if your store is profitable and which items drive the highest margins.',
    stepsFr: [
      'Consultez la « Page d’accueil » (Tableau de bord) pour voir vos indicateurs clés du jour en temps réel.',
      'Le premier chiffre est le « Chiffre d’affaires » : le total des ventes réalisées.',
      'Le second chiffre est les « Encaissements » : l’argent réellement perçu (en espèces, mobile money ou virement).',
      'Le troisième chiffre est le « Total des dépenses » : ce qui est sorti pour faire tourner le magasin.',
      'Rendez-vous dans « Rapports & Contrôle » > « Rapports » pour voir l’évolution par semaine, par mois ou par année.',
      'Consultez la liste des « Meilleurs produits » pour savoir quels articles commander en plus grande quantité.',
    ],
    stepsEn: [
      'Visit the "Dashboard" home page for real-time overview of daily key performance indicators.',
      'First card shows "Gross Revenue": total value of sales concluded.',
      'Second card shows "Collected Cash": funds actually received (cash, mobile money, transfers).',
      'Third card shows "Operating Expenses": funds spent running the business.',
      'Navigate to "Reports & Control" > "Reports" to review trends by week, month or year.',
      'Check the "Top Selling Products" table to prioritize high-velocity supplier reorders.',
    ],
    exampleFr: 'Exemple : Si votre tableau de bord indique 200 000 XOF de ventes, 180 000 XOF d’encaissements et 20 000 XOF de crédit, vous savez immédiatement que vous avez 20 000 XOF à récupérer auprès des clients.',
    exampleEn: 'Example: If dashboard shows 200,000 XOF in sales, 180,000 XOF collected and 20,000 XOF in credit, you immediately know 20,000 XOF is outstanding to collect.',
    tipsFr: 'Clarté totale : Tous les graphiques sont interactifs. Vous pouvez filtrer par magasin ou par période d’un simple clic.',
    tipsEn: 'High clarity: All charts are interactive. You can filter by store location or date range with a single click.',
  },
  {
    id: 'returns-warranties',
    categoryFr: 'Retours & SAV',
    categoryEn: 'Returns & After-Sale',
    icon: '🔄',
    titleFr: '11. Retours d’Articles, Échanges et Gestion du SAV',
    titleEn: '11. Item Returns, Exchanges & Warranty Management',
    summaryFr: 'Reprendre un produit défectueux, réintégrer le stock et rembourser le client ou faire un avoir.',
    summaryEn: 'Accepting returned goods, restocking items and issuing refunds or credit vouchers.',
    goalFr: 'Gérer les réclamations des clients de façon juste et transparente sans désynchroniser votre stock.',
    goalEn: 'Handle customer claims fairly and transparently while keeping physical stock 100% in sync.',
    stepsFr: [
      'Allez dans « Ventes & Caisse » > « Retours ».',
      'Cliquez sur « + Nouveau retour » et retrouvez la vente originale grâce au numéro de reçu ou au nom du client.',
      'Sélectionnez l’article rapporté et indiquez la quantité.',
      'Choisissez le motif : « Produit défectueux », « Erreur de taille / modèle », « Changement d’avis ».',
      'Indiquez si l’article doit être réintégré dans le stock vendable ou mis en quarantaine pour renvoi au fournisseur.',
      'Choisissez le mode de compensation : remboursement immédiat en espèces, avoir pour un prochain achat ou échange.',
      'Validez : le stock se met à jour et un document officiel de retour est généré.',
    ],
    stepsEn: [
      'Navigate to "Sales & Cash" > "Returns".',
      'Click "+ New Return" and find the original sale via receipt number or customer name.',
      'Select the returned item and specify quantity.',
      'Choose reason: "Defective item", "Wrong size / color", "Customer change of mind".',
      'Select whether the item is returned to sellable inventory or quarantined for supplier repair.',
      'Select compensation: cash refund, customer credit voucher or direct exchange.',
      'Confirm: inventory adjusts automatically and an official credit slip is generated.',
    ],
    exampleFr: 'Exemple : Une cliente ramène une chemise trop petite d’une valeur de 10 000 XOF. Vous effectuez un retour : la chemise retourne en stock magasin et vous lui délivrez un avoir de 10 000 XOF qu’elle utilise aussitôt pour acheter la taille supérieure.',
    exampleEn: 'Example: A customer returns an undersized shirt worth 10,000 XOF. You record the return: the shirt returns to stock and you issue a 10,000 XOF credit voucher used to purchase the right size.',
    tipsFr: 'Rassurant : Les retours sont toujours reliés à la vente d’origine. Impossible d’enregistrer un faux retour pour soutirer de l’argent.',
    tipsEn: 'Fraud prevention: Returns must reference an authentic past sale. Fictitious returns cannot be forged.',
  },
  {
    id: 'backups-portability',
    categoryFr: 'Sécurité & Données',
    categoryEn: 'Security & Backup',
    icon: '💾',
    titleFr: '12. Sauvegardes, Exportation Complète de vos Données & Sécurité',
    titleEn: '12. Backups, Full Data Portability & Data Ownership',
    summaryFr: 'Télécharger une copie intégrale de toutes vos données sur votre ordinateur à tout moment.',
    summaryEn: 'Download a complete copy of all your business data to your computer at any time.',
    goalFr: 'Garantir que vous restez le seul et unique propriétaire de vos données commerciales, même en cas de départ.',
    goalEn: 'Ensure you remain the 100% exclusive owner of your data, with complete portability.',
    stepsFr: [
      'Allez dans le menu « Paramètres » > « Configuration ».',
      'Faites défiler jusqu’à la section « Portabilité & Sauvegarde des Données ».',
      'Vous disposez de deux formats de téléchargement direct :',
      '1. Format JSON : idéal pour intégrer vos données dans un autre logiciel ou les consulter sur ordinateur.',
      '2. Format SQL PostgreSQL : sauvegarde intégrale de votre base de données prête à être restaurée sur n’importe quel serveur privé PostgreSQL.',
      'Cliquez sur « Exporter toutes les données » : le fichier se télécharge directement sur votre disque dur.',
      'Cette archive contient tous vos clients, votre catalogue, vos stocks, vos dépenses, vos factures et vos règlements.',
    ],
    stepsEn: [
      'Go to "Settings" > "Configuration".',
      'Scroll to "Data Portability & Backup".',
      'Two direct download formats are available:',
      '1. JSON Format: ideal for spreadsheet tools or custom data integrations.',
      '2. Standalone PostgreSQL SQL Format: full database dump ready to restore on any private PostgreSQL database server.',
      'Click "Export All Data": the archive downloads directly to your local computer.',
      'The file includes all customers, products, stock levels, expenses, sales and ledger entries.',
    ],
    exampleFr: 'Garantie de liberté : Si vous décidez un jour de changer de système ou d’installer votre propre serveur privé, vous ne perdez rien. Vous cliquez sur Télécharger SQL et vous repartez avec 100% de votre historique sans payer de frais de sortie.',
    exampleEn: 'Zero lock-in guarantee: If you ever migrate to another platform or private server, you lose zero data. Download SQL and take 100% of your business history with you.',
    tipsFr: 'Conseil de sécurité : Téléchargez une sauvegarde de vos données une fois par mois sur une clé USB ou un disque externe pour votre tranquillité.',
    tipsEn: 'Security tip: Download a local copy of your data once a month onto an external drive for ultimate peace of mind.',
  },
];


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
      'Module d\'atelier et prestations pour réparations sans bloquer le stock',
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
      '[00:00:18.200] Profitez de la caisse tactile rapide, de la rentabilité exacte par produit et d\'un atelier complet pour vos prestations de services.',
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
      '[00:00:26.100] Créez vos boutiques de vente et vos entrepôts de stockage. Épisode suivant : la recherche d\'articles et la consultation des stocks !',
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
      'Raccourci universel Ctrl + K disponible depuis n\'importe quel écran',
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
      '[00:00:00.000] Tutoriel VTM : Recherche d\'articles et consultation des stocks. Trouvez n\'importe quelle référence en moins de cinquante millisecondes.',
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
      'Garde-fou anti-survente empêchant les erreurs d\'inventaire',
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
      '[00:00:08.400] Ajoutez les articles au panier d\'un simple clic ou scan. Choisissez le moyen de paiement : Espèces, Mobile Money, Carte ou Crédit client.',
      '[00:00:17.200] Le système contrôle les quantités disponibles et empêche les ventes en rupture non autorisées.',
      '[00:00:25.800] Validez la transaction : le reçu certifié s\'affiche instantanément pour impression. Épisode suivant : la gestion des prestations et ateliers !',
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
      'Facturation directe regroupant main-d\'œuvre et pièces utilisées',
    ],
    keyPointsEn: [
      'Creation and tracking of repair orders with clear diagnostic notes',
      'Technician assignment and labor tracking',
      'Automatic spare parts stock consumption from depot',
      'Consolidated final invoicing with labor and parts breakdown',
    ],
    transcriptionFr: [
      '[00:00:00.000] Tutoriel VTM : Prestations et Services d\'Atelier. Gérez vos réparations et interventions sans bloquer vos services par un stock inexistant.',
      '[00:00:09.100] Créez un dossier client, indiquez le diagnostic et affectez un technicien. Ajoutez les heures de main-d\'œuvre et les pièces nécessaires.',
      '[00:00:18.000] Les pièces détachées consommées sont automatiquement décrémentées du stock physique et valorisées à leur coût d\'achat exact.',
      '[00:00:26.800] Une fois l\'intervention achevée, facturez le dossier en un clic. Épisode suivant : le suivi des dépenses d\'exploitation !',
    ],
  },
  {
    id: 'VTM_06_Depenses_Et_Tresorerie_FR',
    episode: 6,
    titleFr: '6. Dépenses d\'Exploitation & Trésorerie',
    titleEn: '6. Operational Expenses & Cash Management',
    secTitleFr: 'Charges courantes, justificatifs, réconciliation caisse et validation gérant',
    secTitleEn: 'Operating costs, attachments, cash reconciliation and manager approval',
    duration: '35s',
    categoryFr: 'Comptabilité',
    categoryEn: 'Expenses',
    badge: 'Épisode 6 • Dépenses (35s)',
    summaryFr: 'Maîtrisez les dépenses de votre boutique : enregistrez loyers et factures, joignez le justificatif, réconciliez les espèces et appliquez le circuit d\'approbation.',
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
      '[00:00:17.300] Au-delà de cinq cent mille Francs CFA, un circuit d\'approbation gérant se déclenche pour sécuriser vos décaissements.',
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
      'Journal d\'audit immuable (append-only) infalsifiable',
      'Alertes préventives anti-rupture avec seuils de commande automatiques',
      'Bordereaux de transfert formalisés avec statut « en transit »',
      'Valorisation de l\'inventaire au Coût Moyen Unitaire Pondéré (CMUP)',
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
      '[00:00:17.400] Transférez facilement des marchandises d\'un entrepôt vers une boutique avec suivi rigoureux des quantités en transit.',
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
      'Règle stricte Meta : relances d\'impayés formellement interdites sur WhatsApp, autorisées par SMS et Email',
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
      '[00:00:17.500] Pour vos relances, privilégiez l\'Email ou le SMS. Rappel strict : les relances d\'impayés sont formellement bloquées sur WhatsApp selon la politique Meta.',
      '[00:00:26.800] Félicitations ! Vous maîtrisez désormais les fonctionnalités fondamentales du Gestionnaire SaaS VTM — ViralTech Market.',
    ],
  },
];

export function HelpCenterPage() {
  const { profile } = useAuth();
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [activeTab, setActiveTab] = useState<'videos' | 'guides'>('videos');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('VTM_01_Presentation_Generale_FR');
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>('setup-store');
  const [learningProgress, setLearningProgress] = useState<Record<string, { completed: boolean; step: number }>>({});
  const [supportAvailability, setSupportAvailability] = useState<any>(null);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<any[]>('/learning/progress').catch(() => []),
      api.get<any>('/support/availability').catch(() => null),
      api.get<any[]>('/support/tickets').catch(() => []),
    ]).then(([progress, availability, tickets]) => {
      if (!active) return;
      setLearningProgress(Object.fromEntries(progress.map((row) => [row.guideKey, row.progress])));
      setSupportAvailability(availability);
      setSupportTickets(tickets);
    });
    return () => { active = false; };
  }, []);

  const saveLearningProgress = async (guideKey: string, completed: boolean, step = 0) => {
    try {
      await api.put(`/learning/progress/${encodeURIComponent(guideKey)}`, { completed, step });
      setLearningProgress((previous) => ({ ...previous, [guideKey]: { completed, step } }));
    } catch (error) {
      setSupportError(error instanceof ApiError ? error.message : 'La progression ne peut pas être enregistrée.');
    }
  };

  const submitSupportTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittingTicket(true);
    setSupportError(null);
    try {
      const created = await api.post<any>('/support/tickets', { subject: ticketSubject, message: ticketMessage });
      setSupportTickets((current) => [created, ...current]);
      setTicketSubject('');
      setTicketMessage('');
    } catch (error) { setSupportError(error instanceof ApiError ? error.message : 'Impossible de déposer votre demande.'); }
    finally { setSubmittingTicket(false); }
  };

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

      const roleAliases: Record<string, NonNullable<DetailedGuide['roles']>[number]> = { OWNER: 'MANAGER', DIRECTOR: 'MANAGER', ADMIN: 'MANAGER', MANAGER: 'MANAGER', CASHIER: 'CASHIER', STOCK_MANAGER: 'WAREHOUSE', WAREHOUSE: 'WAREHOUSE', ACCOUNTANT: 'ACCOUNTANT', TECH: 'TECH' };
      const effectiveRole = selectedRole === 'ALL' ? roleAliases[profile?.role?.toUpperCase() ?? ''] : selectedRole;
      const matchesRole =
        !g.roles ||
        !effectiveRole ||
        g.roles.includes(effectiveRole as any);
      const requiredModule = GUIDE_MODULES[g.id];
      const matchesModule = !requiredModule || profile?.enabledModules?.includes(requiredModule) !== false;

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

      return matchesCat && matchesRole && matchesSearch && matchesModule;
    });
  }, [lang, search, selectedCategory, selectedRole, profile?.role, profile?.enabledModules]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const g of EXTENSIVE_GUIDES) {
      set.add(lang === 'fr' ? g.categoryFr : g.categoryEn);
    }
    return Array.from(set);
  }, [lang]);
  const starterJourney = STARTER_JOURNEY.filter((step) => !step.module || profile?.enabledModules?.includes(step.module) !== false);

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

      {/* Bannière Officielle : Formation Incluse & Support Dédié */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '1.25rem 1.75rem',
          marginBottom: '1.5rem',
          border: '1px solid #4338ca',
          boxShadow: '0 4px 15px rgba(49, 46, 129, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div style={{ maxWidth: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <span style={{ background: '#4f46e5', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
              OFFRE COMMERCIALE VTM
            </span>
            <span style={{ fontSize: '0.85rem', color: '#c7d2fe', fontWeight: 600 }}>
              🎓 Formation complète incluse pour 1 personne référente {profile?.organizationName ? `• ${profile.organizationName}` : ''}
            </span>
          </div>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
            Accompagnement & Prise en Main Assistée pour votre Équipe
          </h3>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#e0e7ff', lineHeight: 1.5 }}>
            Chaque organisation bénéficie d'une session de formation personnalisée pour 1 personne référente (en présentiel à notre agence de Ouagadougou ou en visioconférence), couvrant le paramétrage, la caisse, les stocks et la clôture comptable.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 240 }}>
          <a
            href="https://wa.me/22672744595"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: '#22c55e',
              color: '#ffffff',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.88rem',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
            }}
          >
            <span>💬</span>
            <span>WhatsApp : +226 72 74 45 95</span>
          </a>
          <div style={{ fontSize: '0.75rem', color: '#c7d2fe', textAlign: 'center' }}>
            📍 Ouagadougou, quartier Tampouy, vers collège Ave Maria
          </div>
        </div>
      </div>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 6px' }}>Assistance et suivi des demandes</h2>
        <p style={{ color: '#64748b', marginTop: 0 }}>{supportAvailability?.message ?? 'Horaires : tous les jours, 09h00–21h00, Africa/Ouagadougou. Les demandes peuvent être déposées à tout moment.'}</p>
        <form onSubmit={(event) => void submitSupportTicket(event)} style={{ display: 'grid', gap: 8, maxWidth: 760 }}>
          <input required minLength={4} maxLength={180} value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} placeholder="Sujet de votre demande" aria-label="Sujet" />
          <textarea required minLength={10} maxLength={10000} rows={4} value={ticketMessage} onChange={(event) => setTicketMessage(event.target.value)} placeholder="Décrivez le problème, les étapes réalisées et le résultat attendu." aria-label="Message" />
          <button disabled={submittingTicket} className="btn btn-primary" style={{ justifySelf: 'start' }}>{submittingTicket ? 'Envoi…' : 'Déposer la demande'}</button>
          {supportError && <div role="alert" style={{ color: '#b91c1c' }}>{supportError}</div>}
        </form>
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          {supportTickets.map((ticket) => <article key={ticket.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
            <strong>{ticket.subject}</strong> · <span>{ticket.status === 'ANSWERED' ? 'Répondu' : 'En attente'}</span>
            <div style={{ color: '#64748b', fontSize: 13 }}>{new Date(ticket.createdAt).toLocaleString('fr-FR')}</div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.message}</p>
            {ticket.supportResponse && <div style={{ background: '#f0fdfa', padding: 10, borderRadius: 6 }}><strong>Réponse de l’assistance</strong><p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{ticket.supportResponse}</p></div>}
          </article>)}
          {supportTickets.length === 0 && <small style={{ color: '#94a3b8' }}>L’historique de vos demandes apparaîtra ici.</small>}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 6px' }}>Parcours de première utilisation</h2>
        <p style={{ color: '#64748b' }}>Cochez les étapes terminées. Votre progression est enregistrée sur votre compte et reprend après reconnexion. Les étapes de modules désactivés sont masquées.</p>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>{starterJourney.filter((step) => learningProgress[`first-use.${step.key}`]?.completed).length} / {starterJourney.length} étapes terminées</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {starterJourney.map((step, index) => {
            const key = `first-use.${step.key}`;
            const done = Boolean(learningProgress[key]?.completed);
            return <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 9, borderRadius: 8, background: done ? '#f0fdf4' : '#f8fafc' }}>
              <input type="checkbox" checked={done} onChange={(event) => void saveLearningProgress(key, event.target.checked, index + 1)} />
              <span>{index + 1}. {step.label}</span>
            </label>;
          })}
        </div>
      </section>

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
                  onClick={() => { void saveLearningProgress(selectedVideo.id, true, 1); setSelectedVideoId(nextVideo.id); }}
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
              <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => void saveLearningProgress(selectedVideo.id, true, 1)}>
                {learningProgress[selectedVideo.id]?.completed ? 'Épisode terminé ✓' : 'Marquer cet épisode comme terminé'}
              </button>

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
                      onClick={() => { setSelectedVideoId(video.id); void saveLearningProgress(video.id, false, Math.max(1, learningProgress[video.id]?.step ?? 0)); }}
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
                        {learningProgress[video.id]?.completed && <span style={{ color: '#15803d', fontSize: 12, fontWeight: 700 }}>Terminé ✓</span>}
                        {learningProgress[video.id]?.completed && <span style={{ color: '#15803d', fontSize: 12, fontWeight: 700 }}>Terminé ✓</span>}
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

            {/* Filtre par Profil Métier / Rôle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '0.25rem', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                {lang === 'fr' ? '🎯 Guides ciblés par rôle métier :' : '🎯 Guides targeted by business role:'}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', labelFr: 'Tous les profils', labelEn: 'All Profiles', icon: '👥' },
                  { key: 'CASHIER', labelFr: 'Caissier / Vendeur', labelEn: 'Cashier / Sales', icon: '🛒' },
                  { key: 'WAREHOUSE', labelFr: 'Magasinier / Stocks', labelEn: 'Warehouse / Stock', icon: '📦' },
                  { key: 'MANAGER', labelFr: 'Gérant / Propriétaire', labelEn: 'Manager / Owner', icon: '👔' },
                  { key: 'ACCOUNTANT', labelFr: 'Comptable / Finance', labelEn: 'Accountant / Finance', icon: '📊' },
                  { key: 'TECH', labelFr: 'Technicien / SAV', labelEn: 'Technician / Repair', icon: '🛠️' },
                ].map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelectedRole(r.key)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: selectedRole === r.key ? '1px solid #4338ca' : '1px solid #cbd5e1',
                      background: selectedRole === r.key ? '#4338ca' : '#f8fafc',
                      color: selectedRole === r.key ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <span>{r.icon}</span>
                    <span>{lang === 'fr' ? r.labelFr : r.labelEn}</span>
                  </button>
                ))}
              </div>
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
                      onClick={() => { setExpandedId(isExpanded ? null : guide.id); if (!isExpanded) void saveLearningProgress(guide.id, false, Math.max(1, learningProgress[guide.id]?.step ?? 0)); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setExpandedId(isExpanded ? null : guide.id);
                          if (!isExpanded) void saveLearningProgress(guide.id, false, Math.max(1, learningProgress[guide.id]?.step ?? 0));
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
                        <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => void saveLearningProgress(guide.id, true, steps.length)}>
                          {learningProgress[guide.id]?.completed ? 'Guide terminé ✓' : 'Marquer ce guide comme terminé'}
                        </button>
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

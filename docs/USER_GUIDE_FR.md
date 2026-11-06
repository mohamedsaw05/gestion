# MANUEL DE FORMATION & GUIDE OFFICIEL VTM — VIRALTECH MARKET
## Cours Complet d'Exploitation du Gestionnaire Commercial Universel SaaS
**Version du Système** : 2.5 Multi-Tenant & Multi-Pays  
**Public Cible** : Propriétaires d'entreprise, Gérants, Comptables, Chefs de caisse, Vendeurs et Magasiniers  
**Périmètre** : Caisse POS, Facturation A4 (10 modèles), Reçus thermiques (10 modèles 58/80mm), Décharges (15 modèles), Stocks & CUMP, Crédits & 3 Réinitialisations  

---

## Sommaire Général du Cours

- [Module 1 : Architecture Fondamentale & Philosophie Zéro Blocage](#module-1--architecture-fondamentale--philosophie-zéro-blocage)
- [Module 2 : Identité de l'Entreprise, Coordonnées Légales & Multi-Pays](#module-2--identité-de-lentreprise-coordonnées-légales--multi-pays)
- [Module 3 : Logos d'Entreprise, En-têtes et Pieds de Page Personnalisés](#module-3--logos-dentreprise-en-têtes-et-pieds-de-page-personnalisés)
- [Module 4 : Les 10 Modèles de Factures Commerciales Homologuées](#module-4--les-10-modèles-de-factures-commerciales-homologuées)
- [Module 5 : Les 10 Modèles de Reçus Thermiques & Outils d'Impression (58/80mm)](#module-5--les-10-modèles-de-reçus-thermiques--outils-dimpression-5880mm)
- [Module 6 : Workflow d'Encaissement & Modal Post-Vente (Facture, Reçu, WhatsApp)](#module-6--workflow-dencaissement--modal-post-vente-facture-reçu-whatsapp)
- [Module 7 : Module de Décharges Légales (15 Modèles Juridiques Sélectionnables)](#module-7--module-de-décharges-légales-15-modèles-juridiques-sélectionnables)
- [Module 8 : Catalogue des Articles, Conditionnements (Cartons/Pièces) & Sélection Massive](#module-8--catalogue-des-articles-conditionnements-cartonspièces--sélection-massive)
- [Module 9 : Valorisation des Stocks (CUMP / FIFO) & Traçabilité par Lots](#module-9--valorisation-des-stocks-cump--fifo--traçabilité-par-lots)
- [Module 10 : Gestion des Crédits Clients, Plafonds de Risque & Recouvrement](#module-10--gestion-des-crédits-clients-plafonds-de-risque--recouvrement)
- [Module 11 : Dépenses d'Exploitation & Clôture de Caisse Quotidienne](#module-11--dépenses-dexploitation--clôture-de-caisse-quotidienne)
- [Module 12 : Sauvegardes, Export RGPD & Les 3 Niveaux de Réinitialisation](#module-12--sauvegardes-export-rgpd--les-3-niveaux-de-réinitialisation)
- [Module 13 : Administration Centrale (SuperAdmin) & Événements Festifs Passifs](#module-13--administration-centrale-superadmin--événements-festifs-passifs)
- [Module 14 : Guide des Raccourcis Clavier, Maintenance & Dépannage Caisse](#module-14--guide-des-raccourcis-clavier-maintenance--dépannage-caisse)

---

# Module 1 : Architecture Fondamentale & Philosophie Zéro Blocage

### 1.1 Qu'est-ce que le Gestionnaire VTM ?
Le gestionnaire **VTM (ViralTech Market)** est un progiciel de gestion intégrée (ERP/POS) moderne, multilocataire et multidevise. Il est spécialement bâti pour les entreprises commerciales d'Afrique et de l'international, alliant simplicité d'utilisation sur écran tactile et rigueur comptable internationale.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SCHÉMA GLOBAL DE L'ÉCOSYSTÈME VTM                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   [ADMIN PRINCIPALE / PROPRIÉTAIRE]           [GESTIONNAIRE BOUTIQUE CLIENT] │
│          (apps/admin)                                (apps/client)           │
│   • Gestion globale des abonnements           • Caisse enregistreuse POS     │
│   • Activation centrale événements            • Factures (10 modèles A4)     │
│   • Roue des offres & cadeaux                 • Reçus (10 modèles 58/80mm)   │
│   • Supervision des quotas                    • Décharges (15 modèles)       │
│                │                               • Stocks & Inventaires        │
│                ▼                               • Suivi des Crédits & Clients │
│   ┌─────────────────────────────┐                            │               │
│   │   SERVEUR API CENTRALISÉ    │◄───────────────────────────┘               │
│   │   (Base de Données SQLite)  │                                            │
│   └─────────────────────────────┘                                            │
│                ▲                                                             │
│                │                                                             │
│   ┌─────────────────────────────┐                                            │
│   │  MOTEUR D'IMPRESSION & ESC  │ ──► [Tickets 58mm / 80mm / Factures A4]    │
│   │  PASSERELLE WHATSAPP CLOUD  │ ──► [Expédition directe sur mobile client] │
│   └─────────────────────────────┘                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 La Règle d'Or « Zéro Blocage Commercial »
Dans un commerce physique, chaque seconde compte. Une file d'attente ne doit jamais s'allonger à cause d'une panne réseau, d'une modale intrusive ou d'une validation superflue.
1. **Mode Hors Ligne Automatique :** En cas de coupure Internet, les ventes continuent en local et se synchronisent dès le retour de la connexion.
2. **Événements Festifs Non Intrusifs :** Les animations saisonnières (Noël, Nouvel An) sont activées uniquement depuis la console propriétaire centrale. Elles restent purement visuelles en arrière-plan sans bloquer la caisse.
3. **Touches d'Accès Immédiat :** La touche `Échap` ferme tout panneau, et `Ctrl + K` ouvre immédiatement la recherche globale de produits.

---

# Module 2 : Identité de l'Entreprise, Coordonnées Légales & Multi-Pays

### 2.1 Configuration de l'Identité dans Paramètres > Marque
Pour accéder à cette section : Cliquez sur **Paramètres** dans le menu de gauche, puis sélectionnez l'onglet **🎨 Marque & Identité**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CAPTURE D'ÉCRAN — ONGLET MARQUE & IDENTITÉ OFFICIELLE                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ Nom de l'entreprise * (Obligatoire) :                                        │
│ [ VTM Commerce & Négoce SARL                                              ]  │
│                                                                              │
│ Date de création (Optionnel) :        N° IFU / NIF (Affiché sur facture) :   │
│ [ 2024-01-15             ]            [ 0012345678A                       ]  │
│                                                                              │
│ N° RCCM (Affiché sur facture) :       Email commercial :                     │
│ [ BF-OUA-01-2024-B12-0045]            [ contact@vtm-commerce.com          ]  │
│                                                                              │
│ Pays d'activité & Devise :            Téléphone de contact (WhatsApp) :      │
│ [ 🇧🇫 Burkina Faso (+226) - FCFA ⌵ ]    [ +226 70 12 34 56                  ]  │
│  Format exigé : 8 chiffres (XX XX XX XX)                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Règles Strictes des Champs Légaux :
1. **Nom commercial / Raison sociale :** Champ obligatoire. Ce nom s'affiche en grand en tête de tous les documents émis (factures, devis, reçus, décharges, bons de livraison).
2. **Date de création de l'entreprise :** Champ facultatif permettant d'établir l'ancienneté commerciale.
3. **Numéro IFU (Identifiant Fiscal Unique) / NIF :** S'il est renseigné, il apparaît automatiquement sous le nom de l'entreprise sur chaque facture commerciale et reçu fiscal, garantissant la conformité avec la Direction Générale des Impôts.
4. **Numéro RCCM (Registre du Commerce et du Crédit Mobilier) :** S'il est renseigné, il est inscrit dans les mentions légales de pied de facture.

### 2.3 Prise en Charge des 11 Pays (Drapeaux, Devises et Masques Téléphoniques)
Le gestionnaire VTM intègre nativement 11 pays : le Burkina Faso (obligatoire et par défaut) + 5 pays d'Afrique subsaharienne + 5 pays d'Europe, d'Asie et des Amériques.

| Drapeau | Pays | Indicatif | Chiffres | Masque de Saisie | Devise Officielle |
|:---:|:---|:---:|:---:|:---|:---:|
| 🇧🇫 | **Burkina Faso** (Par défaut) | `+226` | 8 chiffres | `XX XX XX XX` | FCFA (XOF) |
| 🇨🇮 | **Côte d'Ivoire** | `+225` | 10 chiffres | `XX XX XX XX XX` | FCFA (XOF) |
| 🇸🇳 | **Sénégal** | `+221` | 9 chiffres | `XX XXX XX XX` | FCFA (XOF) |
| 🇲🇱 | **Mali** | `+223` | 8 chiffres | `XX XX XX XX` | FCFA (XOF) |
| 🇹🇬 | **Togo** | `+228` | 8 chiffres | `XX XX XX XX` | FCFA (XOF) |
| 🇧🇯 | **Bénin** | `+229` | 8 chiffres | `XX XX XX XX` | FCFA (XOF) |
| 🇫🇷 | **France** | `+33` | 9 chiffres | `X XX XX XX XX` | Euro (€) |
| 🇺🇸 | **USA & Canada** | `+1` | 10 chiffres | `XXX XXX-XXXX` | Dollar ($) |
| 🇦🇪 | **Émirats Arabes Unis** | `+971` | 9 chiffres | `XX XXX XXXX` | Dirham (AED) |
| 🇨🇳 | **Chine** | `+86` | 11 chiffres | `XXX XXXX XXXX` | Yuan (¥) |
| 🇧🇪 | **Belgique** | `+32` | 9 chiffres | `XXX XX XX XX` | Euro (€) |

---

# Module 3 : Logos d'Entreprise, En-têtes et Pieds de Page Personnalisés

### 3.1 Règle d'Héritage du Logo Principal
Lorsqu'un commerçant téléverse son logo officiel dans l'onglet **Marque & Identité** :
- **Comportement par défaut :** Ce logo devient immédiatement le logo officiel visible en haut à gauche du gestionnaire, ainsi que le logo imprimé sur tous les reçus de caisse et toutes les factures A4.
- **Formats supportés :** PNG transparent, JPEG haute résolution, WebP, SVG vectoriel (taille maximale recommandée : 2 Mo).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HÉRITAGE AUTOMATIQUE DU LOGO OFFICIEL                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│       [ 🎨 LOGO PRINCIPAL ENTREPRISE ]                                      │
│                        │                                                     │
│       ┌────────────────┼────────────────┐                                    │
│       ▼                ▼                ▼                                    │
│  [Navigation App]  [Facture A4]   [Tickets 58/80mm]                          │
│                                                                              │
│  Surcharges Spécifiques Possibles :                                          │
│  • En-tête Facture : Logo personnalisé alternatif                            │
│  • Pied de Facture : Cachet / Signature / Certification officielle           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Surcharges Indépendantes pour la Facture Commerciale
Si l'entreprise souhaite utiliser un logo textuel horizontal pour sa facture ou insérer un cachet certifié en pied de page :
1. Dans la boîte de droite de l'onglet **Marque**, repérez la section **Logos spécifiques Facture**.
2. **En-tête de facture :** Cliquez sur *Modifier en-tête* pour téléverser une variante (ex : logo avec slogan ou coordonnées complètes intégrées).
3. **Pied de page de facture :** Cliquez sur *Modifier pied* pour ajouter le tampon encreur officiel, le visa de conformité ou le logo d'une norme de qualité (ISO, label national).
4. Pour revenir au logo général, il suffit de supprimer l'image spécifique.

---

# Module 4 : Les 10 Modèles de Factures Commerciales Homologuées

Dans **Paramètres** > **Modèles Factures & Reçus**, l'organisation peut choisir parmi **10 modèles de factures A4 professionnelles** adaptées à chaque corps de métier :

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ LES 10 MODÈLES DE FACTURES A4 DISPONIBLES                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1. Standard Pro VTM       - Facture d'entreprise claire, universelle         │
│ 2. Minimaliste Moderne    - Lignes épurées noir & blanc, design suisse       │
│ 3. Facture B2B Corporate  - SKU, TVA détaillée, N° IFU & RCCM en évidence    │
│ 4. Prestige & Élégance    - Accents dorés, typographie haut de gamme         │
│ 5. Tech & Digital SaaS    - Bordures indigo/cyan, badges d'état et QR Code   │
│ 6. Atelier & Services     - Main-d'œuvre horaire, pièces et garanties        │
│ 7. Grossiste & Colisage   - Nombre de cartons, colisage et remises volume    │
│ 8. Éco & Artisanat        - Teintes naturelles, mise en avant terroir/local  │
│ 9. Bandeau Plein Coloré   - En-tête coloré impactant avec identité visuelle  │
│ 10. Proforma & Export     - Mention Proforma, conversion devises & validité  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Description Détaillée des Modèles :
1. **Standard Pro VTM :** Le modèle par défaut. Idéal pour quincailleries, supérettes, boutiques de pièces et commerces généraux. Présente les lignes avec désignation, prix unitaire, quantité et total.
2. **Minimaliste Moderne :** Modèle très épuré en noir et blanc, particulièrement apprécié des agences de communication, cabinets de conseil, architectes et boutiques design.
3. **B2B Corporate :** Conçu pour les transactions entre entreprises. Affiche en première ligne les mentions fiscales obligatoires (IFU, RCCM, NIF), la ventilation des taxes (TVA, prélèvements) et les coordonnées bancaires pour virement.
4. **Prestige & Élégance :** Présentation raffinée pour parfumeries de luxe, boutiques de prêt-à-porter de marque, bijouteries et horlogeries.
5. **Tech & Digital SaaS :** Optimisé pour les entreprises de télécoms, vente de matériel informatique et prestataires informatiques avec QR Code de paiement et de vérification.
6. **Atelier & Prestations :** Découpe la facture en deux sections distinctes : *Fournitures / Pièces détachées* et *Main-d'œuvre & Réparations*, avec mentions d'exclusion de garantie technique.
7. **Grossiste & Colisage :** Affiche les quantités en cartons, les sous-unités par carton, les remises au volume et les frais de transport/chargement.
8. **Éco & Artisanat :** Ambiance vert sauge valorisant les créateurs, producteurs locaux, coopératives agricoles et cosmétiques bio.
9. **Bandeau Plein Coloré :** Bloc supérieur teinté reprenant la couleur primaire de l'entreprise pour un impact visuel mémorable.
10. **Proforma & Export :** Mention officielle « FACTURE PROFORMA » avec conditions d'embarquement (Incoterms), validité du devis et mentions douanières.

---

# Module 5 : Les 10 Modèles de Reçus Thermiques & Outils d'Impression (58/80mm)

### 5.1 Les 10 Modèles de Reçus et Tickets de Caisse
Pour les tickets de caisse remis aux clients au comptoir, 10 modèles spécialisés sont disponibles :

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ LES 10 THÈMES DE REÇUS DE CAISSE THERMIQUE                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1. Ticket Thermique 80mm Standard - Grand rouleau classique, logo centré     │
│ 2. Ticket Thermique 58mm Éco      - Format compact imprimante de poche       │
│ 3. Reçu avec QR Code de Suivi     - Reçu moderne avec vérification en ligne  │
│ 4. Reçu Boutique Prestige         - Police fine élégante et encadrement      │
│ 5. Addition Restauration / Bar    - N° de table, serveur, détail boissons    │
│ 6. Reçu avec Coupon de Remise     - Code promo détachable pour fidélisation  │
│ 7. Reçu SAV & Dépôt Réparation    - Code retrait et état initial du matériel │
│ 8. Reçu d'Acompte / Crédit        - Acompte versé, reste dû et échéance      │
│ 9. E-Ticket Digital WhatsApp      - Format mobile vertical pour capture nette│
│ 10. Reçu avec Souche Échange      - Double coupon sans prix pour les cadeaux │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Adaptation aux Machines et Imprimantes de Caisse
Le gestionnaire VTM pilote les imprimantes matérielles sans pilotes complexes :
- **Imprimantes Thermiques ESC/POS 80 mm :** Modèles de comptoir USB, Série ou Réseau Ethernet (Epson TM-T20, Star Micronics, Xprinter, Bixolon, Munbyn).
- **Imprimantes Thermiques ESC/POS 58 mm :** Modèles ultra-compacts de poche ou terminaux de livraison sans fil Bluetooth.
- **Imprimantes Standard A4 :** Imprimantes jet d'encre ou laser pour reçus pleine page et factures comptables.
- **Tiroir-Caisse Automatique :** Le système envoie l'impulsion d'ouverture automatique du tiroir-caisse (`ESC p`) dès la validation de l'encaissement en espèces.

---

# Module 6 : Workflow d'Encaissement & Modal Post-Vente (Facture, Reçu, WhatsApp)

### 6.1 Déroulement d'une Vente au Comptoir
1. Accédez à l'écran de caisse en cliquant sur **Vente** ou `Ctrl + K`.
2. Scannez le code-barres avec votre douchette ou saisissez les premières lettres de l'article.
3. Modifiez la quantité avec `+` ou `-`.
4. Sélectionnez le mode de règlement (Espèces, Mobile Money, Carte Bancaire, Virement, Chèque ou Crédit).
5. Cliquez sur **Valider la Vente**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MODAL AUTOMATIQUE POST-VENTE (APPRÈS VALIDATION)                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                             VENTE EFFECTUÉE AVEC SUCCÈS                      │
│                               Montant : 45 000 FCFA                          │
│                                                                              │
│   Que souhaite le client pour cette transaction ?                            │
│                                                                              │
│   ┌────────────────────┐  ┌────────────────────┐  ┌───────────────────────┐  │
│   │  🧾 REÇU DE CAISSE │  │  📄 FACTURE COMM.  │  │  📋 LES DEUX          │  │
│   │  (Thermique 80mm)  │  │  (Feuille A4 Pro)  │  │  (Reçu + Facture A4)  │  │
│   └────────────────────┘  └────────────────────┘  └───────────────────────┘  │
│                                                                              │
│   Options Immédiates :                                                       │
│   [ 🖨️ Imprimer Directement ]     [ 📥 Télécharger le PDF ]                  │
│                                                                              │
│   📱 Expédier le reçu au client par WhatsApp :                               │
│   Pays : [ 🇧🇫 +226 ⌵ ]   Numéro : [ 70 12 34 56        ]                     │
│   [ 💬 Envoyer sur WhatsApp en 1 Clic ]                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Les Trois Choix Possibles :
- **Reçu de caisse :** Génère le ticket thermique optimisé pour imprimante POS (58 mm ou 80 mm).
- **Facture commerciale :** Génère la pièce comptable A4 homologuée avec toutes les mentions d'IFU, de RCCM et de ventilation des taxes.
- **Les Deux :** Imprime le ticket de caisse immédiat pour le client et prépare la facture officielle pour sa comptabilité.
- **Envoi WhatsApp Direct :** Le caissier clique sur *Envoyer sur WhatsApp*, ce qui ouvre instantanément une discussion pré-formatée avec le récapitulatif complet de la commande et le lien de téléchargement direct.

---

# Module 7 : Module de Décharges Légales (15 Modèles Juridiques Sélectionnables)

Dans de nombreuses activités (réparation de téléphones, rachat de matériel d'occasion, prêt d'outils, retours sans facture), une simple facture ne suffit pas : il faut une **décharge de responsabilité juridique**.
VTM intègre une section dédiée accessible via `/discharges` (**Décharges & Protocoles**).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APERÇU DU MODULE DE DÉCHARGES JURIDIQUES VTM                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ 15 Modèles Homologués Répartis en 4 Domaines :                               │
│ • ATELIER & SAV        : Dépôt matériel, Risque oxydation, Test écran        │
│ • CAISSE & COMMERCE    : Restitution sans ticket, Rachat occasion, Acompte   │
│ • LOGISTIQUE & STOCKS  : Conformité livraison, Prêt d'outils, Consignation   │
│ • RH & GESTION         : Remise de caisse, Données confidentielles, Véhicule │
│                                                                              │
│ Fonctionnalités Incluses :                                                   │
│ 1. Choix du modèle et définition du modèle par défaut                        │
│ 2. Formulaire dynamique (Nom tiers, N° Pièce CNI/Passeport, Matériel)        │
│ 3. Prévisualisation en direct avec Filigrane officiel « ACTE CERTIFIÉ »      │
│ 4. Double bloc de signatures (Le Remettant / Le Réceptionnaire)              │
│ 5. Impression A4 instantanée & Partage WhatsApp direct                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.1 Inventaire des 15 Modèles de Décharges VTM :
1. **Dépôt Réparation Matériel & Atelier :** Décharge de responsabilité sur les pannes préexistantes lors du dépôt d'un appareil (téléphone, ordinateur, moteur).
2. **Restitution Article sans Ticket :** Attestation sur l'honneur signée par le client pour reprendre ou échanger un produit sans son reçu d'origine.
3. **Prêt d'Équipement ou Outillage :** Engagement d'un technicien ou client à restituer le matériel prêté sous 7 jours en parfait état.
4. **Réception & Conformité Livraison :** Décharge signée par le client attestant que les cartons ont été livrés intacts et complets.
5. **Passation de Caisse & Coffre-Fort :** Procès-verbal contradictoire signé entre le caissier sortant et le caissier entrant.
6. **Rachat d'Article d'Occasion :** Décharge légale certifiant que le vendeur est le propriétaire légitime de l'article revendu.
7. **Dépôt-Vente & Consignation :** Acte de consignation fixant le prix de reversement convenu et les conditions de garde.
8. **Appareil Oxydé ou Non-Allumé :** Décharge critique avertissant le client des risques d'extinction définitive lors de l'ouverture d'un appareil ayant pris l'eau.
9. **Changement d'Écran ou Pièce Sensible :** Décharge technique confirmant le bon fonctionnement du tactile et des caméras avant restitution.
10. **Acompte & Réservation de Marchandise :** Fixation du délai de retrait de 30 jours au-delà duquel l'acompte est acquis à la boutique.
11. **Sortie d'Articles pour Exposition / Salon :** Ordre de mission pour les marchandises sorties temporairement en foire commerciale.
12. **Mise au Rebut / Dépréciation de Stock :** Procès-verbal interne actant la destruction de produits périmés ou cassés.
13. **Engagement de Confidentialité Collaborateur :** Protection des données commerciales, fichiers clients et secrets de prix.
14. **Affectation Véhicule / Engin de Livraison :** État des lieux du véhicule de livraison confié au chauffeur.
15. **Attestation de Solde de Tout Compte Créance :** Quittance finale certifiant qu'un client endetté a intégralement soldé son compte.

---

# Module 8 : Catalogue des Articles, Conditionnements (Cartons/Pièces) & Sélection Massive

### 8.1 Vente par Cartons et Pièces Détachées
VTM permet de gérer les marchandises vendues au carton ou à la pièce unitaire sans créer deux fiches séparées :
- Renseignez le **Nombre de pièces par carton** (ex : 24 pièces).
- Fixez le **Prix de vente du carton** (ex : 24 000 FCFA).
- Le logiciel calcule automatiquement le **Prix de vente unitaire** (1 000 FCFA / pièce).
- Lorsque vous vendez un carton, le stock diminue de 24 pièces en coulisse, maintenant un inventaire toujours exact.

### 8.2 Boutons de Choix Automatique & Sélection Massive
Lorsque votre catalogue compte plus de 100 ou 500 références, cocher manuellement chaque produit devient impossible.
VTM intègre désormais en haut du tableau :
- **⚡ Tout sélectionner (N articles) :** Sélectionne en un clic l'intégralité des articles affichés selon vos filtres actuels.
- **✕ Désélectionner :** Vide instantanément la sélection.
- **📥 Exporter sélection (CSV) :** Exporte uniquement les articles cochés dans un tableur Excel / CSV pour réajustement des prix.

---

# Module 9 : Valorisation des Stocks (CUMP / FIFO) & Traçabilité par Lots

### 9.1 Formule Officielle du Coût Unitaire Moyen Pondéré (CUMP)
À chaque nouvelle commande fournisseur réceptionnée, le coût moyen d'achat est recalculé selon la norme comptable :

$$\text{CUMP} = \frac{(\text{Stock Ancien} \times \text{CUMP Ancien}) + (\text{Quantité Achetée} \times \text{Prix d'Achat Récent})}{\text{Stock Total Après Entrée}}$$

*Exemple pratique :*
- Vous aviez en stock 10 bidons d'huile achetés à 10 000 FCFA (Valeur : 100 000 FCFA).
- Vous recevez 20 nouveaux bidons achetés à 13 000 FCFA (Valeur : 260 000 FCFA).
- Nouveau CUMP = (100 000 + 260 000) / 30 = **12 000 FCFA**.
- Votre marge brute sur chaque vente sera calculée avec précision sur la base de ces 12 000 FCFA.

### 9.2 Suivi des Numéros de Série et Dates de Péremption
- **Lots & Péremptions :** Les articles pharmaceutiques, alimentaires ou chimiques affichent une alerte visuelle orange à J-30 et rouge dès la date de péremption atteinte.
- **Numéros de Série (IMEI) :** Pour les smartphones et l'électroménager, le caissier scanne le numéro de série unique lors de la vente. Ce numéro figure sur la facture pour assurer le suivi de la garantie SAV.

---

# Module 10 : Gestion des Crédits Clients, Plafonds de Risque & Recouvrement

### 10.1 Règles Prudentielles de Crédit
Pour protéger la trésorerie de votre commerce, VTM applique trois gardes-fous :
1. **Client obligatoire pour vente à crédit :** Il est formellement interdit d'accorder un crédit à un client anonyme « Client de passage ».
2. **Plafond d'endettement maximal (Debt Ratio) :** Le système calcule le ratio entre les dettes actuelles du client et ses achats totaux. Si ce ratio dépasse la limite fixée (ex : 30%), la caisse refuse tout nouveau crédit.
3. **Pénalités journalières de retard :** Un taux de pénalité (ex : 0.1% par jour) s'applique automatiquement sur les factures impayées après la date d'échéance.

### 10.2 Relances WhatsApp Bienveillantes
Un clic sur le bouton *Relance WhatsApp* génère un message cordial rappelant le solde dû, la date d'échéance et les moyens de règlement acceptés (Mobile Money, virement, caisse).

---

# Module 11 : Dépenses d'Exploitation & Clôture de Caisse Quotidienne

### 11.1 Enregistrement des Petites Dépenses Quotidiennes
Les sorties d'argent courantes (facture d'électricité, transport de marchandises, achat de café, fournitures de bureau) doivent être enregistrées dans **Finances > Dépenses** :
- Date et montant exact
- Catégorie de dépense
- Mode de paiement (Espèces de la caisse ou Compte bancaire)
- Pièce justificative téléversée (reçu ou facture scannée)

### 11.2 Le Procès-Verbal de Fin de Journée (Ticket Z)
Chaque soir, le caissier procède au comptage physique de sa caisse :
1. Montant théorique calculé par le logiciel = Fond d'ouverture + Ventes en espèces - Dépenses sorties en espèces.
2. Comptage réel des billets et pièces par le caissier.
3. Écart constaté : si l'écart est nul, la caisse est parfaite. Tout écart (positif ou négatif) est consigné avec motif obligatoire.

---

# Module 12 : Sauvegardes, Export RGPD & Les 3 Niveaux de Réinitialisation

Dans **Paramètres** > **Sauvegardes & Données**, VTM propose une flexibilité totale de gestion et de remise à zéro :

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ LES 3 NIVEAUX DE RÉINITIALISATION DANS PARAMÈTRES                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ [ 1. RÉINITIALISER LES PARAMÈTRES PAR DÉFAUT ]                               │
│ • Rétablit les configurations d'usine (Standard Pro, 80mm, Burkina Faso).    │
│ • Conserve intégralement vos produits, vos stocks et vos ventes.             │
│                                                                              │
│ [ 2. RÉINITIALISER UNIQUEMENT LES PRODUITS & LE CATALOGUE ]                  │
│ • Purge la liste des articles et remet les compteurs de stock à zéro.        │
│ • Conserve vos paramètres d'entreprise, logos et coordonnées officielles.    │
│                                                                              │
│ [ 3. RÉINITIALISATION COMPLÈTE DE TOUT LE GESTIONNAIRE ]                     │
│ • Remise à zéro d'usine totale (supprime ventes, dettes, stocks, dépenses).  │
│ • Sécurisé par mot de passe et phrase : REINITIALISER MON GESTIONNAIRE.      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# Module 13 : Administration Centrale (SuperAdmin) & Événements Festifs Passifs

### 13.1 Contrôle Centralisé par le Propriétaire de la Plateforme
Conformément aux directives de sécurité :
- Le système d'événements festifs (Noël, Fêtes de fin d'année, Nouvel An) est **exclusivement administré depuis la console SuperAdmin centrale (`apps/admin`)**.
- Les clients et gérants de boutique dans `apps/client` ne voient aucun paramètre festif perturbateur, aucune roue de loterie encombrante ni aucun formulaire complexe.
- Une fois que le propriétaire active l'événement depuis sa console, une atmosphère passive et élégante (flocons légers ou bandeau de vœux discret) apparaît sans aucune gêne pour le fonctionnement de la caisse.

---

# Module 14 : Guide des Raccourcis Clavier, Maintenance & Dépannage Caisse

| Raccourci Clavier | Action Immédiate | Contexte d'Utilisation |
|:---:|:---|:---|
| **`Ctrl + K`** | Ouvrir la recherche universelle | Recherche d'un article ou client en 1 seconde |
| **`Échap`** | Fermer la modale / Annuler | Sortir immédiatement d'un menu ou écran |
| **`F2`** | Validation rapide de la vente | Encaisser sans toucher à la souris |
| **`F4`** | Basculer en mode Espèces | Règlement au comptant immédiat |
| **`Ctrl + P`** | Imprimer le document actif | Impression du reçu thermique ou de la facture A4 |

### Procédure de Secours Caisse (Coupure Internet ou Panne Machine) :
1. **Imprimante thermique bloquée :** Vérifiez le rouleau thermique (sens de la feuille thermique vers le haut) et le câble USB. Basculez temporairement en mode *Envoi WhatsApp Direct* pour remettre le ticket numérique au client sur son téléphone.
2. **Coupure de courant :** Si la caisse est sur batterie ou smartphone, le mode local enregistre les ventes. Dès le rétablissement du courant, l'ensemble des tickets est archivé automatiquement sur le serveur central.

---

# Module 15 : Guide Pratique d'Importation & Exportation (CSV & TXT)

### 15.1 Pourquoi l'Importation / Exportation Simple ?
Les organisations ont souvent des inventaires existants sur Excel ou d'anciens logiciels. Le gestionnaire VTM intègre une importation et exportation polyvalente acceptant aussi bien les fichiers `.csv` (séparateur virgule ou point-virgule) que les fichiers `.txt` (séparateur tabulation ou virgule).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                  STRUCTURE D'UN FICHIER D'IMPORTATION VTM                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Ligne 1 (En-tête obligatoire) :                                              │
│ name,sku,barcode,price,costPrice,stock                                       │
│                                                                              │
│ Exemples de lignes de produits :                                             │
│ iPhone 15 Pro,IPH15P,19019928374,850000,720000,12                           │
│ Clé USB 64Go,USB-64,78912345678,6500,4000,45                                 │
│ Sac de Riz 25kg,RIZ-25K,654987321,17500,14000,30                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 15.2 Procédure Pas-à-Pas pour Importer :
1. Rendez-vous dans le menu **Catalogue** (`/catalog`).
2. Cliquez sur le bouton bleu **📥 Importer (CSV / TXT)**.
3. Deux possibilités vous sont offertes :
   - **Télécharger un modèle prêt à l'emploi** : Cliquez sur *📥 Télécharger modèle CSV* ou *📄 Télécharger modèle TXT*. Ouvrez-le dans Excel, renseignez vos produits, puis enregistrez.
   - **Glisser-déposer votre fichier** : Cliquez sur le sélecteur de fichier ou collez directement les lignes de texte dans la zone de prévisualisation.
4. Le système analyse les lignes en temps réel et affiche le nombre de produits détectés.
5. Cliquez sur **🚀 Lancer l'importation**. Les articles sont immédiatement intégrés dans votre stock.

### 15.3 Exportation en 1 Clic :
- Pour exporter sous Excel : Cliquez sur **📥 Exporter (CSV)**.
- Pour exporter pour bloc-notes ou logiciel comptable : Cliquez sur **📄 Exporter (TXT)**.

---

# Module 16 : Fournisseurs & Affectation des Produits Approvisionnés

### 16.1 Rôle de l'affectation Fournisseur - Produits
Dans le commerce moderne, un fournisseur précis livre des catégories ou articles spécifiques (ex: un grossiste de boissons ne livre pas des téléphones). Le module **Fournisseurs** (`/suppliers`) permet d'affecter à chaque fournisseur les produits qu'il approvisionne directement depuis votre catalogue existant.

### 16.2 Comment associer des produits à un fournisseur :
1. Allez dans le menu **Fournisseurs** (`/suppliers`).
2. Lors de la création d'un nouveau fournisseur ou sur un fournisseur existant :
   - Cliquez sur le bouton **📦 X article(s) approvisionné(s) ✎** dans la colonne *Articles Approvisionnés*.
3. Une fenêtre dédiée s'ouvre avec la liste de tous vos articles enregistrés et une barre de recherche rapide.
4. Cochez les cases des produits que ce fournisseur vous livre.
5. Cliquez sur **💾 Enregistrer les produits approvisionnés**.
6. **Avantage immédiat** : Lors de la passation de commandes d'approvisionnement (`/orders`), le système filtre automatiquement les articles livrables par ce fournisseur, évitant toute erreur de commande.

---

# Module 17 : Espaces Dédiés Multi-Store & Configuration par Boutique

### 17.1 Une Interface Dédiée pour Chaque Boutique
Le gestionnaire VTM évite les formulaires encombrants mélangeant toutes les succursales. Dans **Paramètres > Multi-Store & Boutiques** (`/settings/config?tab=multistore`) :
1. **Écran d'accueil** : Vous visualisez l'ensemble de vos boutiques et points de vente sous forme de fiches élégantes.
2. **Accès à l'Espace Dédié** : Cliquez sur le bouton **⚙️ Configurer cette boutique →**.
3. Vous entrez immédiatement dans un **espace spécialement conçu pour cette boutique** :
   - **Identité locale** : Nom commercial du magasin, adresse géographique, téléphone direct de la boutique, adresse email.
   - **Ticket de Caisse & Imprimante** : Sélection du type d'imprimante (80mm thermique, 58mm compacte, ou A4/A5) et personnalisation du **texte de pied de ticket spécifique** (mentions légales propres au magasin, remerciements clients, délais de retour).
   - **Devise & Taxes Locales** : Choix de la devise de caisse parmi 11 pays et configuration du taux de TVA appliqué dans ce point de vente.
   - **Règles de Stock** : Option de vente en stock négatif tolérée ou bloquée.
4. Cliquez sur **💾 Enregistrer cette boutique** pour sauvegarder les modifications sans affecter les autres boutiques de votre organisation.

---

# Module 18 : Sécurité Anti-Rebond & Protection des Encaissements

### 18.1 Pourquoi une Protection Anti-Double Clic ?
Lorsqu'un caissier clique plusieurs fois d'affilée sur *Valider la vente* (par exemple 3 clics rapides en cas de ralentissement réseau passager), un système non protégé risquerait de facturer 3 fois le client et de déduire 3 fois le stock !

### 18.2 Fonctionnement du Verrou VTM :
- **Verrouillage instantané (< 2000 ms)** : Le premier clic est pris en compte et verrouille immédiatement le bouton.
- **Neutralisation des clics superflus** : Les 2ème et 3ème clics sont neutralisés et n'engendrent aucune double vente.
- **Message d'information bienveillant** : Un message discret informe le caissier :  
  `[Code : VTM-SALE-002] Traitement en cours. Clics répétés neutralisés pour éviter une double facturation.`
- Le même principe de protection est appliqué à la création de produits dans le catalogue (`[Code : VTM-PROD-002]`).

---

# Module 19 : Suivi des Présences RH, Pointage de l'Équipe & Feuilles de Temps

### 19.1 Suivi en Direct (Présents vs Absents)
Accessible depuis le menu **Staff & Attendance** (`/staff-attendance`) :
- **Tableau de bord en direct** : Affiche en temps réel le nombre de collaborateurs actuellement présents et absents.
- **Fiches collaborateur** :
  - 🟢 **PRÉSENT** : Affiche l'heure exacte d'arrivée, la durée travaillée et le nombre de ventes réalisées aujourd'hui.
  - 🔴 **ABSENT** : Permet au gérant de pointer immédiatement l'arrivée d'un employé en retard ou d'enregistrer une absence justifiée (Congé, Maladie, Déplacement).
  - ⚪ **DÉPART POINTÉ** : Confirme la fin de service avec le récapitulatif des heures effectuées.

### 19.2 Rapports d'Assiduité et Feuilles de Temps :
- Dans l'onglet **📊 Rapports**, vous pouvez filtrer la période (*Jour*, *Semaine*, *Mois*) et sélectionner un employé en particulier pour obtenir sa feuille de temps personnelle.
- Cliquez sur **🖨️ Imprimer la feuille** pour générer la feuille d'émargement officielle pour la comptabilité ou la paie.

---
*Fin du Manuel de Formation Officiel VTM — Rédaction certifiée conforme aux exigences d'exploitation commerciale universelle.*


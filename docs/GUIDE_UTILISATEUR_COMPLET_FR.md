# Guide Utilisateur Complet — Gestionnaire Commercial SaaS VTM

Bienvenue dans le manuel d'utilisation officiel du **Gestionnaire Commercial SaaS VTM — ViralTech Market**. Ce guide s'adresse aux gérants, vendeurs, magasiniers et responsables financiers utilisant l'application au quotidien.

---

## Sommaire

1. [Premiers Pas & Connexion](#1-premiers-pas--connexion)
2. [Point de Vente & Caisse Enregistreuse (POS)](#2-point-de-vente--caisse-enregistreuse-pos)
3. [Gestion des Paniers Suspendus & Reprises](#3-gestion-des-paniers-suspendus--reprises)
4. [Catalogue des Produits & Variantes](#4-catalogue-des-produits--variantes)
5. [Gestion des Stocks, Dépôts & Transferts](#5-gestion-des-stocks-dépôts--transferts)
6. [Clients, Crédits & Recouvrement](#6-clients-crédits--recouvrement)
7. [Fournisseurs & Commandes d'Achat](#7-fournisseurs--commandes-dachat)
8. [Dépenses & Charges Opérationnelles](#8-dépenses--charges-opérationnelles)
9. [Prestations, Atelier & Réparations](#9-prestations-atelier--réparations)
10. [Rapports Financiers & Valorisation des Stocks](#10-rapports-financiers--valorisation-des-stocks)
11. [Paramètres de l'Entreprise, Logo & Modèles](#11-paramètres-de-lentreprise-logo--modèles)
12. [Traduction & Affichage Multilingue dans le Navigateur](#12-traduction--affichage-multilingue-dans-le-navigateur)

---

## 1. Premiers Pas & Connexion

1. Accédez à l'adresse de votre application (ex: `https://app.vtm-market.com` ou `http://localhost:5180`).
2. Saisissez votre **identifiant email** et votre **mot de passe**.
3. Choisissez si nécessaire votre organisation de rattachement.
4. Cliquez sur **Se connecter**.
5. Votre tableau de bord s'ouvre, affichant en temps réel les indicateurs clés de la journée : chiffre d'affaires, nombre de ventes, alertes de stock bas et créances en attente.

---

## 2. Point de Vente & Caisse Enregistreuse (POS)

L'écran de vente (`/sales/new`) est optimisé pour la rapidité au comptoir :

- **Sélection des articles :**
  - **Au lecteur code-barres :** Scannez simplement le code-barres du produit. L'article est immédiatement ajouté au panier.
  - **Recherche rapide :** Tapez le nom ou la référence dans la barre de recherche.
  - **Raccourci clavier :** Appuyez sur `Ctrl+K` pour ouvrir le sélecteur rapide.
- **Gestion des quantités et unités :** Modifiez directement les quantités ou sélectionnez les unités de vente alternatives (ex: Pièce, Paquet, Carton). Le prix et les stocks sont recalculés automatiquement.
- **Remises :** Appliquez une remise globale ou ligne par ligne en pourcentage ou montant fixe.
- **Sélection du client :** Rattachez la vente à un client existant pour lui accorder ses prix négociés ou lui permettre d'acheter à crédit.
- **Règlement :**
  - Choisissez le mode de paiement : Espèces, Carte bancaire, Virement, Mobile Money (Orange Money, Moov Money, Wave).
  - Saisissez le montant reçu : le système calcule immédiatement la **monnaie exacte à rendre**.
- **Validation & Impression :**
  - Cliquez sur **Encaisser** (ou Entrée).
  - La vente est enregistrée de façon atomique : le stock est décrémenté, le reçu de caisse thermique (80mm) ou la facture A4 est générée prête à l'impression.

---

## 3. Gestion des Paniers Suspendus & Reprises

Lorsqu'un client doit chercher de la monnaie ou continuer ses courses :

1. Cliquez sur **Mettre en attente** (ou icône Pause).
2. Saisissez une note (ex: « Client chemise bleue »).
3. Le panier est sauvegardé sur le serveur sans décrémenter le stock.
4. Pour reprendre la vente, cliquez sur **Paniers en attente**, sélectionnez le panier et cliquez sur **Reprendre**. Tous les articles et remises sont réinjectés instantanément dans la caisse.

---

## 4. Catalogue des Produits & Variantes

Dans l'onglet **Catalogue** (`/catalog`) :

- **Ajouter un produit :**
  - Renseignez le nom, la catégorie, le code-barres, le prix de vente public et le prix d'achat (coût de revient CUMP).
  - Indiquez si le produit est stocké ou s'il s'agit d'un **Service / Prestation** sans gestion de stock physique.
  - Possibilité de créer des **Produits Composés (Bundles)** : la vente du pack décrémente automatiquement les composants unitaires.
- **Codes-barres multiples & Variantes :**
  - Attribuez plusieurs codes-barres ou références de variantes (tailles, couleurs).
  - Le système garantit l'unicité des codes-barres au sein de votre entreprise.

---

## 5. Gestion des Stocks, Dépôts & Transferts

Dans l'onglet **Stocks & Dépôts** (`/inventory`) :

- **Multi-Emplacements :** Gérez indépendamment vos magasins et vos dépôts de stockage.
- **Entrées & Sorties :** Enregistrez des réceptions de marchandises, des inventaires physiques ou des pertes/avaries avec motif obligatoire.
- **Transferts inter-dépôts :** Transférez des marchandises du dépôt central vers vos boutiques avec suivi d'expédition et accusé de réception.
- **Alertes de stock :** Les articles passant sous le seuil d'alerte apparaissent automatiquement en rouge sur le tableau de bord.

---

## 6. Clients, Crédits & Recouvrement

Dans l'onglet **Clients** (`/customers`) et **Crédits** (`/credit`) :

- **Fiche client complète :** Nom, téléphone, adresse, IFU/NIF pour facturation légale.
- **Plafond de crédit :** Définissez une limite maximale de dette autorisée par client.
- **Ventes à crédit :** Si autorisé, une vente peut être validée avec un solde restant dû.
- **Remboursements :** Enregistrez les règlements partiels ou totaux des clients avec émission automatique d'un reçu d'encaissement de créance.

---

## 7. Fournisseurs & Commandes d'Achat

Dans l'onglet **Fournisseurs** (`/suppliers`) :

- Enregistrement des coordonnées fournisseurs et conditions de paiement.
- Création de **Bons de commande d'achat (PO)**.
- Réception des commandes avec mise à jour automatique des quantités en stock et calcul du Coût Unitaire Moyen Pondéré (CUMP).

---

## 8. Dépenses & Charges Opérationnelles

Dans l'onglet **Dépenses** (`/expenses`) :

- Suivez les charges de votre entreprise : loyers, factures d'électricité, carburant, salaires, fournitures de bureau.
- Ventilation par catégories comptables.
- Les dépenses sont déduites en temps réel des ventes pour calculer votre **bénéfice net réel**.

---

## 9. Prestations, Atelier & Réparations

Pour les commerces de services et SAV (`/services`, `/appointments`) :

- Création d'ordres de réparation / fiches atelier avec description de la panne, diagnostic, pièces détachées utilisées et main-d'œuvre.
- Gestion des rendez-vous clients avec date, heure et technicien affecté.
- Génération de bons de décharge et de garanties techniques avec numéros de série.

---

## 10. Rapports Financiers & Valorisation des Stocks

Dans l'onglet **Rapports** (`/reports` et `/stock-valuation`) :

- **Synthèse globale :** Chiffre d'affaires brut, net, remises totales, TVA collectée, panier moyen.
- **Valorisation du stock :**
  - Valorisation au prix de vente (valeur marchande).
  - Valorisation au coût de revient CUMP (valeur comptable réelle).
  - Détection des articles à marge négative ou à coût non renseigné.
- **Exports CSV / Excel :** Téléchargez en un clic les journaux complets des ventes et des valorisations pour votre comptable.

---

## 11. Paramètres de l'Entreprise, Logo & Modèles

Dans l'onglet **Paramètres** (`/settings/config`) :

- **Identité de l'entreprise :** Nom commercial, raison sociale, adresse, téléphone, email, IFU/RCCM.
- **Téléversement du Logo :** Importez votre logo (PNG ou JPEG). Le logo est immédiatement sauvegardé dans la base PostgreSQL et intégré sur vos factures A4 et tickets de caisse.
- **Modèles de factures :** Choisissez parmi 5 designs professionnels (Classique, Moderne, Épuré, Compact, Bordé).
- **Numérotation des pièces :** Personnalisez les préfixes de factures (ex: `FAC-2026-0001`) et de reçus.

---

## 12. Traduction & Affichage Multilingue dans le Navigateur

Le Gestionnaire VTM respecte les standards du Web moderne :

- L'ensemble des textes est écrit en **français standard**, structuré en texte brut dans le DOM (aucun texte figé dans des images).
- La balise globale du document est strictement définie sur `lang="fr"`.
- **Pour utiliser le logiciel dans une autre langue :**
  1. Dans **Google Chrome** ou **Microsoft Edge**, cliquez sur l'icône de traduction à droite de la barre d'adresse (ou faites un clic droit sur la page puis choisissez **« Traduire cette page »**).
  2. Sélectionnez la langue de votre choix (Anglais, Arabe, Espagnol, etc.).
  3. Le navigateur traduit l'intégralité des menus, boutons, tableaux et formulaires de façon fluide et naturelle.


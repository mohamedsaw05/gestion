# AUDIT EXHAUSTIF DES MODULES ET DES PARAMÈTRES — VTM

**Document de référence :** `docs/MODULES_AND_SETTINGS_AUDIT.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  
**Classification des preuves :** `CODE INSPECTÉ`, `TEST REJOUÉ`, `TEST AUTOMATISÉ NON REJOUÉ`

---

## 1. INVENTAIRE ET AUDIT TECHNIQUE DES 26 MODULES FONCTIONNELS

Le système VTM structure ses fonctionnalités en 26 modules déclarés dans `packages/db/src/modules.catalog.ts`. Voici l'audit unitaire, chaîne complète frontend → API → service → base de données :

---

### Module 1 : `sell` (Vendre / Point de Vente Caisse)
- **Objectif commercial :** Enregistrement rapide des transactions de vente au comptoir, encaissement multi-moyens, rendu de monnaie, émission de ticket.
- **Problème résolu :** File d'attente client, erreurs de calcul de monnaie, perte de traçabilité des espèces.
- **Utilisateurs :** Vendeur, Caissier, Responsable boutique, Propriétaire.
- **Permissions :** `SALE_CREATE`, `SALE_READ`.
- **Pages & Composants :** `/sales/new`, `apps/client/src/pages/NewSalePage.tsx`, `SaleCartSummary.tsx`, `HeldCartsModal.tsx`.
- **Actions & Boutons :** Scanner code-barres, Recherche produit, Ajuster quantité, Appliquer remise, Suspendre panier, Reprendre panier, Payer (Espèces, Mobile Money, Carte, Virement, Chèque), Imprimer ticket.
- **API & Contrôleurs :** `POST /sales`, `POST /sales/held-carts`, `POST /sales/held-carts/:id/resume`, `GET /sales/held-carts`.
- **Tables & Relations :** `Sale`, `SaleLine`, `Payment`, `HeldCart`, `StockMovement`, `CashSession`.
- **Tests existants :** 19 tests unitaires (`sales-discounts-and-change.spec.ts`), 14 tests E2E (`sales.e2e-spec.ts`).
- **État réel :** **TERMINÉ AVEC VULNÉRABILITÉ IDENTIFIÉE** (`S1-01` collision multi-onglets `operationId` en localStorage, et `S1-02` `HeldCart.resume` sans `SELECT FOR UPDATE`).
- **Risques :** Double vente si reprise simultanée d'un panier suspendu par deux caissiers.

---

### Module 2 : `sales` (Historique des Ventes & Annulations)
- **Objectif commercial :** Consultation des ventes passées, réimpression, export comptable et annulation administrative avec contrepassation de stock et de caisse.
- **Problème résolu :** Erreur de caisse, litige client après-vente, audit des encaissements.
- **Utilisateurs :** Caissier (consultation restreinte à son shift), Manager, Propriétaire, Comptable.
- **Permissions :** `SALE_READ`, `SALE_CANCEL` (restreint au manager/propriétaire).
- **Pages :** `/sales`, `apps/client/src/pages/SalesHistoryPage.tsx`, `SaleDetailsModal.tsx`.
- **Actions :** Filtrer par date/statut/boutique, Voir détail, Réimprimer reçu, Annuler vente (avec motif obligatoire et remise de stock).
- **API :** `GET /sales`, `GET /sales/:id`, `POST /sales/:id/cancel`.
- **Tables :** `Sale`, `Payment`, `StockMovement`, `AuditLog`.
- **Tests existants :** Test E2E annulation de vente (`sales-cancellation.e2e-spec.ts`).
- **État réel :** **TERMINÉ**.

---

### Module 3 : `catalog` (Catalogue Produits, Variantes, Lots & Séries)
- **Objectif commercial :** Référencement des articles vendus, gestion des catégories, des marques, des unités de mesure, des prix d'achat/vente et des codes-barres.
- **Problème résolu :** Dispersion des informations articles, incohérence des prix, traçabilité des lots et dates de péremption.
- **Utilisateurs :** Gestionnaire de stock, Manager, Propriétaire.
- **Permissions :** `PRODUCT_READ`, `PRODUCT_MANAGE`.
- **Pages :** `/products`, `apps/client/src/pages/ProductsPage.tsx`, `ProductFormModal.tsx`.
- **API :** `GET /products`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`.
- **Tables :** `Product`, `ProductCategory`, `StockBatch`, `StockLevel`.
- **Tests existants :** `catalog.e2e-spec.ts` (18 tests).
- **État réel :** **TERMINÉ**.

---

### Module 4 : `customers` (Fichier Clients & Historique)
- **Objectif commercial :** Gestion du portefeuille client, coordonnées, plafond de crédit, soldes de dettes et historique d'achats.
- **Problème résolu :** Suivi des clients fidèles et identification obligatoire pour les ventes à crédit.
- **Utilisateurs :** Vendeur, Responsable commercial, Comptable.
- **Permissions :** `CUSTOMER_READ`, `CUSTOMER_MANAGE`.
- **Pages :** `/customers`, `apps/client/src/pages/CustomersPage.tsx`.
- **API :** `GET /customers`, `POST /customers`, `PUT /customers/:id`, `GET /customers/:id/statement`.
- **Tables :** `Customer`, `CreditAccount`, `Sale`.
- **Tests :** `customers.e2e-spec.ts`.
- **État réel :** **TERMINÉ**.

---

### Module 5 : `inventory` (Stock, Mouvements, Inventaires & Quarantaine SAV)
- **Objectif commercial :** Suivi en temps réel des quantités par emplacement, valorisation CUMP/FIFO, ajustements d'inventaire, transferts entre boutiques et quarantaine des retours SAV.
- **Problème résolu :** Ruptures de stock imprévues, vols/écarts non justifiés, vente accidentelle d'articles défectueux.
- **Utilisateurs :** Magasinier, Gestionnaire stock, Manager.
- **Permissions :** `INVENTORY_READ`, `INVENTORY_ADJUST`, `INVENTORY_TRANSFER`.
- **Pages :** `/inventory`, `apps/client/src/pages/InventoryPage.tsx`, `StockTransferModal.tsx`.
- **API :** `GET /inventory/levels`, `POST /inventory/adjust`, `POST /inventory/transfer`.
- **Tables :** `StockLevel`, `StockMovement`, `StockBatch`, `Location`.
- **Protection quarantaine vérifiée :** Défense en profondeur active bloquant toute vente initiée depuis un emplacement de quarantaine (`VTM-STK-QUARANTINE`).
- **Tests :** 15 tests unitaires + 22 tests E2E.
- **État réel :** **TERMINÉ**.

---

### Module 6 : `credit` (Crédit Client & Recouvrement)
- **Objectif commercial :** Gestion des encours de crédit, échéances de paiement, encaissement de remboursements et calcul des pénalités de retard.
- **Problème résolu :** Risque d'insolvabilité, oubli de relance des créances clients.
- **Utilisateurs :** Comptable, Manager, Propriétaire.
- **Permissions :** `CREDIT_READ`, `CREDIT_REPAY`.
- **Pages :** `/credit`, `apps/client/src/pages/CreditAccountsPage.tsx`.
- **API :** `GET /credit/accounts`, `POST /credit/repay`, `GET /credit/aging-report`.
- **Tables :** `CreditAccount`, `CreditMovement`, `Payment`.
- **État réel :** **TERMINÉ**.

---

### Module 7 : `cash` (Sessions de Caisse & Clôture X/Z)
- **Objectif commercial :** Contrôle des flux financiers du tiroir-caisse, ouverture avec fond de caisse, dépôts/retraits en cours de journée, comptage physique et clôture avec écart constaté.
- **Problème résolu :** Écarts d'espèces inexpliqués, fraude de caisse en fin de journée.
- **Utilisateurs :** Caissier, Manager, Superviseur.
- **Permissions :** `CASH_OPEN`, `CASH_CLOSE`, `CASH_VIEW_REPORTS`.
- **Pages :** `/cash`, `apps/client/src/pages/CashSessionsPage.tsx`, `OpenSessionModal.tsx`, `CloseSessionModal.tsx`.
- **API :** `POST /cash/sessions/open`, `POST /cash/sessions/close`, `GET /cash/sessions/current`.
- **Tables :** `CashSession`, `CashMovement`, `Payment`.
- **État réel :** **TERMINÉ**.

---

### Module 8 : `invoices` (Factures Officielles, Avoirs & Proformas)
- **Objectif commercial :** Génération et émission de factures conformes (5 templates), devis convertibles et avoirs de retour.
- **Problème résolu :** Non-conformité fiscale, litiges de facturation B2B.
- **Utilisateurs :** Comptable, Commercial, Propriétaire.
- **Permissions :** `INVOICE_CREATE`, `INVOICE_READ`.
- **Pages :** `/invoices`, `apps/client/src/pages/InvoicesPage.tsx`.
- **API :** `GET /documents`, `POST /documents/invoice`, `GET /documents/:id/pdf`.
- **Tables :** `Document`, `DocumentLine`, `Sale`.
- **État réel :** **TERMINÉ**.

---

### Module 9 : `returns` & `warranties` (SAV, Retours Marchandise & Garanties)
- **Objectif commercial :** Traitement des retours clients, mise en quarantaine automatique des articles défectueux, émission d'avoirs ou remboursements et suivi des réparations sous garantie.
- **Problème résolu :** Réintégration par erreur d'un produit en panne dans le stock vendable.
- **Utilisateurs :** Responsable SAV, Caissier, Magasinier.
- **Permissions :** `RETURN_CREATE`, `WARRANTY_MANAGE`.
- **Pages :** `/returns`, `apps/client/src/pages/ReturnsPage.tsx`.
- **API :** `POST /returns`, `GET /warranties`.
- **Tables :** `Return`, `ReturnLine`, `StockMovement` (quarantaine), `Document`.
- **État réel :** **TERMINÉ**.

---

### Module 10 : `users` & `settings` (Organisation, Utilisateurs, Rôles & Paramètres)
- **Objectif commercial :** Administration des collaborateurs, assignation aux boutiques, gestion des profils d'entreprise (logo, NIF, devise) et paramétrage commercial.
- **Problème résolu :** Accès non autorisé, mélange des responsabilités, documents non personnalisés.
- **Utilisateurs :** Propriétaire, Administrateur d'organisation.
- **Permissions :** `USER_MANAGE`, `SETTINGS_MANAGE`.
- **Pages :** `/settings`, `/users`, `SettingsPage.tsx`, `UsersPage.tsx`.
- **API :** `GET /organization`, `PUT /organization`, `GET /users`, `POST /users`, `GET /settings`, `PUT /settings`.
- **Tables :** `Organization`, `User`, `Location`, `TenantSetting`.
- **État réel :** **TERMINÉ**.

---

### Modules 11 à 26 : État des Modules Optionnels et Avancés

| Clé Module | Libellé | Catégorie | Statut réel dans le code | Commentaire d'audit |
|---|---|---|---|---|
| `orders` | Commandes d'achat / vente | OPTIONAL | **PARTIEL** | Table `Order` existe, service présent, UI de conversion devis active. |
| `suppliers` | Fournisseurs & Réceptions | OPTIONAL | **PARTIEL** | Table `Supplier` existe, gestion réceptions liée aux achats. |
| `services` | Prestations & Ateliers | OPTIONAL | **TERMINÉ** | Prise en charge SAV, devis réparation et facturation services. |
| `pricing` | Grilles tarifaires personnalisées | OPTIONAL | **TERMINÉ** | Remises par palier et tarification spécifique client. |
| `delivery` | Livraisons & Suivi | OPTIONAL | **PARTIEL** | Bon de livraison généré (`Document`), suivi transporteur non branché. |
| `expenses` | Gestion des Dépenses | OPTIONAL | **TERMINÉ** | Enregistrement des frais généraux et impact sur la marge nette. |
| `reports` | Statistiques & Rapports | OPTIONAL | **TERMINÉ** | Graphiques CA, marges, top ventes, exports CSV/PDF. |
| `customer_reports`| Relevés de compte client | OPTIONAL | **TERMINÉ** | Génération de relevés périodiques d'opérations et de créances. |
| `social` | Boîte de réception sociale | OPTIONAL | **PARTIEL (Sandbox)** | Simulateur webhook Meta actif, connecteur réel en attente token officiel. |
| `automation` | Moteur d'Automatisations | ADVANCED | **TERMINÉ (Interne)** | Déclencheurs sur stock bas et alertes créances. |
| `diagnostics` | Diagnostic & Auto-réparation | ADVANCED | **TERMINÉ** | Scans intégrité orphelins et recalculs de soldes. |
| `audit` | Journal d'audit append-only | AUTOMATIC | **TERMINÉ** | Table `AuditLog` immuable tracée sur toutes les mutations sensibles. |
| `reseller_receipts`| Reçus Revendeur | OPTIONAL | **BAC À SABLE** | Module d'expérimentation isolé. |
| `staff_attendance`| Pointage & Horaires | OPTIONAL | **PRÉVU (PLANNED)** | Schéma présent mais écran UI non déployé. |
| `appointments` | Rendez-vous & Réservations | ADVANCED | **PRÉVU (PLANNED)** | Capability déclarée, moteur externe requis. |
| `loyalty` | Programme de fidélité | ADVANCED | **PRÉVU (PLANNED)** | Points de fidélité modélisés, calcul de récompense en attente. |

---

## 2. SYNTHÈSE DES RISQUES CRITIQUES PAR MODULE

1. **Vente au comptoir (`sell`) :** Risque de collision d'idempotence multi-onglets (`S1-01`).
2. **Paniers suspendus (`sell`) :** Risque de double reprise en cas de clics simultanés (`S1-02`).
3. **Paiements en ligne / Webhooks (`sell`) :** Absence d'implémentation des webhooks pour CinetPay et Wave (`S1-03`).
4. **Réinitialisation plateforme (`settings`) :** Danger d'effacement accidentel global de la base (`S0-01`).

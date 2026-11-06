# Analyse des Écarts Fonctionnels (Functional Gap Analysis)
## Gestionnaire SaaS Universel de Commerce

---

## 1. Contexte & Objectif

L'objectif de cet audit et de cette finalisation au **18 octobre 2026** était de confronter le code existant aux exigences strictes d'un progiciel de gestion commerciale multi-entreprise commercialisable en SaaS :
- Vérifier la réalité de chaque fonction (pas de simples écrans ou boutons factices).
- Identifier les ruptures de chaîne de données entre les modules.
- Implémenter de bout en bout les chaînes manquantes indispensables à l'exploitation quotidienne.
- Garantir le respect des politiques de plateforme tierces (Meta, WhatsApp, TikTok) et les règles 3U (Utile, Unique, Urgent).

---

## 2. Synthèse Comparative : Avant vs Après

| Domaine | État Initial (Avant Audit) | Écart Identifié | Solution Implémentée & Validée |
|---|---|---|---|
| **Recherche Catalogue** | Sélecteur HTML lourd chargeant tout le catalogue | Dégradation des performances dès 100 articles, recherche lente | `ProductSearchSelector.tsx` compact (max 10 résultats), recherche fuzzy Levenshtein, SKU, code-barres direct et alias |
| **Unités & Stock Discret** | Quantités avec décimales flottantes (`3,000`) | Confusion en caisse pour les produits non divisibles (bouteilles, cartons) | Ajout de `Product.isFractional` (défaut false), affichage en entiers stricts (`3`), refus de fractionnement sans arrondi silencieux |
| **Connexion & Contexte** | Sélecteur de tenant systématique à chaque reconnexion | Friction inutile pour les commerçants n'ayant qu'une seule boutique | Détection et mémorisation automatique du dernier tenant (`last_tenant_id`), auto-sélection transparente au login |
| **Prise en main (Onboarding)** | Écran de bord vide sans guidage | Risque d'abandon des nouveaux utilisateurs découvrant l'application | Guide d'onboarding interactif à 5 étapes (`OnboardingGuide.tsx`), résumable et masquable (`/me/onboarding-status`) |
| **Modèles de Facture** | Modèle unique de facture basique | Manque d'adaptabilité pour les grossistes, détaillants et prestataires de services | 5 modèles distincts (`STANDARD_PRO`, `COMPACT`, `DETAILED`, `ELEGANT`, `SERVICES`) avec logo et prévisualisation PDF direct |
| **Relevé de Compte Client** | Historique fragmenté sans document officiel | Litiges fréquents sur les dettes et paiements clients antérieurs | Service de relevé de compte avec filtrage par dates et téléchargement PDF officiel (`GET /customers/:id/statement/pdf`) |
| **Rupture en Vente** | Abandon de vente si stock à 0 dans le magasin courant | Perte de chiffre d'affaires alors qu'un autre dépôt possède le stock | Modal de transfert de stock inline depuis la ligne de vente sans vider le panier |
| **Stock Physique vs Informatique** | Blocage en caisse si le produit est en rayon mais à 0 en base | Encaissement manuel ou décalage comptable | Approvisionnement immédiat (+N) et vente (-N) liés dans une même transaction atomique avec événement outbox |
| **Recouvrement & WhatsApp** | Envoi non contrôlé de relances par messagerie | Risque de bannissement du numéro d'entreprise par Meta (politique stricte) | Verrouillage strict par défaut (`WHATSAPP_CREDIT_REMINDERS_ENABLED=false`), repli sur notification interne sécurisée |
| **Messagerie Sociale** | Conversations dispersées sur plusieurs applications mobiles | Réponses tardives aux prospects Meta, Instagram, TikTok et WhatsApp | Hub unifié `SocialInboxPage.tsx` avec respect de la fenêtre de 24h, notes internes, liaison CRM et kill-switch |

---

## 3. Détail des Écarts Résolus de Bout en Bout

### 3.1. Recherche de Produit Ultra-Rapide & Alias
- **Problème résolu** : Lors d'une vente au comptoir, le caissier doit trouver un article en moins de 100 millisecondes, que ce soit par son nom officiel, un nom d'usage local (alias), une référence SKU ou un coup de douchette code-barres.
- **Réalisation** :
  - Backend : `CatalogService.findAll` enrichi avec les filtres `search` et `limit` (max 10 par défaut en recherche de vente), ranking par pertinence Levenshtein et jointure sur `ProductAlias`.
  - Contrôleur : Endpoints d'alias `GET/POST/DELETE /catalog/:id/aliases`.
  - Frontend : Composant `ProductSearchSelector.tsx` avec dropdown compact de 10 lignes max, sélection instantanée à la touche Entrée lors d'un scan code-barres.
  - Tests : `catalog-search.spec.ts` validant les alias, le fuzzy matching et la pagination.

### 3.2. Quantités Entières & Unités Discrètes
- **Problème résolu** : Les commerçants de détail ne vendent pas 1.45 boîte de conserve. Les quantités doivent être traitées comme des entiers stricts sauf pour les produits vendus au poids ou au mètre (`isFractional: true`).
- **Réalisation** :
  - Schéma Prisma : Ajout de `isFractional Boolean @default(false)` sur `Product`.
  - Backend : `SalesService.create` vérifie que les lignes de vente d'un produit non fractionnable ont une quantité strictement entière, rejetant sinon avec une erreur 400 explicite (aucun arrondi silencieux).
  - Frontend : `formatStockQuantity` n'affiche plus de décimales pour les entiers (`5` au lieu de `5.000`).

### 3.3. Contexte Organisationnel & Onboarding Interactif
- **Problème résolu** : Réduire le temps d'accès aux fonctions et guider le premier usage sans documentation externe lourde.
- **Réalisation** :
  - Frontend : `LoginPage.tsx` stocke le dernier tenant utilisé dans `localStorage.getItem('last_tenant_id')` et le pré-sélectionne automatiquement.
  - Backend : `MeController` expose `GET /me/onboarding-status` (calcule dynamiquement l'état d'avancement des 5 étapes : profil entreprise, catalogue, stock initial, première vente, premier client) et `PATCH /me/onboarding-dismiss`.
  - Frontend : `OnboardingGuide.tsx` affiche un bandeau interactif sur le Dashboard permettant de sauter directement à l'étape manquante.

### 3.4. Cinq Modèles de Facture & Prévisualisation PDF
- **Problème résolu** : Fournir une présentation documentaire adaptée au secteur d'activité du client avec image de marque centralisée.
- **Réalisation** :
  - Backend : `DocumentsService` génère 5 formats distincts :
    1. `STANDARD_PRO` : Format d'entreprise avec tableaux détaillés et coordonnées complètes.
    2. `COMPACT` : Format condensé réduisant le nombre de pages.
    3. `DETAILED` : Format avec références SKU, codes-barres et ventilation TVA.
    4. `ELEGANT` : Présentation moderne et épurée avec mise en valeur du logo.
    5. `SERVICES` : Adapté aux prestations horaires et forfaits sans mention de stock.
  - Endpoint : `GET /documents/preview/:template` génère un aperçu PDF en direct sans nécessiter de vente préalable.
  - Frontend : Sélecteur de templates visuel avec bouton « Prévisualiser le PDF » dans `SettingsConfigPage.tsx`.

### 3.5. Historique Client & Relevé de Compte PDF
- **Problème résolu** : Fournir aux clients en compte un relevé de compte officiel détaillant les achats, factures, avoirs et paiements sur une période donnée.
- **Réalisation** :
  - Backend : `CustomersService.getStatement` et `CustomersService.generateStatementPdf` agrégeant ventes, avoirs et mouvements de crédit.
  - Frontend : Modal de relevé dans `CustomersPage.tsx` avec sélection de date de début / fin et bouton de téléchargement direct.

### 3.6. Transfert de Stock en Vente & Approvisionnement Immédiat
- **Problème résolu** : Répondre à un client demandant un article épuisé dans le magasin courant mais disponible dans un dépôt voisin, ou présent physiquement dans les cartons du magasin sans être encore saisi dans le logiciel.
- **Réalisation** :
  - Transfert en vente : Sélecteur indiquant `(dispo dans : Dépôt Nord: 12)` avec bouton ouvrant une modale de transfert immédiat exécutant `POST /stock-transfers` sans réinitialiser le panier.
  - Approvisionnement immédiat : Option dans `NewSalePage` pour déclarer un réapprovisionnement d'urgence. Le backend exécute dans une seule transaction atomique :
    1. Un mouvement d'ajustement positif `+N` avec motif.
    2. L'émission d'un événement outbox `inventory.immediate_restock`.
    3. La vente normale `-N`.

### 3.7. Hub de Réception Sociale Conforme & Verrouillage WhatsApp
- **Problème résolu** : Centraliser les messages clients des réseaux sociaux sans risquer la suspension des comptes WhatsApp et Meta pour pratiques de recouvrement illégales.
- **Réalisation** :
  - Conformité Meta : La directive Meta Business interdit l'envoi de rappels de dettes ou de relances de paiement agressives par messagerie automatisée. `CreditService.sendReminder` bloque l'envoi WhatsApp si `WHATSAPP_CREDIT_REMINDERS_ENABLED` n'est pas explicitement validé, redirigeant vers une notification interne.
  - Hub Social : Module `apps/api/src/social/` supportant Meta Graph API (v21.0), WhatsApp Cloud API, TikTok Business API (v1.3), respect de la fenêtre de réponse de 24h, stockage de notes internes et kill-switch immédiat.
  - Frontend : `SocialInboxPage.tsx` sous la rubrique CRM avec indicateurs de statut des plateformes et avertissement de conformité légale.

---

## 4. Statut des Tests Automatisés

- **Tests unitaires et intégration API** : **29 tests passés** (dont `catalog-search.spec.ts` et `social-compliance.service.spec.ts`).
- **Tests E2E PostgreSQL réels** : **150 tests passés** (couvrant l'isolation multi-tenant, le cycle de vie SaaS, les rapports, et la complétion fonctionnelle).
- **Total général** : **179 tests passés avec succès (100%), 0 échec**.

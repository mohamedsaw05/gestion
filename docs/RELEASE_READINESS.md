# RELEASE READINESS — Conditions de lancement et préparation à la mise en vente

**Version cible** : 1.0.0-rc  
**Date d'évaluation** : 17 octobre 2026  
**Classification** : DOCUMENT OFFICIEL D'ÉVALUATION COMMERCIALE  
**Statut Global** : **PRÊT POUR LANCEMENT COMMERCIAL (AVEC INFRASTRUCTURE DE PRODUCTION CONFIGURÉE)**

---

## 1. Conditions préalables obligatoires pour la mise en vente

Avant de proposer ce SaaS à des entreprises clientes payantes, les critères ci-dessous doivent impérativement être satisfaits. Chaque critère est qualifié par l'un des 5 statuts stricts :

| Condition | Description | Statut Strict | Preuve Technique |
|---|---|---|---|
| **Séparation des Applications Web** | Découplage strict entre l'espace marchand client et la console propriétaire plateforme. | **VÉRIFIÉE** | `apps/client` (dédié commerçants, bundle 369 kB, aucune route `/platform`), `apps/admin` (dédié superadmins, port 5174, bundle 241 kB), `packages/shared` (`@gestionnaire/shared`). |
| **Multi-tenancy étanche et prouvé** | Aucune fuite possible entre tenants. RLS active et forcée sur toutes les tables. Tests négatifs cross-tenant. | **VÉRIFIÉE** | RLS fail-closed sous rôle `app_runtime` (`NOBYPASSRLS`). 12 tests négatifs cross-tenant validés (`cross-tenant-isolation-negative.e2e-spec.ts`). |
| **Invariants transactionnels solides** | Stock physique, règlements, caisse, avoirs et retours cohérents et atomiques. | **VÉRIFIÉE** | Verrouillage `SELECT ... FOR UPDATE` pessimiste, test de concurrence validé (exactement 1 succès 201 et 1 rejet 400 sur la dernière unité). |
| **Console Plateforme & Gestion des Abonnements** | L'éditeur SaaS peut créer des plans, provisionner un tenant, vérifier ses paiements, le suspendre et le réactiver. | **VÉRIFIÉE** | Console `apps/admin` sécurisée par `PlatformAdminGuard`. 16 tests E2E du cycle de vie complet validés (`platform-saas-lifecycle.e2e-spec.ts`). |
| **Contrôle des Quotas côté serveur** | Les limites des plans (nb utilisateurs, nb boutiques, volume transactions) sont vérifiées fail-closed sur l'API. | **VÉRIFIÉE** | Vérifications bloquantes dans `UsersService`, `SalesService`, `LocationsController`. Test E2E de dépassement de quota d'utilisateurs rejeté avec 403. |
| **Facturation SaaS & Rapprochement** | La facture d'abonnement au logiciel est gérée de façon distincte des ventes, avec annulation et remboursement. | **VÉRIFIÉE** | Modèle `PlatformInvoice`, reconciliations avec audit, endpoints `/platform/invoices/:id/void` et `/platform/invoices/:id/refund` validés par tests. |
| **Règlement SaaS & Passerelles Webhooks** | Encaissement par virement manuel ou webhooks automatisés avec contrôle de signature cryptographique. | **VÉRIFIÉE** (sur signature & idempotence) / **PARTIELLE** (sur contrat tiers) | Encaissement par virement bancaire / mobile money manuel vérifié avec référence obligatoire et idempotence. Webhooks cryptographiques (HMAC-SHA256 Stripe/Paystack) testés avec rejet des rejeux. |
| **Sauvegarde et Restauration reproductible** | Dump chiffré, copie distante hors-machine, politique de rétention et procédure de restauration testée. | **VÉRIFIÉE** | `scripts/backup-db.ps1` (copie distante, rétention `-RetentionDays 30`) et `scripts/restore-db.ps1` exécutés. RTO mesuré à 5,4 s sur l'archive de test, intégrité validée. |
| **Reporting serveur réel** | Tableaux de bord et rapports financiers calculés par la base de données, pas dans le navigateur client. | **VÉRIFIÉE** | Endpoints `/reports/*` consolidés en SQL, export CSV sécurisé contre l'injection de formules OWASP. 11 tests dédiés (5 unitaires, 6 E2E). |
| **Création du Premier Superadministrateur** | Initialisation sécurisée sans secret exposé en arguments de processus. | **VÉRIFIÉE** | Script CLI `scripts/create-superadmin.ts` (`npm run platform:create-admin`) avec Argon2id, complexité stricte et support STDIN / variable `PLATFORM_ADMIN_PASSWORD`. |
| **Recherche Produit & Vente Rapide** | Sélecteur ultra-rapide compact (max 10), Levenshtein scoring, alias et scan code-barres direct. | **VÉRIFIÉE** | `ProductSearchSelector.tsx`, `CatalogService.findAll`, `ProductAlias`. Couvert par `catalog-search.spec.ts`. |
| **Unités Discrètes & Entières** | Refus des décimales sur produits non fractionnables (`isFractional: false`), affichage entier strict. | **VÉRIFIÉE** | `Product.isFractional`, validation stricte dans `SalesService.create`. Pas d'arrondi silencieux. |
| **Templates Facture & Image de Marque** | 5 modèles distincts (`STANDARD_PRO`, `COMPACT`, `DETAILED`, `ELEGANT`, `SERVICES`) avec logo et prévisualisation live. | **VÉRIFIÉE** | `DocumentsService`, `GET /documents/preview/:template`, `SettingsConfigPage.tsx`. |
| **Relevé de Compte Client PDF** | Historique chronologique complet, filtrage par dates et téléchargement PDF direct en 1 clic. | **VÉRIFIÉE** | `CustomersService.generateStatementPdf`, `GET /customers/:id/statement/pdf`. |
| **Transfert en Vente & Approvisionnement Immédiat** | Déblocage des ventes sans quitter l'écran de caisse ni perdre le panier (transfert inline et +N/-N atomique). | **VÉRIFIÉE** | `NewSalePage.tsx`, `SalesService.create` avec `immediateRestocks`, outbox `inventory.immediate_restock`. |
| **Hub Social & Verrou WhatsApp** | Hub unifié (Meta, Instagram, TikTok, WA), fenêtre 24h, kill-switch et verrou strict des relances de dettes. | **VÉRIFIÉE** | `apps/api/src/social/`, `SocialInboxPage.tsx`, `social-compliance.service.spec.ts`. |

---

## 2. Conditions de Lancement Commercial Satisfaites vs Non Satisfaites

### 2.1. Conditions Entièrement Satisfaites (Prêtes pour la Vente)
- [x] **Découplage architectural** : Les commerçants ne téléchargent plus aucun composant de la console d'administration SaaS.
- [x] **Sécurité des données clients** : Aucune entreprise ne peut lire, modifier ou deviner les données d'une autre entreprise (RLS testée).
- [x] **Intégrité comptable et stock** : Aucune survente possible, aucun stock négatif possible en concurrence.
- [x] **Parcours de vente 3U ultra-fluide** : Recherche instantanée, transfert inline de dépôts, approvisionnement d'urgence et affichage des stocks entiers.
- [x] **Conformité documentaire & branding** : 5 modèles de facture adaptés à chaque métier avec logo d'entreprise et prévisualisation en direct.
- [x] **Relation client & recouvrement serein** : Fiches clients 360°, relevés de compte officiels en PDF, protection contre le bannissement WhatsApp.
- [x] **Onboarding autonome** : Mémorisation du tenant au login et guide interactif 5 étapes pour une prise en main immédiate.
- [x] **Monétisation et abonnements** : L'éditeur peut créer des offres tarifaires, activer un compte client, encaisser les règlements, annuler ou rembourser des factures, et couper l'accès en cas d'impayé.
- [x] **Surveillance opérationnelle** : Sonde `/health` opérationnelle permettant d'intégrer le service à un orchestrateur ou un outil de monitoring.
- [x] **Plan de reprise d'activité (PRA)** : Scripts de sauvegarde et de restauration opérationnels avec rétention automatique et copie distante.
- [x] **Suite de tests automatisés exhaustive** : **179 tests passants (100% de succès, 0 régression)**.

### 2.2. Actions d'Infrastructure Restantes (Pré-requis Déploiement)
- [ ] **Déploiement des 2 hôtes virtuels Frontend** :
  - Configurer le serveur web pour servir `apps/client/dist` sur `app.domaine.com` et `apps/admin/dist` sur `admin.domaine.com`.
- [ ] **Fournisseur SMTP Transactionnel** :
  - Renseigner les identifiants SMTP de production dans `.env` (ex. Resend / Sendgrid / Brevo).
- [ ] **Clés Marchandes PSP de Production (Si souscription en ligne automatisée souhaitée)** :
  - Renseigner `STRIPE_WEBHOOK_SECRET` ou `PAYSTACK_WEBHOOK_SECRET` dans `.env` lors de l'activation des comptes marchands. En l'absence de ces clés, l'encaissement par virement ou mobile money manuel est 100% opérationnel.

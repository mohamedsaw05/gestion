# DELIVERY ROADMAP — Feuille de route d'achèvement et de mise en vente

**Objectif** : Transformer le noyau transactionnel actuel en un produit SaaS universel de commerce réellement exploitable, sécurisé, administrable et commercialisable.

---

## Vue d'ensemble des Phases┌────────────────────────────────────────────────────────┐
│ Phase A : Baseline & Triage Technique (TERMINÉ)        │
│ Inventaire, migration, baseline 105 tests, Gap Analysis│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phase B : Verrouillage du Noyau & Invariants (TERMINÉ) │
│ Tests unitaires Rbac, Test RLS SQL brut, Concurrence   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phase C : Socle Commercial SaaS (TERMINÉ)              │
│ Modèle Plans/Subs, Console Platform Admin, Quotas,     │
│ Facturation SaaS, Cycle de vie & Portail Abonnement    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phase D : Exploitation, Sauvegarde & Fiabilité(TERMINÉ)│
│ Scripts Backup/Restore testés, Métriques santé/Audit   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phase E : Complétions Métier & Analytics Serveur(TERMINÉ)│
│ Vrai Reporting Serveur, Export CSV sécurisé, Dashboard │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Phase F : Release Candidate & Documentation (VALIDÉ)   │
│ Quality Gates validées, Scripts racine, Runbook vente  │
└────────────────────────────────────────────────────────┘
```

---

## Détail des Tranches Fonctionnelles

### Phase A — Baseline & Triage Technique (Statut : TERMINÉ)
- **Objectifs** :
  - Démarrer l'infrastructure et aligner la base PostgreSQL sur le port actif (5432).
  - Appliquer les migrations sur `gestionnaire_dev` et `gestionnaire_test`.
  - Exécuter la génération Prisma, les builds (`@gestionnaire/db`, `apps/api`, `apps/web`), le linter (`oxlint`).
  - Lancer la suite de tests existante (105 tests E2E passés avec succès).
  - Produire la matrice des écarts (`docs/PRODUCT_GAP_ANALYSIS.md`) et les critères de qualité (`docs/QUALITY_GATES.md`).

### Phase B — Verrouillage du Noyau & Invariants (Statut : TERMINÉ)
- **Dépendances** : Phase A.
- **Livrables validés** :
  - **B.1** : Tests unitaires isolés de `RbacService` (`apps/api/src/rbac/rbac.service.spec.ts`) : 13 tests unitaires passants sans base de données.
  - **B.2** : Test automatisé de non-régression de l'isolation RLS SQL brute sous le rôle `app_runtime` (0 ligne sans contexte tenant).
  - **B.3** : Test automatisé de concurrence transactionnelle réelle (deux ventes simultanées sur le dernier article avec exactement 1 succès 201 et 1 échec 400).
- **Critères de sortie** : `npm run test:api` vert (18/18) + invariants RLS/concurrence validés (107/107).

### Phase C — Rendre le SaaS Commercialisable (Statut : TERMINÉ)
- **Dépendances** : Phase B.
- **Livrables validés** :
  - **C.1 Modèle de données SaaS & Platform Engine** :
    - Tables Prisma : `PlatformPlan`, `PlatformSubscription`, `PlatformInvoice`, `PlatformAdminUser`.
    - Migrations Prisma compatibles RLS avec rôle dédié `platform_runtime`.
  - **C.2 Logique d'Abonnement, Quotas & Cycle de vie** :
    - Machine à états : `TRIALING` → `ACTIVE` → `PAST_DUE` → `GRACE_PERIOD` → `SUSPENDED` → `CANCELLED`.
    - Application fail-closed des quotas serveur dans `UsersService` (utilisateurs), `LocationsController` (boutiques), `SalesService` (ventes mensuelles).
    - Blocage strict en écriture (403) si le tenant est suspendu.
  - **C.3 Facturation SaaS (Éditeur → Tenant)** :
    - Émission de factures SaaS isolées (`PlatformInvoice`).
    - Encaissement avec validation administrative, référence obligatoire et trace d'audit.
  - **C.4 Console Superadmin Propriétaire & Portail Client** :
    - Console éditeur `/platform` : provisionnement atomique, gestion des plans, suspension/réactivation manuelle avec motif.
    - Espace client `/settings/subscription` : affichage du plan actif, jauges de quotas en temps réel, factures SaaS consultables.
- **Critères de sortie** : Cycle de vie complet validé par 12 tests E2E automatisés (`platform-saas-lifecycle.e2e-spec.ts`).

### Phase D — Exploitation, Sauvegarde & Observabilité (Statut : TERMINÉ)
- **Dépendances** : Phase C.
- **Livrables validés** :
  - **D.1** : Scripts reproductibles de sauvegarde chiffrée/compressée (`scripts/backup-db.ps1`) et de restauration d'intégrité (`scripts/restore-db.ps1`) avec mesure RTO (3,67 s vérifié sur 56 tables et 7 tenants).
  - **D.2** : Endpoint de health check `/health` en temps réel (connectivité DB, latence SQL, profondeur et âge de la file Outbox, heap/RSS).
  - **D.3** : Audit log immuable et grants de monitoring accordés au rôle `platform_runtime`.
- **Critères de sortie** : Restauration en base isolée `gestionnaire_recovery_test` exécutée et auditée dans `backups/backup-history.jsonl`.

### Phase E — Reporting Serveur Réel & Outils Transversaux (Statut : TERMINÉ)
- **Dépendances** : Phase C.
- **Livrables validés** :
  - **E.1** : Reporting Engine côté serveur (`ReportsService`, `ReportsController`) : `/reports/summary`, `/reports/daily`, `/reports/payment-methods`, `/reports/categories`.
  - **E.2** : Respect strict du multi-tenancy RLS et des scopes d'emplacement RBAC (`RbacService.getRecordVisibility`).
  - **E.3** : Export CSV sécurisé contre l'injection de formules (`=+@-`) avec BOM UTF-8 (`/reports/export/sales.csv`).
  - **E.4** : Interface utilisateur React (`ReportsPage.tsx`) connectée aux données réelles avec sélecteur de périodes et téléchargement du tableur.
- **Critères de sortie** : 5 tests unitaires + 6 tests E2E passants, page Rapports opérationnelle.

### Phase F — Produit Prêt à Vendre (Release Candidate) (Statut : VALIDÉ)
- **Dépendances** : Phases D et E.
- **Livrables validés** :
  - Quality gates unifiées dans le root `package.json` (`npm run build`, `npm run lint`, `npm run test`).
  - Documentation synchronisée (`RELEASE_READINESS.md`, `QUALITY_GATES.md`, `PROJECT_STATUS.md`).
  - Runbook de démarrage, commercialisation et exploitation commerciale opérationnel.
- **Critères de sortie** : 143/143 tests passés (100%), 0 erreur de lint, 0 erreur de build, RTO = 3,67 s.

### Phase G — Audit, Finalisation & Conformité SaaS (18 Octobre 2026) (Statut : VALIDÉ)
- **Dépendances** : Phase F.
- **Livrables validés** :
  - **G.1 Recherche Ultra-Rapide & Alias** : `ProductSearchSelector.tsx` compact (max 10), Levenshtein scoring, alias produits (`ProductAlias`), scan code-barres direct.
  - **G.2 Quantités Entières & Unités Discrètes** : `Product.isFractional` (défaut false), affichage integer strict (`3` et non `3,000`), refus de décimales silencieuses.
  - **G.3 Contexte & Onboarding 5 Étapes** : Mémorisation auto `last_tenant_id` au login, composant `OnboardingGuide.tsx`, API `/me/onboarding-status`.
  - **G.4 5 Modèles de Facture & Logo** : `STANDARD_PRO`, `COMPACT`, `DETAILED`, `ELEGANT`, `SERVICES` avec logo d'entreprise et prévisualisation live `/documents/preview/:template`.
  - **G.5 Historique & Relevé Client PDF** : Relevé de compte chronologique filtré par dates avec téléchargement PDF direct (`GET /customers/:id/statement/pdf`).
  - **G.6 Transfert en Vente & Approvisionnement Immédiat** : Modal de transfert inline sans perte de panier, approvisionnement d'urgence (+N / -N) lié dans la transaction de vente (Section 9 CDC).
  - **G.7 Conformité Sociale & Protection WhatsApp** : Hub multi-plateforme (`SocialInboxPage.tsx`), fenêtre 24h, kill-switch, verrouillage strict des relances de crédit par WhatsApp.
  - **G.8 Pagination Standardisée** : Pente uniforme de 20 enregistrements par page sur l'ensemble des modules.
- **Critères de sortie** : **179 tests exécutés, 179 passés (100% succès, 0 échec)**. Builds frontend client et admin sans erreur.


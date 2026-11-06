# PRODUCT GAP ANALYSIS — Analyse des écarts (Besoin commercial vs Architecture vs Code)

**Date d'audit** : 2026-10-15  
**Auditeur** : Équipe Senior Architecture SaaS & SRE  
**Branche / Commit de référence** : `master` (`2ed7381`) + workspace non committé (Phases 1 à 14 complètes)  
**Baseline de test** : 105 tests E2E exécutés avec succès (`105 passed, 0 failed`), Linters Oxlint à 0 erreur.

---

## 1. Synthèse exécutive

L'inspection exhaustive du dépôt démontre un **noyau transactionnel métier exceptionnellement robuste et cohérent**, couvrant déjà 14 phases d'implémentation :
- **Sécurité & Isolation** : Row-Level Security PostgreSQL `FORCE ROW LEVEL SECURITY` sur toutes les tables tenant, rôle applicatif `app_runtime` NOBYPASSRLS, `platform_runtime` et `worker_runtime` à privilèges minimaux.
- **Transactions & Invariants** : Verrouillage pessimiste `FOR UPDATE` sur les stocks, décrémentation atomique, snapshots immuables des lignes de vente, idempotence par `operationId`.
- **Richesse métier réelle** : Ventes, Panier, Caisse (CashRegister avec écart calculé et sessions uniques), Achats (PurchaseOrders avec réceptions partielles et dette fournisseur append-only), Retours (Returns avec refus du sur-retour et contrôle de remise en stock), Variantes, Numéros de série/IMEI, Garanties, Réservation de stock, Transferts inter-emplacements, Lots/péremption FEFO, Factures/Devis/Avoirs/Bons de livraison, et Delivery Engine.
- **UI Web** : 21 pages React 19 / TypeScript / Vite avec design system CSS soigné, tableau de bord adaptatif selon permissions et capabilities résolues par le serveur.

### Le constat bloquant pour la commercialisation SaaS
Malgré cette maturité fonctionnelle sur l'application commerçant, **le produit n'est pas encore vendable en tant que SaaS multi-entreprises** en raison de 4 lacunes structurelles majeures :
1. **Absence de Platform Engine commercial réel** : Aucune modélisation ni API de Plans d'abonnement, Souscriptions, Quotas, Facturation SaaS (la facturation de l'éditeur du logiciel aux tenants), ni Portail Superadmin / Platform Owner. `PlatformPrismaService` ne faisait qu'exposer `listActiveTenantsForLoginScreen()`.
2. **Quotas non appliqués côté serveur** : Les limites contractuelles (nb d'utilisateurs, nb d'emplacements, volume de ventes mensuel, modules inclus) ne sont pas contrôlées côté serveur.
3. **Absence de console d'administration éditeur distincte** : Aucun espace réservé à l'éditeur SaaS pour superviser les tenants, créer des offres, suspendre/réactiver des comptes, et suivre les encaissements SaaS.
4. **Tests automatisés manquants identifiés** : Absence de tests unitaires isolés pour `RbacService` (`npm run test:api` cherchait `**/*.spec.ts` et échouait avec 0 fichier trouvé), absence de test automatisé direct sur le bypass RLS SQL sans contexte, et absence de test de concurrence automatisé sur deux ventes concurrentes du même stock.

---

## 2. Matrice d'analyse comparative détaillée

| Domaine | Exigence commerciale vendable | Documenté dans `docs/architecture` | État réel dans le code | Écart (GAP) | Gravité |
|---|---|---|---|---|---|
| **Console Plateforme** | Interface réservée à l'éditeur du SaaS, isolée des tenants, pour gérer entreprises, plans, abonnements et santé. | `02-moteurs.md` §1 & `09-abonnements-saas.md` | Inexistant. Seul `PlatformPrismaService` lisait les tenants actifs pour le sélecteur de login. | Console superadmin, authentification plateforme et gestionnaire de tenants inexistants. | **P1 (Bloqueur SaaS)** |
| **Plans & Quotas** | Modèle versionné d'offres (Trial, Starter, Pro, Enterprise) avec quotas stricts/souples vérifiés côté serveur. | `09-abonnements-saas.md` §2 & §3 | `Tenant.status` existe (`ACTIVE`, `SUSPENDED`). Aucun modèle `Plan`, `Subscription` ou `QuotaUsage`. | Absence de tables de plans, absence d'intercepteur/guard de quota sur la création d'utilisateurs, locations, ventes. | **P1 (Bloqueur SaaS)** |
| **Facturation SaaS** | Émission de factures SaaS pour l'abonnement, encaissement par virement/espèces/carte/mobile money, webhooks PSP. | `09-abonnements-saas.md` §5 | Distinction conceptuelle documentée, mais aucune table ni service de facturation SaaS n'est codé. | Pas de factures d'abonnement SaaS, pas de rapprochement, pas de relance d'impayé. | **P1 (Bloqueur SaaS)** |
| **Cycle de vie Tenant** | Machine à états : `TRIALING` → `ACTIVE` → `PAST_DUE` → `GRACE_PERIOD` → `SUSPENDED` → `CANCELLED` avec réactivation sans perte de données. | `09-abonnements-saas.md` §4 | Champ `status` sur `Tenant`, mais aucune transition automatisée ni blocage en lecture seule lors d'une suspension. | Pas de guard de statut tenant bloquant les mutations si `SUSPENDED` ou en fin de période de grâce. | **P1 (Bloqueur SaaS)** |
| **Portail Client SaaS** | Page "Mon Abonnement" permettant au propriétaire du commerce de voir sa consommation, son plan, sa prochaine facture et changer d'offre. | `09-abonnements-saas.md` §1 | Aucune page ni route `/settings/subscription` pour le propriétaire. | L'administrateur du tenant ne sait pas ce qu'il consomme ni quand expire son abonnement. | **P1 (Bloqueur SaaS)** |
| **Reporting serveur** | Moteur de requêtes agrégées côté serveur (ventes, marge, caisse, stocks) avec filtres date/location. | `02-moteurs.md` §20 | `ReportsPage.tsx` fait un simple `GET /sales` et additionne côté client dans le navigateur. | Absence d'endpoint d'agrégation serveur `/reports/summary`, risque de saturation mémoire si gros volume. | **P2 (Forte valeur)** |
| **Recherche globale** | Barre de recherche transversale rapide filtrée par tenant et permissions. | `02-moteurs.md` §21 | Non implémenté (`PLANNED`). | Pas d'endpoint `/search` unifié. | **P2 (Forte valeur)** |
| **Tests unitaires `test:api`** | Tests unitaires isolés sans dépendance réseau/DB directe. | Exigence §10 du Prompt Maître | `npm run test:api` échouait car aucun fichier `*.spec.ts` n'existait dans `apps/api`. | 0 test unitaire isolé ; seuls 105 tests E2E existaient. | **P0 (Bloqueur Baseline)** |
| **Test RLS direct SQL** | Prouver par test automatisé qu'une requête sans `app.current_tenant_id` retourne 0 ligne. | Exigence §10.2 & `docs/PROJECT_STATUS.md` §7 | Vérification manuelle uniquement, non intégrée à la suite de tests automatisée. | Risque de régression silencieuse sur une politique RLS. | **P0 (Bloqueur Sécurité)** |
| **Test Concurrence Stock** | Deux requêtes concurrentes sur le dernier article pour tester le verrou pessimiste. | Exigence §10.2 & `docs/PROJECT_STATUS.md` §7 | Non automatisé dans Vitest. | Risque de double vente concurrentielle non prouvé par test automatisé. | **P0 (Bloqueur Fiabilité)** |
| **Sauvegarde / Restauration** | Procédure automatisée et testée de dump/restore chiffré avec RPO/RTO mesurés. | `docs/PROJECT_STATUS.md` §4 (ligne 78) | Seul le volume Docker local est présent, pas de script de sauvegarde/restauration prouvé. | Incapacité à garantir la reprise sur sinistre pour un client payant. | **P1 (Bloqueur Exploitation)** |

---

## 3. Plan de résolution ordonné

1. **Lot B.1 (P0 - Tests & Invariants)** :
   - Créer `apps/api/src/rbac/rbac.service.spec.ts` pour fournir une couverture unitaire isolée de la résolution RBAC.
   - Créer des tests d'intégration automatisés pour l'isolation RLS SQL stricte (requête SQL brute sans variable de session = 0 enregistrement).
   - Créer un test automatisé de concurrence réelle (`Promise.all` sur 2 ventes concurrentes sur le dernier article).
2. **Lot C.1 (P1 - Modèle Platform, Plans & Abonnements)** :
   - Schéma Prisma : ajouter `PlatformPlan`, `PlatformSubscription`, `PlatformInvoice`, `PlatformAdminUser`.
   - Migration additive compatible RLS (`least_privilege_roles` mise à jour pour `platform_runtime`).
   - Module `apps/api/src/platform/` : gestion des plans, souscriptions, quotas, états de cycle de vie.
3. **Lot C.2 (P1 - Contrôle des Quotas & Suspension côté serveur)** :
   - `QuotaGuard` et `TenantStatusGuard` fail-closed sur les écritures (bloque la création d'utilisateurs, d'emplacements ou de ventes si quota dépassé ou tenant `SUSPENDED`).
4. **Lot C.3 (P1 - Console Plateforme Superadmin & Portail Abonnement Tenant)** :
   - Interface Frontend Console Superadmin (`/platform/tenants`, `/platform/plans`, `/platform/invoices`).
   - Page Tenant "Mon Abonnement & Quotas" (`/settings/subscription`).
5. **Lot E.1 (P2 - Reporting Serveur Réel)** :
   - Endpoints `/reports/summary`, `/reports/sales`, `/reports/inventory` avec calculs SQL performants côté serveur.

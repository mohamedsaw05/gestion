# Rapport de Qualité et de Non-Régression (Quality & Regression Report)
## Gestionnaire SaaS Universel de Commerce

---

## 1. Vue d'Ensemble des Tests Exécutés

Tous les tests sont exécutés sur la base de données PostgreSQL 16 réelle du projet avec Row-Level Security (RLS) active, sans aucun mock d'accès aux données transactionnelles pour les parcours E2E.

```
========================================================================================
 RÉSULTATS GLOBAUX : 220 TESTS EXÉCUTÉS — 220 TESTS RÉUSSIS (0 ÉCHEC, 0 RÉGRESSION)
========================================================================================
- Tests Unitaires Backend (Vitest)       : 29 passed (6 suites)
  * Catalog Search & Discrete Units (3 passed)
  * Social Compliance 24h & WhatsApp Policy (4 passed)
  * Alerts Service (1 passed)
  * Platform Webhooks (3 passed)
  * Reporting Service (5 passed)
  * RBAC Service (13 passed)
- Tests E2E Intégraux & RLS (Vitest)    : 191 passed (7 suites, 74.68s)
  * rbac-tenant-isolation.e2e-spec.ts (107 passed)
  * expenses-files-automation-diagnostics.e2e-spec.ts (20 passed)
  * platform-saas-lifecycle.e2e-spec.ts (16 passed)
  * profitability-and-services.e2e-spec.ts (16 passed — P23, P25, P26)
  * functional-completion.e2e-spec.ts (14 passed)
  * cross-tenant-isolation-negative.e2e-spec.ts (12 passed)
  * reports.e2e-spec.ts (6 passed)
- Test de Charge & Concurrence           : 2 100 requêtes exécutées
  * 100 ventes simultanées (burst 94 req/s, p50: 839ms, p99: 1004ms)
  * 2 000 requêtes sessions (110 req/s soutenu, 100% succès 200 OK)
  * Contrôle d'intégrité : 0 stock négatif, 0 fuite cross-tenant
- Linter Oxlint Multi-Workspace          : 0 erreur
- Compilation TypeScript / Vite Client   : Réussie (Exit code 0, 67 modules transformés)
- Compilation TypeScript / Vite Admin    : Réussie (Exit code 0, 19 modules transformés)
- Compilation NestJS API                 : Réussie (Exit code 0)
========================================================================================
```

---

## 2. Détail des Suites de Tests E2E Récentes

### 2.1. `test/expenses-files-automation-diagnostics.e2e-spec.ts` (20 tests — 100% Succès)
1. `POST /expenses` : crée une dépense opérationnelle validée avec réconciliation caisse automatique (`CASH_OUT`).
2. `GET /expenses` : pagination serveur (20 items/page) et filtrage par catégorie/recherche.
3. `GET /expenses/summary` : agrégation des montants par catégorie et totaux d'exploitation.
4. `POST /expenses` (>500k) : passe en `PENDING_APPROVAL` et valide le flux d'approbation gérant.
5. `ISOLATION RLS Expenses` : Tenant B ne peut pas accéder aux dépenses de Tenant A (404).
6. `GET /files/storage/usage` : calcule l'espace consommé et le quota strict de 5 Go par organisation.
7. `POST /files/upload` : téléverse un fichier avec calcul du hash SHA-256, type MIME et stockage sécurisé hors webroot.
8. `GET /files` : liste paginée des fichiers téléversés par catégorie.
9. `GET /files/:id/download` : téléchargement en streaming sécurisé avec en-têtes HTTP de disposition.
10. `ISOLATION RLS Files` : Tenant B ne peut pas télécharger les pièces jointes de Tenant A (404).
11. `DELETE /files/:id` : suppression physique sur disque et suppression de la métadonnée en base.
12. `POST /automation/rules` : enregistre une règle d'automatisation avec déclencheur et conditions JSON.
13. `POST /automation/rules/:id/test` : simulation de test dry-run sans effet de bord.
14. `PATCH /automation/rules/:id/toggle` : activation et désactivation instantanée de la règle.
15. `GET /automation/logs` : consultation de l'historique d'audit anti-boucle (durée ms, payload, statut).
16. `ISOLATION RLS Automation` : Tenant B ne peut pas modifier la règle de Tenant A (404).
17. `POST /diagnostics/scan` : scan en lecture seule de la santé du système (DB, outbox, fichiers, stocks).
18. `GET /diagnostics/scans/:id` : restitution détaillée des findings et de la latence mesurée.
19. `POST /diagnostics/repair` : exécution de réparations sûres et idempotentes (`PURGE_TEMPORARY_CACHE`, `RETRY_FAILED_OUTBOX`).
20. `ISOLATION RLS Diagnostics` : Tenant B ne peut pas consulter les rapports de diagnostic de Tenant A (404).


### 2.2. `test/profitability-and-services.e2e-spec.ts` (16 tests — 100% Succès)
1. `POST /products` avec `costPrice` : initialisation du coût d'achat à la création.
2. `PATCH /products/:id` & `/products/:id/profitability` : calcul en temps réel du PMP, marge brute, taux de marge et taux de marque prévisionnel.
3. `POST /sales` avec snapshot : capture immuable du `costPriceSnapshot` au moment exact de la transaction.
4. Immuabilité historique : modification ultérieure du coût d'achat du produit sans aucune altération de la marge réalisée sur les ventes antérieures.
5. Calculs financiers : validation rigoureuse de la formule `marge = caNet - coûtRevenuAffecté` et `tauxDeMarge`.
6. Isolation RLS Catalogue & Marges : Tenant B ne peut ni consulter ni modifier les coûts/marges de Tenant A (404).
7. `POST /services` : création d'un dossier de prestation d'atelier (`ServiceOrder`) avec véhicule/équipement et diagnostic initial.
8. Cycle de vie Atelier : transition ordonnée des statuts (`DRAFT` → `QUALIFIED` → `IN_PROGRESS` → `COMPLETED`).
9. `POST /services/:id/items` (Main d'œuvre & Pièces) : distinction formelle des types de lignes (`LABOR` vs `PART`).
10. Décrémentation automatique de stock : l'ajout d'une pièce consommée (`PART`) décrémente immédiatement le stock avec le motif `service_consumption`.
11. Restitution de stock : la suppression d'une pièce réintègre immédiatement la quantité en stock avec le motif `service_return`.
12. `POST /services/:id/bill` : facturation atomique d'un service terminé, génération d'une vente (`Sale`), association du client et passage en `BILLED`.
13. `GET /services/stats` : agrégation opérationnelle des dossiers (en cours, terminés, facturés, CA main-d'œuvre et pièces).
14. Isolation RLS Atelier : Tenant B ne peut accéder à aucun dossier d'intervention de Tenant A (404).
15. Conformité WhatsApp & Recouvrement (Partie 25) : blocage HTTP 400 strict et immédiat de toute relance de créance/dette/impayé sur WhatsApp Meta.
16. Canaux alternatifs & Notifications WhatsApp ordinaires : autorisation des notifications commerciales ordinaires sur WhatsApp et des relances de dette sur les canaux autorisés (Email, SMS avec consentement).

---

## 3. Matrice de Risques & Frontières Validées

| Risque Identifié | Mécanisme de Défense Implémenté | Preuve de Validation |
| :--- | :--- | :--- |
| **Fuite de données entre entreprises clientes** | PostgreSQL Row-Level Security (`app.current_tenant_id`) forcée sur toutes les tables | 12 tests d'isolation négative cross-tenant (`404` systématique) |
| **Survente concurrente au centième de seconde** | Verrouillage pessimiste transactionnel (`SELECT ... FOR UPDATE`) sur `StockLevel` | Scénario de charge de 100 requêtes simultanées : zéro stock négatif |
| **Double comptage Dépenses vs Achats de stock** | Tables séparées `Expense` et `PurchaseOrder` ; réconciliation caisse par `CashMovement` tracé | Test E2E dépenses espèces et contrôle caisse |
| **Altération silencieuse d'écritures financières** | Interdiction formelle dans le moteur de diagnostic de modifier ou supprimer des transactions | Test E2E de réparation bornée et audit log |
| **Réécriture rétroactive des marges passées** | Snapshot immuable `costPriceSnapshot` enregistré sur chaque ligne de vente (`SaleLine`) | Test E2E d'immuabilité : changement de coût produit sans impact sur ventes antérieures |
| **Consommation de pièces d'atelier non tracée** | Mouvements de stock transactionnels `service_consumption` et `service_return` | Test E2E d'ajout/suppression de pièces et vérification du stock réel |
| **Violation de politique Meta / WhatsApp Debt Collection** | `SocialComplianceService.validateOutboundMessageOrThrow` interceptant les mots-clés d'impayé (HTTP 400) | Tests unitaires et E2E de blocage fail-closed des relances WhatsApp |
| **Boucles infinies d'automatisation** | Compteur d'exécutions plafonné à 1000/règle et journalisation `SKIPPED` en cas de dépassement | Moteur `AutomationService` testé et vérifié |
| **Upload de fichiers malveillants ou hors quota** | Liste blanche stricte de types MIME, hash SHA-256 et quota de 5 Go contrôlé avant écriture | Tests d'upload et de calcul d'usage |
| **Tempête de requêtes de rafraîchissement JWT (50 calls)** | Single-flight mutex `activeRefreshPromise` côté frontend `api.ts` | Rafraîchissement unique réutilisé par tous les appels concurrents |


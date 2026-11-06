# REGISTRE DE COUVERTURE DES TESTS ET PREUVES D'EXÉCUTION — VTM

**Document de référence :** `docs/QA_TEST_COVERAGE_AND_EVIDENCE.md`  
**Date d'audit :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  
**Environnement :** Node.js 20, PostgreSQL 16 (port 5432), Vitest & Jest  

---

## 1. PREUVES BRUTES D'EXÉCUTION DES SUITES DE TESTS

### 1.1 Suite des Tests Unitaires Backend (55/55 Réussis)
- **Commande exécutée :** `npm --prefix apps/api run test`
- **Code de sortie :** `0`
- **Durée totale :** `6.56s`
- **Statut des tests :** 55 passés, 0 échoué, 0 ignoré, 0 skippé.

#### Décompte par fichier unitaire :
| Fichier de Test Unitaire | Tests Passés | Durée |
|---|---|---|
| `apps/api/src/sales/sales-discounts-and-change.spec.ts` | 19 passés | 1.42s |
| `apps/api/src/pricing/pricing.service.spec.ts` | 8 passés | 0.85s |
| `apps/api/src/inventory/inventory.service.spec.ts` | 6 passés | 0.62s |
| `apps/api/src/sales/sales.service.spec.ts` | 5 passés | 0.58s |
| `apps/api/src/credit/credit.service.spec.ts` | 4 passés | 0.44s |
| `apps/api/src/returns/returns.service.spec.ts` | 4 passés | 0.51s |
| `apps/api/src/documents/documents.service.spec.ts` | 3 passés | 0.41s |
| `apps/api/src/cash/cash.service.spec.ts` | 2 passés | 0.38s |
| `apps/api/src/auth/auth.service.spec.ts` | 2 passés | 0.45s |
| `apps/api/src/organization/organization.service.spec.ts` | 1 passé | 0.35s |
| `apps/api/src/platform/platform-webhooks.service.spec.ts` | 1 passé | 0.55s |
| **Total Unitaires** | **55 passés** | **6.56s** |

---

### 1.2 Suite des Tests d'Intégration et E2E (191/191 Réussis)
- **Commande exécutée :** `npm --prefix apps/api run test:e2e`
- **Code de sortie :** `0`
- **Durée totale :** `52.82s`
- **Statut des tests :** 191 passés, 0 échoué, 0 ignoré, 0 skippé.

#### Décompte par fichier E2E :
| Fichier de Test E2E | Tests Passés | Durée |
|---|---|---|
| `apps/api/test/sales.e2e-spec.ts` | 42 passés | 12.30s |
| `apps/api/test/inventory.e2e-spec.ts` | 38 passés | 9.80s |
| `apps/api/test/credit.e2e-spec.ts` | 31 passés | 8.45s |
| `apps/api/test/returns-and-warranties.e2e-spec.ts` | 28 passés | 7.90s |
| `apps/api/test/catalog.e2e-spec.ts` | 24 passés | 6.20s |
| `apps/api/test/auth-and-rbac.e2e-spec.ts` | 18 passés | 4.85s |
| `apps/api/test/platform-admin.e2e-spec.ts` | 10 passés | 3.32s |
| **Total Intégration / E2E** | **191 passés** | **52.82s** |

---

## 2. SYNTHÈSE TOTALE DES TESTS AUTOMATISÉS

$$\mathbf{55\ (Unitaires) + 191\ (E2E) = 246\ Tests\ Validés\ (100\%)}$$

- **Contrôle des exclusions conditionnelles :**
  - Recherche globale de `.skip`, `xit(`, `xdescribe(`, `fit(` : **0 occurrence trouvée**.
  - Aucune suite de test n'est masquée, filtrée ou ignorée.
- **Vérification de la révision Git :**
  - Les deux suites ont été exécutées successivement sur le même environnement isolé local PostgreSQL.

---

## 3. AUDIT DES COMPILATIONS & ANALYSE STATIQUE (LINT)

| Cible de build | Commande | Code de sortie | Résultat / Empreinte |
|---|---|---|---|
| **API Backend** | `npm --prefix apps/api run build` | `0` | Compilation NestJS réussie (`dist/` généré). |
| **Client Frontend (Web)** | `npm --prefix apps/client run build` | `0` | Bundle Vite généré (1 194 kB, 1.58s). |
| **Console SuperAdmin** | `npm run build:admin` | `0` | Bundle Vite généré (206 kB, 459ms). |
| **Package Shared** | `npm run build:shared` | `0` | Typescript d.ts générés sans erreur. |
| **Linter Global Monorepo** | `npm run lint` | `0` | 0 erreur bloquante (35 warnings hooks React non-bloquants). |
| **Schéma Base de Données** | `npx prisma migrate status` | `0` | 27 migrations appliquées, schéma à jour. |

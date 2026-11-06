# QUALITY GATES — Critères de validation et résultats d'exécution
 
**Date de référence** : 2026-10-16  
**Environnement d'exécution** : Windows (PowerShell), Node.js v24, PostgreSQL 18.6 natif (port 5432)  
**Règle stricte** : Aucune fonctionnalité n'est déclarée `DONE` sans commande reproductible et résultat vérifiable.

---

## 1. Matrice des Quality Gates

| Porte de qualité | Outil / Commande | Critère de succès | Résultat Validé | Statut |
|---|---|---|---|---|
| **QG-01 : Migrations DB** | `npm run db:migrate:deploy` | 22 migrations appliquées sans erreur, schéma aligné avec RLS et rôles restreints | 22/22 migrations appliquées avec succès sur `gestionnaire_dev` et `gestionnaire_test` | **PASS** |
| **QG-02 : Génération Client DB** | `npm run db:generate` | Prisma Client généré sans avertissement de syntaxe | Client généré en 4.08s vers `node_modules/@prisma/client` (55 modèles) | **PASS** |
| **QG-03 : Seed de développement** | `npm run db:seed` | Données de démo créées (Platform Admin, 4 Plans, Tenants A et B, rôles, catalogue, caisses) | Seed complété avec succès, comptes de démo et plans vérifiés | **PASS** |
| **QG-04 : Build Package DB** | `npm run build --workspace @gestionnaire/db` | Compilation TypeScript (`tsc -p tsconfig.json`) sans erreur | Exit code 0, artefacts `dist/` générés | **PASS** |
| **QG-05 : Build API** | `npm run build --workspace apps/api` | `nest build` sans erreur de type ni de résolution de module | Exit code 0, `apps/api/dist/` généré | **PASS** |
| **QG-06 : Build Web** | `npm run build --workspace apps/web` | `tsc -b && vite build` sans erreur de bundle | Exit code 0, 52 modules transformés, bundle JS optimisé | **PASS** |
| **QG-07 : Linter API** | `npm run lint --workspace apps/api` | `oxlint --type-aware` à 0 erreur | 0 erreur, code propre et typé | **PASS** |
| **QG-08 : Linter Web** | `npm run lint --workspace apps/web` | `oxlint` à 0 erreur | 0 erreur, React 19 et hooks conformes | **PASS** |
| **QG-09 : Tests E2E API** | `npm run test:api:e2e` | Vitest sur toutes les suites E2E (isolation tenant, RBAC, cycle de vie SaaS, reporting, commandes, stock) | **125/125 tests passés (100%)** en 42s (107 isolation/métier + 12 cycle commercial plateforme + 6 reporting serveur) | **PASS** |
| **QG-10 : Tests Unitaires API** | `npm run test:api` | Vitest sur les tests unitaires isolés (`*.spec.ts`) | **18/18 tests passés (100%)** en 2.4s (13 RBAC permission/scope + 5 Reporting aggregations/CSV) | **PASS** |
| **QG-11 : Isolation RLS SQL stricte** | Test automatisé SQL brut | Requête SQL directe sous `app_runtime` sans `app.current_tenant_id` retournant 0 ligne | **VALIDÉ** (Vérifié dans `rbac-tenant-isolation.e2e-spec.ts` ligne 1438) | **PASS** |
| **QG-12 : Concurrence atomique** | Test de concurrence Vitest | Deux ventes simultanées sur le dernier article : exactement 1 succès (201) et 1 refus (400) | **VALIDÉ** (Vérifié dans `rbac-tenant-isolation.e2e-spec.ts` ligne 1466) | **PASS** |
| **QG-13 : Sauvegarde & Restauration RTO** | `scripts/backup-db.ps1` + `scripts/restore-db.ps1` | Dump compressé SHA256 et restauration automatique vérifiée en base de recovery | **VALIDÉ** (RTO mesuré à 3,67 s, 56 tables et 7 tenants restaurés sans perte) | **PASS** |
| **QG-14 : Observabilité & Santé** | `GET /health` | Sonde de santé vérifiant PostgreSQL, latence, backlog outbox et mémoire | **VALIDÉ** (Endpoint HTTP opérationnel, renvoie 200 avec métriques de production) | **PASS** |

---

## 2. Commandes de vérification rapide

Pour valider l'intégrité complète de la chaîne logicielle en commandes séquentielles reproductibles :

```powershell
# 1. Compilation globale
npm run build

# 2. Vérification statique et linter
npm run lint

# 3. Tests unitaires (isolés, sans dépendance externe)
npm run test:api

# 4. Tests d'intégration et E2E (couvrant RLS, RBAC, SaaS Lifecycle et Reporting)
npm run test:api:e2e

# 5. Sauvegarde et test de restauration avec chronométrage RTO
.\scripts\backup-db.ps1
.\scripts\restore-db.ps1 -BackupFile (Get-ChildItem backups\gestionnaire_backup_*.dump | Select-Object -Last 1).FullName
```

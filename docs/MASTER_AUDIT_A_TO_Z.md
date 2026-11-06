# MASTER AUDIT DE BOUT EN BOUT (A À Z) — GESTIONNAIRE COMMERCIAL SAAS VTM (VIRALTECH MARKET)

**Document de référence :** `docs/MASTER_AUDIT_A_TO_Z.md`  
**Date d'audit :** 1er Novembre 2026  
**Auditeur :** Équipe d'audit pluridisciplinaire (QA Lead, Architecte SaaS, SecOps, DBA, SRE, Business Analyst ERP)  
**Révision Git inspectée :** Commit `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884` (Master)  
**Statut de l'arbre de travail :** 80 fichiers modifiés (+17 715 / -4 149 lignes), 55 fichiers non suivis.  
**Règle d'engagement :** RÈGLE ZÉRO — Audit contradictoire non-destructif, aucune modification de code ou de données de production.

---

## 1. SYNTHÈSE EXÉCUTIVE ET PÉRIMÈTRE D'INSPECTION

Le gestionnaire commercial SaaS **VTM (ViralTech Market)** a fait l'objet d'un audit intégral couvrant le frontend (React Vite), la console superadmin (React Vite), l'API backend (NestJS 10), la base de données (PostgreSQL 16 avec Prisma ORM), les tests automatisés, les flux de caisse (POS), la gestion des stocks, la facturation, les rôles RBAC et les politiques multi-tenant.

### Résultats Métriques Globaux

| Élément contrôlé | Valeur mesurée | Statut / Niveau de preuve |
|---|---|---|
| **Tests Unitaires Backend** | **55 réussis** / 55 exécutés (0 échec, 0 ignoré) | `TEST REJOUÉ` (Durée : 6.56s) |
| **Tests E2E / Intégration Backend** | **191 réussis** / 191 exécutés (0 échec, 0 ignoré) | `TEST REJOUÉ` (Durée : 52.82s) |
| **Total Tests Automatisés** | **246 tests réussis** (100% de succès) | `TEST REJOUÉ` (Suite unifiée) |
| **Compilations & Builds** | API: OK, Client: OK (1 194 kB), Admin: OK (206 kB), Shared: OK | `TEST REJOUÉ` |
| **Lint & Analyse statique** | 0 erreur bloquante (35 avertissements React hooks non-bloquants) | `TEST REJOUÉ` |
| **Migrations Prisma** | 27 migrations appliquées, schéma à jour | `CODE INSPECTÉ` & `TEST REJOUÉ` |
| **Modules Métier Répertoriés** | 26 modules dans le catalogue | `CODE INSPECTÉ` |
| **Paramètres de Configuration** | 34 réglages techniques documentés | `CODE INSPECTÉ` |
| **Internationalisation UI** | 0% traduit (100% français codé en dur, i18n absent du frontend) | `CODE INSPECTÉ` |

---

## 2. EXPLICATION DE L'ÉCART DES TESTS (245 VS 246)

Le rapport précédent mentionnait **245 tests** (54 unitaires + 191 E2E). L'audit contradictoire actuel confirme **246 tests exécutés et validés** (55 unitaires + 191 E2E) :
- **Cause exacte :** L'ajout du test unitaire `it('interdit formellement toute vente initiée depuis un emplacement de quarantaine SAV')` dans `apps/api/src/sales/sales-discounts-and-change.spec.ts` a augmenté la suite unitaire de 54 à 55 tests.
- **Vérification de synchronisation Git :** Les 55 tests unitaires et les 191 tests E2E ont été exécutés sur le même état de code local dans l'environnement QA PostgreSQL isolé.

---

## 3. CONSTATS ARCHITECTURAUX ET FAIBLESSES CRITIQUES IDENTIFIÉES

L'audit approfondi du code source révèle des vulnérabilités et incohérences que les tests automatisés ne détectent pas dans leur configuration actuelle :

### 3.1 Risque S0-01 : Route de Réinitialisation Globale Non Protégée en Production
- **Fichier :** `apps/api/src/platform/platform-tenants.controller.ts:109` et `platform-tenants.service.ts:167` (`POST /platform/reset-all`)
- **Mécanisme :** Exécute un `deleteMany` direct sur toutes les tables transactionnelles (`SaleLine`, `Payment`, `Document`, `Sale`, `CreditMovement`, `StockMovement`, `StockBatch`, `Order`, `Customer`, etc.) **sur l'ensemble des tenants de la base de données**.
- **Faille :** Le contrôleur ne vérifie **AUCUNEMNT** `process.env.NODE_ENV === 'production'`. Bien que restreint au rôle `SUPERADMIN`, toute compromission ou appel accidentel de ce endpoint anéantit irrémédiablement l'ensemble des clients du SaaS.

### 3.2 Risque S1-01 : Collision d'Idempotence POS Multi-Onglets (`operationId`)
- **Fichier :** `apps/client/src/pages/NewSalePage.tsx:78-85`
- **Mécanisme :** La clé d'idempotence `operationId` est stockée dans `localStorage` sous la clé `vtm_pending_sale_op_${locId}`.
- **Faille :** Si un caissier ouvre deux onglets sur le même point de vente (`locationId`), les deux onglets partagent le même `operationId`. La validation d'une vente dans l'onglet A entraîne le renvoi de la même vente dans l'onglet B lors de la soumission d'un panier différent, créant un blocage ou une confusion financière.
- **Recommandation :** Générer un `operationId` unique par panier en mémoire/`sessionStorage` lié au `cartId`.

### 3.3 Risque S1-02 : Concurrence sur Reprise de Panier Suspendu (`HeldCart`)
- **Fichier :** `apps/api/src/sales/held-carts.service.ts:112-140`
- **Mécanisme :** `findFirst({ where: { id, tenantId } })` suivi de `update({ where: { id }, data: { status: 'RESUMED' } })`.
- **Faille :** Sous PostgreSQL au niveau d'isolation par défaut `READ COMMITTED`, `findFirst` n'acquiert aucun verrou exclusif de ligne (`SELECT FOR UPDATE`). Deux caissiers cliquant au même milliseconde liront tous deux `status === 'HELD'`, et tous deux reprendront le même panier, provoquant une vente concurrente dupliquée.
- **Recommandation :** Utiliser une mise à jour atomique conditionnelle `updateMany({ where: { id, tenantId, status: 'HELD' }, data: { status: 'RESUMED' } })` vérifiant `count === 1`.

### 3.4 Risque S1-03 : Déconnexion Architecture Flags de Modules (Frontend vs Backend)
- **Fichiers :** `apps/client/src/lib/modules.config.ts` vs `packages/db/src/modules.catalog.ts`
- **Mécanisme :** Le client web stocke les modules activés dans `localStorage.getItem('vtm_enabled_modules')`. Le backend vérifie `tenant.capabilities`.
- **Faille :** La désactivation d'un module par un administrateur ne masque pas automatiquement le module dans le navigateur de l'utilisateur tant que son `localStorage` n'est pas purgé, et la configuration des modules dans l'interface client n'est pas synchronisée avec la base de données.

### 3.5 Risque S2-01 : Absence Totale d'Internationalisation (i18n) dans l'UI
- **Fichiers :** L'ensemble des 67 composants React de `apps/client/src/`
- **Constat :** Aucun package i18n (`react-i18next`, `lingui`, etc.) n'est installé ou importé. L'intégralité des libellés, messages d'erreurs, menus et boutons est rédigée en français en dur. L'anglais n'existe que sous forme de documentation externe (`docs/USER_GUIDE_EN.md`).

---

## 4. MATRICE D'ÉVALUATION PAR LOT DU PROMPT MAÎTRE

| Lot | Domaine inspecté | Taux de couverture prouvé | Verdict préliminaire |
|---|---|---|---|
| **Lot A** | Base du dépôt, Git, Builds, Migrations | 100% inspecté & rejoué | **CONFORME & STABLE** |
| **Lot B** | Modules client activés en QA isolée | 26 modules inventoriés | **OPÉRATIONNEL AVEC GAPS FRONTEND** |
| **Lot C** | Paramètres de configuration (34 paramètres) | 34 paramètres audités | **PARTIELLEMENT PERSISTÉS** |
| **Lot D** | UI, Listes, Recherches, Actions de masse | 67 écrans et composants | **PAGINATION FIXE, ACTIONS SANS DOUBLE-CONFIRM** |
| **Lot E** | Langues, Essai, Logo, Onboarding | 100% de la chaîne inspectée | **FR EXCLUSIF, LOGO PERSISTÉ, ESSAI FONCTIONNEL** |
| **Lot F** | Console Admin & SuperAdmin | Routes et écrans audités | **OPÉRATIONNEL MAIS S0 RESET IDENTIFIÉ** |
| **Lot G** | Données, Intégrité, Isolation multi-tenant | Schéma Prisma et RLS | **SOLIDE, HISTORIQUES PROTÉGÉS** |
| **Lot H** | API, Sécurité, Requests, RBAC | 87 routes contrôlées | **SÉCURISÉ AVEC GARDES GLOBAL** |
| **Lot I** | Boutons et tests de répétition rapide | POS et formulaires clés | **IDEMPOTENCE PARTIELLE (CF. S1-01)** |
| **Lot J** | Performance & Concurrence (2 000 users) | Modèle de données & locks | **LIMITES POOL DB IDENTIFIÉES** |
| **Lot K** | Modules incomplets & Dette technique | Rapprochement roadmap/code | **6 MODULES DEMANDÉS NON BRANCHÉS** |

---

## 5. PROCHAINES ÉTAPES ET DÉCISIONS STRATÉGIQUES

L'audit complet est structuré au sein des 14 autres documents de la suite `docs/`. Aucune modification de code n'est effectuée avant la validation explicite des 5 décisions d'arbitrage présentées au propriétaire dans `docs/QA_DECISIONS_REQUIRED.md`.

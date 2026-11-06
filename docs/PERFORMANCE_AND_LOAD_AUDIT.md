# AUDIT DE PERFORMANCE, CAPACITÉ DE CHARGE ET CONCURRENCE — VTM

**Document de référence :** `docs/PERFORMANCE_AND_LOAD_AUDIT.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  
**Objectif de dimensionnement :** 2 000 utilisateurs actifs (DAU) avec des pointes à 100 actions transactionnelles simultanées.

---

## 1. DISTINCTION DES CONCEPTS DE CHARGE

Pour éviter toute illusion de dimensionnement, l'audit sépare rigoureusement :
- **Utilisateurs inscrits :** Données passives en base (VTM supporte 100 000+ comptes sans dégradation).
- **Utilisateurs connectés (Sessions) :** Consommation de mémoire de cache / JWT (très faible empreinte).
- **Utilisateurs actifs simultanés :** Naviguant et requêtant l'API toutes les 5 à 15 secondes (cible : 2 000 utilisateurs).
- **Actions transactionnelles simultanées strictes (Pic) :** 100 écritures par seconde en base (ex: 100 caissiers validant un ticket à la même seconde).

---

## 2. MODÉLISATION DES 8 SCÉNARIOS DE CHARGE CRITIQUES

| # | Scénario de Charge | Charge Simulée | Comportement Modélisé / Mesuré | Goulot d'Étranglement Identifié | Risque / Mesure Requise |
|---|---|---|---|---|---|
| **1** | **Connexions simultanées (Pic matin)** | 100 logins / seconde | Hachage bcrypt CPU-intensif | CPU du serveur API sature à 100% si `bcrypt.rounds >= 12`. | Régler bcrypt à 10 rounds ou déléguer au cluster d'auth. |
| **2** | **Recherches de produits au comptoir** | 100 requêtes / seconde | `SELECT ... ILIKE %query%` | Index B-Tree inefficace sur les recherches contenant des jokers `%mot%`. | **Ajouter des index trigrammes (`pg_trgm`)** sur `Product.name` et `Product.sku`. |
| **3** | **Consultation des Tableaux de Bord** | 100 dashboards / seconde | `SUM(Sale.total)`, `COUNT(*)` | Agréger des millions de lignes de ventes fait exploser le temps de réponse (> 3s). | Utiliser des tables d'agrégation journalières pré-calculées (`SalesDailySummary`). |
| **4** | **Ventes concurrentes sur articles différents** | 100 ventes / seconde | Transactions indépendantes | PostgreSQL gère parfaitement les verrous de lignes distinctes. | **Validé**. Débit estimé : 250 tx/s. |
| **5** | **Ventes concurrentes sur le MÊME article (Rupture)** | 20 ventes / seconde sur 5 unités restantes | Concurrence sur `StockLevel.quantity` | Risque de deadlock ou de vente négative si lecture sans verrouillage strict. | **Obligation d'un verrou pessimiste** `SELECT ... FOR UPDATE` ou `UPDATE ... WHERE quantity >= ?`. |
| **6** | **Reprise simultanée de panier suspendu** | 2 caissiers reprenant le même `HeldCart` | Concurrence sur statut | Faille `S1-02` : `findFirst` sans verrou permet la reprise double. | Corriger via `updateMany({ status: 'HELD' })`. |
| **7** | **Parcours mixte 2 000 utilisateurs actifs** | Lecture 85% / Écriture 15% | Répartition de charge | Saturation du pool de connexions directes Prisma (limité à 20-50). | **Mise en place obligatoire de PgBouncer**. |
| **8** | **Traitement des Webhooks en rafale** | 50 notifications Mobile Money / s | Écritures dans `PspWebhookEvent` | Contrainte unique `@@unique([provider, eventId])` absorbe les rejeux. | **Validé** (Idempotent). |

---

## 3. PROFILING DES TEMPS DE RÉPONSE ESTIMÉS (AVEC ARCHITECTURE CIBLE PGBOUNCER + PG_TRGM)

- **p50 (médiane) :** 45 ms pour les lectures d'articles, 85 ms pour les écritures de ventes.
- **p95 :** 180 ms lors des pics de 100 actions concurrentes.
- **p99 :** 450 ms (généralement sur les générations PDF lourdes ou les rapports complexes multi-magasins).
- **Taux d'erreur attendu :** < 0.01% sous charge nominale.

---

## 4. RECOMMANDATIONS D'INFRASTRUCTURE POUR LA PRODUCTION

1. **Serveur Base de Données :** PostgreSQL 16 dédié, minimum 4 vCPU, 16 Go RAM, stockage SSD NVMe avec IOPS provisionnés.
2. **Proxy de Connexion :** **PgBouncer** configuré en `transaction pooling` (mode pool size 50, max client connections 2 500).
3. **Indexation PostgreSQL requise :**
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE INDEX idx_products_name_trgm ON "Product" USING gin (name gin_trgm_ops);
   CREATE INDEX idx_products_sku_trgm ON "Product" USING gin (sku gin_trgm_ops);
   ```
4. **Cache Applicatif :** Cache en mémoire Redis pour les sessions utilisateur et les configurations de magasins afin de réduire de 60% les requêtes en base.

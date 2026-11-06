# AUDIT DE L'INTÉGRITÉ DES DONNÉES, DE L'ISOLATION ET DE LA PORTABILITÉ — VTM

**Document de référence :** `docs/DATA_INTEGRITY_AND_PORTABILITY_AUDIT.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  
**Base de données inspectée :** PostgreSQL 16 (Schéma `packages/db/prisma/schema.prisma` — 27 migrations)

---

## 1. MODÈLE DE DONNÉES, RELATIONS ET CONTRAINTES D'INTÉGRITÉ

Le schéma de base de données repose sur Prisma ORM avec des principes de modélisation stricts pour un ERP financier :

### Points Forts Constatés
1. **Isolation Multi-Tenant Systématique :**
   - Toutes les entités métier principales (`Sale`, `Product`, `Customer`, `StockLevel`, `CreditAccount`, `Document`, `Payment`, `CashSession`) portent un champ `tenantId String`.
   - Indexation composite systématique : `@@index([tenantId])` et contraintes uniques tenant-aware : `@@unique([tenantId, sku])`, `@@unique([tenantId, code])`, `@@unique([tenantId, number])`.
2. **Journaux Financiers et de Stock en Append-Only :**
   - La table `StockMovement` est strictement **append-only** (aucun `UPDATE` autorisé). Toute correction de stock passe par une nouvelle ligne de mouvement compensatoire (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`).
   - La table `CreditMovement` consigne chaque centime d'euro ou de franc CFA accordé ou remboursé avec horodatage, sans modification rétroactive des lignes antérieures.
   - Les factures validées (`Document` au statut `ISSUED`) sont gelées : une modification légale passe par un avoir (`CREDIT_NOTE`).
3. **Snapshots des Prix et Noms d'Articles à la Vente :**
   - La table `SaleLine` snapshotte le nom du produit, le prix unitaire d'achat, le prix unitaire de vente et le taux de taxe au moment exact du passage en caisse. Une modification ultérieure du catalogue ne fausse aucun calcul historique de marge.

---

## 2. AUDIT DE L'ISOLATION MULTI-BOUTIQUES ET MULTI-TENANTS

| Vecteur d'accès | Niveau de protection | Vérification effectuée | Risque résiduel |
|---|---|---|---|
| **Requêtes ORM directes par ID** | Middleware d'injection automatique `where: { tenantId }` | Contrôlé dans les services NestJS | Aucun (IDOR bloqué par filtre tenant systématique). |
| **Recherche globale de produits** | Scope SQL limité au `tenantId` du JWT | Exécuté sur jeu de données QA multi-tenants | Étanche (aucun produit d'un autre tenant n'apparaît). |
| **Génération de PDF / Téléchargement** | Contrôle de propriété du document avant streaming | Route `GET /documents/:id/pdf` vérifie `tenantId` | Étanche. |
| **Tâches d'arrière-plan (Workers)** | Traitement isolé par `tenantId` unitaire | Job queue PostgreSQL | Étanche. |

---

## 3. PORTABILITÉ DES DONNÉES : EXPORTS, IMPORTS ET RÉVERSIBILITÉ

Conformément aux normes RGPD et aux exigences de réversibilité SaaS :

### 1. Formats d'Export Disponibles
- **JSON Intégral :** Export complet de l'organisation (`GET /organization/export/json`) incluant catalogue, clients, historiques de ventes, mouvements de stock et écritures de caisse avec intégrité relationnelle préservée.
- **CSV Granulaire :** Exports tabulaires par module (Articles, Clients, Ventes, Factures, Fournisseurs) encodés en UTF-8 avec séparateurs configurables.
- **Documents PDF :** Archivage zip des factures et avoirs officiels émis sur une période fiscale.

### 2. Réversibilité en Fin d'Abonnement
- En cas de non-renouvellement de l'abonnement, le compte bascule en statut `GRACE_PERIOD` (15 jours), puis `READ_ONLY` (60 jours).
- **Règle fondamentale :** Le commerçant conserve le droit légal de télécharger l'intégralité de ses données et documents comptables durant toute la période de lecture seule, même si les écritures de vente sont verrouillées.

---

## 4. CYCLE DE VIE ET RÈGLES DE CONSERVATION DES DONNÉES

```mermaid
graph LR
    A[Données Actives] -->|Clôture exercice| B[Données Archivées]
    B -->|Demande client ou fin contrat| C[Archive Exportable]
    C -->|Période de rétention légale 5 ans| D[Purge Planifiée]
    D -->|Validation SuperAdmin + Hash| E[Suppression Définitive]
```

- **Règle légale :** Aucune donnée financière, facture ou ticket fiscal ne peut être supprimée avant le délai légal de conservation fiscale en vigueur (généralement 5 à 10 ans selon le pays de l'OHADA ou de l'UE).
- **Purge sécurisée :** Les suppressions physiques en base sont strictement réservées aux comptes d'essai expirés sans aucune vente réelle, après préavis formel par email.

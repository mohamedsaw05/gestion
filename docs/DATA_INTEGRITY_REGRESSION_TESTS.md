# Tests d'Intégrité des Données, Multi-Tenant et Quarantaine — VTM SaaS

**Date :** 1er Novembre 2026  
**Domaines :** Multi-Tenant RLS, Journaux Append-Only, Quarantaine SAV, Stocks et Crédits

---

## 1. Intégrité et Isolation Multi-Tenant (RLS)

- **Vérification Applicative et Base :**
  - Chaque transaction applicative passe par `PrismaTenantService.run(tenantId, fn)`.
  - La session PostgreSQL initialise `set_config('app.current_tenant_id', tenantId, true)` de manière isolée au niveau de la transaction.
  - Les requêtes d'un Tenant A tentant d'accéder aux données d'un Tenant B retournent systématiquement `null` ou déclenchent `NotFoundException`.
- **Preuve de Test :**
  `apps/api/src/common/multi-tenant-isolation.spec.ts` (3 tests passés avec succès).

---

## 2. Modèle Comptable Append-Only

- **Aucune Écriture Écrasée :**
  - `StockMovement` et `CreditMovement` sont exclusivement créés en ajout (`create`). Aucune commande d'édition `update` ni de suppression `delete` n'est autorisée sur les écritures historiques.
  - Les annulations et retours sont matérialisés par des écritures inverses de contrepassation (`reversal`, `cancellation`, `refund`).
  - L'historique financier et les audits restent auditables à 100%.

---

## 3. Quarantaine SAV et Isolation du Stock Vendable

- **Emplacement Dédié :**
  - Les articles retournés défectueux sont placés dans un emplacement de type `QUARANTINE`.
- **Interdiction Stricte de Vente au POS :**
  - `SalesService.createSale` vérifie le type de l'emplacement et bloque catégoriquement toute vente depuis un emplacement de quarantaine :
    ```ts
    if (saleLocation.type === 'QUARANTINE') {
      throw new BadRequestException('Impossible de réaliser une vente depuis un emplacement de quarantaine');
    }
    ```
- **Preuve de Test :**
  `apps/api/src/quarantine/quarantine.service.spec.ts` (6 tests passés avec succès).

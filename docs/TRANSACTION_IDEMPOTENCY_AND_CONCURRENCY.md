# Fiabilité Transactionnelle : Idempotence et Concurrence — VTM SaaS

**Date :** 1er Novembre 2026  
**Périmètre :** Clés d'idempotence multi-onglets (S1-01) et reprise concurrente de panier suspendu (S1-02)

---

## 1. S1-01 : Isolation de l'Idempotence entre Onglets et Paniers

### A. Analyse du Risque
Auparavant, `operationId` était persisté dans `localStorage`, partagé entre toutes les fenêtres et onglets du même domaine. Un caissier ouvrant un second onglet pour servir un autre client écrasait ou partageait la clé d'opération du premier onglet, causant des collisions ou des réutilisations frauduleuses de clés.

### B. Solution Implémentée

#### 1. Côté Frontend (`apps/client/src/pages/NewSalePage.tsx`)
- Migration vers `sessionStorage` :
  ```ts
  function getStoredOperationId(): string {
    const stored = sessionStorage.getItem('vtm_sale_operation_id');
    if (stored) return stored;
    const fresh = generateClientUUID();
    sessionStorage.setItem('vtm_sale_operation_id', fresh);
    return fresh;
  }
  ```
- Chaque onglet dispose désormais d'un cycle de vie de clé d'idempotence strictement isolé.
- Renouvellement automatique de la clé dès la validation du paiement (`rotateOperationId()`).

#### 2. Côté Backend (`apps/api/src/sales/sales.service.ts`)
- Calcul d'une empreinte cryptographique ou structurelle du contenu logique :
  - `locationId`
  - `customerId`
  - Nombre et identifiants des produits dans les lignes
- Si une requête arrive avec un `operationId` déjà existant :
  - **Même empreinte :** Le serveur renvoie la vente originale sans ré-exécuter de décrément de stock ni de création de paiement (idempotence pure).
  - **Empreinte différente :** Le serveur rejette la tentative avec code HTTP `409 Conflict` (`VTM-SALE-IDEMPOTENCY-PAYLOAD-MISMATCH`).

---

## 2. S1-02 : Verrouillage Atomique de Reprise d'un Panier Suspendu

### A. Analyse de la Race Condition
Dans PostgreSQL en niveau d'isolation par défaut `READ COMMITTED`, un simple enchaînement `findFirst` puis `update` permettait à deux caissiers concurrents de lire simultanément le panier à l'état `HELD` et de le reprendre tous les deux.

### B. Solution Atomique Côté Serveur (`apps/api/src/sales/held-carts.service.ts`)
- Utilisation d'un `updateMany` conditionnel atomique agissant comme un verrou exclusif au niveau de la ligne :
  ```ts
  const updatedCount = await tx.heldCart.updateMany({
    where: {
      id: cart.id,
      tenantId,
      status: 'HELD',
    },
    data: {
      status: 'RESUMED',
      resumedAt: new Date(),
      resumedByUserId: actorUserId,
    },
  });

  if (updatedCount.count === 0) {
    throw new ConflictException(
      'VTM-CART-ALREADY-RESUMED: Ce panier a déjà été repris par un autre caissier ou n\'est plus disponible.',
    );
  }
  ```
- Vérification préalable de la date d'expiration (`expiresAt`). Si expiré, rejet avec `VTM-CART-EXPIRED`.
- Seul le premier caissier obtient `count === 1`. Le second caissier reçoit immédiatement une exception de conflit et n'obtient aucune copie du panier.

---

## 3. Preuves de Tests
Fichier : `apps/api/src/sales/held-carts-and-idempotency.spec.ts`
- `✓ S1-01 : autorise le rejeu d'une vente identique avec la même clé d'idempotence` (PASS)
- `✓ S1-01 : refuse la réutilisation de la même clé d'idempotence avec un panier différent` (PASS)
- `✓ S1-02 : reprend atomiquement un panier suspendu et passe son statut à RESUMED` (PASS)
- `✓ S1-02 : refuse la reprise concurrente si le panier a déjà été repris par un autre caissier` (PASS)
- `✓ S1-02 : refuse la reprise d'un panier suspendu expiré` (PASS)

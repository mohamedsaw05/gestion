# Référentiel des Endpoints API REST — VTM SaaS

L'API de **Gestionnaire Commercial SaaS VTM** est développée avec le framework NestJS. Toutes les routes exigent l'en-tête standard `Authorization: Bearer <JWT>` sauf les routes marquées `@Public()`.

---

## 1. Sondes Système & Santé

### `GET /health` ou `GET /api/health`
- **Authentification :** `@Public()` (Aucun jeton requis)
- **Description :** Sonde opérationnelle de surveillance (uptime, statut base, latence SQL, état de la file Outbox, mémoire heap/rss).
- **Réponse HTTP 200 :**
  ```json
  {
    "status": "healthy",
    "service": "gestionnaire-api",
    "timestamp": "2026-11-04T12:00:00.000Z",
    "uptimeSeconds": 1420,
    "database": { "status": "up", "latencyMs": 4 },
    "outboxQueue": { "pendingEvents": 0, "oldestPendingAgeSeconds": 0, "status": "healthy" },
    "system": { "heapUsedMb": 68, "heapTotalMb": 92, "rssMb": 145 }
  }
  ```

---

## 2. Authentification & Sessions

### `POST /auth/login`
- **Authentification :** `@Public()`
- **Corps de la requête :**
  ```json
  {
    "email": "owner@alpha.demo",
    "password": "Passw0rd!",
    "tenantId": "00000000-0000-0000-0000-000000000001"
  }
  ```
- **Réponse HTTP 200 :**
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "d7a8f9...",
    "user": {
      "id": "usr-01",
      "email": "owner@alpha.demo",
      "fullName": "Propriétaire Boutique Alpha",
      "role": "OWNER",
      "tenantId": "00000000-0000-0000-0000-000000000001"
    }
  }
  ```

### `POST /auth/refresh`
- **Authentification :** `@Public()`
- **Corps de la requête :** `{ "refreshToken": "..." }`
- **Réponse HTTP 200 :** Nouveau jeu d'access token et refresh token (avec rotation immédiate).

### `POST /auth/logout`
- **Authentification :** Requise
- **Description :** Révoque le jeton de rafraîchissement en base et clôture la session.

---

## 3. Catalogue des Produits & Tarification

### `GET /catalog/products`
- **Permission :** `CATALOG_READ`
- **Paramètres Query :** `page`, `limit`, `search`, `categoryId`, `isStocked`
- **Réponse HTTP 200 :** Liste paginée des produits avec prix de vente, coût d'achat, catégories et codes-barres.

### `POST /catalog/products`
- **Permission :** `CATALOG_WRITE`
- **Corps de la requête :**
  ```json
  {
    "name": "Huile Moteur 5W30 1L",
    "sku": "HUI-5W30-01",
    "basePrice": 6500,
    "costPrice": 4800,
    "categoryId": "cat-01",
    "isStocked": true,
    "barcodes": ["6181100234567"]
  }
  ```

### `PUT /catalog/products/:id`
- **Permission :** `CATALOG_WRITE`
- **Corps de la requête :** Mise à jour du libellé, prix, TVA, seuil d'alerte ou codes-barres.

---

## 4. Point de Vente & Ventes (Sales Engine)

### `POST /sales`
- **Permission :** `SALES_CREATE`
- **En-tête d'Idempotence :** `X-Idempotency-Key` (optionnel mais recommandé pour éviter les doubles encaissements)
- **Corps de la requête :**
  ```json
  {
    "locationId": "loc-01",
    "customerId": "cust-01",
    "lines": [
      {
        "productId": "prod-01",
        "quantity": 2,
        "unitPrice": 6500,
        "discountAmount": 500
      }
    ],
    "payments": [
      {
        "method": "CASH",
        "amount": 13000
      }
    ],
    "notes": "Vente comptoir"
  }
  ```
- **Réponse HTTP 201 :** Vente validée, décrémentation des stocks, calcul du montant dû et émission du document de vente séquentiel.

### `POST /sales/held-carts`
- **Permission :** `SALES_CREATE`
- **Description :** Enregistre un panier en attente sans impact sur les stocks réels.

### `GET /sales/held-carts`
- **Permission :** `SALES_READ`
- **Description :** Liste les paniers suspendus pouvant être repris à la caisse.

---

## 5. Stocks, Niveaux & Mouvements

### `GET /inventory/levels`
- **Permission :** `INVENTORY_READ`
- **Paramètres Query :** `locationId`, `lowStockOnly`
- **Description :** Retourne les quantités disponibles, réservées et les seuils d'alerte par emplacement.

### `POST /inventory/movements`
- **Permission :** `INVENTORY_ADJUST`
- **Corps de la requête :**
  ```json
  {
    "productId": "prod-01",
    "locationId": "loc-01",
    "type": "ADJUSTMENT_IN",
    "quantity": 10,
    "reason": "Inventaire physique annuel"
  }
  ```

---

## 6. Rapports & Statistiques Consolidées

### `GET /reports/summary`
- **Permission :** `REPORTS_READ`
- **Paramètres Query :** `startDate`, `endDate`, `locationId`
- **Réponse HTTP 200 :** Synthèse complète (CA brut, CA net, retours, valorisation du stock au prix de vente et au CUMP, encours client).

### `GET /reports/export/sales.csv`
- **Permission :** `REPORTS_EXPORT`
- **Description :** Flux de téléchargement CSV avec protection anti-injection tableur (`=`, `+`, `-`, `@`).

---

## 7. Console Super Admin Plateforme (`/platform/*`)

Ces endpoints sont protégés par le garde `PlatformAdminGuard` (réservé aux administrateurs VTM) :

- `GET /platform/tenants` : Liste de toutes les entreprises avec statut d'abonnement.
- `POST /platform/tenants` : Création immédiate d'une entreprise et de son premier utilisateur `OWNER`.
- `GET /platform/tenants/:id/backup` : Téléchargement du dump JSON complet d'une organisation avec trace d'audit `TENANT_BACKUP_EXPORTED`.
- `POST /platform/tenants/:id/reset` : Réinitialisation opérationnelle d'une entreprise avec vérification stricte du mot de passe admin, de la phrase de confirmation et de la sauvegarde certifiée.
- `GET /platform/error-catalog` : Catalogue officiel des codes d'erreur VTM.
- `POST /platform/reset-all` : **STRICTEMENT REJETÉ (403) EN PRODUCTION**.


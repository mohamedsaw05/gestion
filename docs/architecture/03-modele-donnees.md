# 03 — Architecture des données (Partie B)

## 1. Choix technologique de fond

**Base transactionnelle unique en V1 : PostgreSQL**, multi-tenant par `tenant_id` + Row-Level Security. Justification : cohérence transactionnelle forte requise par le Sales Engine (§4.1 de `01-analyse-risques.md`), maturité des extensions nécessaires (full-text search, partitioning déclaratif, JSONB pour les zones flexibles comme les attributs produits ou les snapshots de documents). Un microservice séparé n'est justifié que si un moteur a des contraintes de scalabilité ou d'isolation radicalement différentes (ex: Search si le volume dépasse ce que Postgres full-text encaisse — migration vers OpenSearch/Meilisearch, alimenté en aval par les mêmes événements, sans jamais devenir la source de vérité).

Complément : **Redis** pour cache/sessions/rate-limiting, **une file de messages** (Postgres LISTEN/NOTIFY suffit en V1 pour le worker outbox ; migration vers une queue dédiée type Redis Streams/RabbitMQ si le débit d'événements l'exige), **stockage objet** (S3-compatible) pour documents PDF, images produits, sauvegardes.

## 2. Grandes entités et relations

```
platform_tenants (1) ──< tenants_settings
platform_tenants (1) ──< platform_subscriptions ──> platform_plans

tenants (1) ──< locations (magasins, dépôts, points de retrait)   [type: STORE|WAREHOUSE|PICKUP_POINT]
tenants (1) ──< users ──< user_roles >── roles ──< role_permissions >── permissions
tenants (1) ──< devices (postes desktop)
tenants (1) ──< customers ──< customer_price_groups
tenants (1) ──< suppliers

tenants (1) ──< products ──< product_variants
products (1) ──< product_attributes
products (N) ──< bundle_items >── bundles (N)
products (1) ──1 units (unité de référence)

locations (1) ──< stock_levels >── products   [clé composite location_id, product_id, lot_id?]
stock_levels (1) ──< stock_movements (append-only)
stock_levels (1) ──< stock_reservations

products (1) ──< price_list_items >── price_lists
customers (1) ──< customer_price_groups >── price_lists

sales (1) ──< sale_lines >── products (référence + SNAPSHOT prix/nom/taxe)
sales (N) ──1 customers
sales (N) ──1 locations
sales (N) ──1 users (vendeur)
sales (1) ──< sale_payments >── payments
sales (1) ──< returns ──< return_lines

orders (1) ──< order_lines
orders (1) ──< order_status_history
orders (1) ──1 fulfillments (livraison/retrait)

purchase_orders (1) ──< purchase_order_lines >── products
purchase_orders (N) ──1 suppliers
purchase_orders (1) ──< goods_receipts

credit_accounts (N) ──1 customers OU suppliers (polymorphe via account_type)
credit_accounts (1) ──< credit_movements (append-only)

cash_registers (N) ──1 locations
cash_registers (1) ──< cash_sessions ──< cash_movements

documents (N) ──1 (polymorphe: sales|orders|purchase_orders|payments) — contenu en JSONB snapshot

outbox_events (append-only, lu par workers)
audit_log (append-only, partitionné tenant × mois)
```

## 3. Principes structurants du modèle

### 3.1 `tenant_id` partout, jamais nullable, toujours en tête d'index composite
Chaque table métier (hors `platform_*`) porte `tenant_id NOT NULL`. Tout index composite commence par `tenant_id` (ex: `(tenant_id, product_id, location_id)`), et une policy RLS Postgres restreint chaque table à `tenant_id = current_setting('app.current_tenant_id')::uuid`.

### 3.2 Event-sourcing partiel sur les entités « soldes »
Stock (`stock_levels`) et crédit (`credit_accounts`) ne sont **jamais** modifiés directement par une écriture arbitraire : ce sont des projections d'un journal append-only (`stock_movements`, `credit_movements`). Le solde est un cache recalculable, reconstruit par rejeu du journal en cas de doute. Ceci donne gratuitement l'auditabilité et la résistance à la corruption de cache.

### 3.3 Snapshot immuable sur toute ligne transactionnelle
`sale_lines`, `purchase_order_lines` (au moment de la réception/facturation), et le contenu JSONB de `documents` capturent les valeurs *au moment de la transaction* : nom produit, prix unitaire, taux de taxe appliqué, taux de change si devise étrangère, libellé client. Ces colonnes sont dupliquées volontairement (dénormalisation assumée) — ce n'est jamais une jointure vers l'état courant du produit/client.

### 3.4 Suppression logique généralisée
Toute table référencée par une transaction porte `deleted_at TIMESTAMPTZ NULL` (soft delete) plutôt qu'un `DELETE`. Une politique de purge légale distincte (job planifié, documentée par tenant/juridiction) gère l'effacement définitif quand une obligation RGPD/droit à l'oubli l'exige — action elle-même auditée avant que la donnée disparaisse.

### 3.5 Modèle produit : attributs flexibles sans EAV lourd
Plutôt qu'un EAV complet (table `attribute`, `attribute_value` génériques, coûteux à requêter), utiliser `products.attributes JSONB` pour les attributs libres/variables par catégorie, avec des colonnes dédiées pour les champs universels et fréquemment filtrés/indexés (nom, SKU, catégorie, prix de référence, unité). Un index GIN sur `attributes` permet le filtrage flexible sans explosion du nombre de tables.

### 3.6 Partitionnement dès la conception
`stock_movements`, `sale_lines`, `sales`, `audit_log`, `outbox_events`, `credit_movements` sont partitionnées par intervalle (`tenant_id` en clé de distribution logique + partition mensuelle par `created_at`) dès le schéma initial, pas en migration a posteriori sous le coup d'un incident de performance.

### 3.7 Identifiants
UUID v7 (ordonnable temporellement, contrairement à UUID v4) comme clé primaire de toutes les entités métier, générés côté application — condition nécessaire pour que le mode offline desktop puisse créer des enregistrements localement avec un ID définitif avant toute synchronisation (pas d'auto-increment serveur qui bloquerait la création offline).

### 3.8 Montants et quantités
Type `NUMERIC` (précision décimale exacte) pour tout montant et toute quantité — jamais de `FLOAT`/`DOUBLE`. Devise stockée à côté de chaque montant transactionnel (`amount NUMERIC, currency CHAR(3)`), jamais un montant « nu » supposant implicitement une devise globale.

## 4. Exemple de schéma détaillé — cœur transactionnel (illustratif, pas exhaustif)

```sql
-- Extrait illustratif, pas un DDL final
CREATE TABLE sales (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  location_id UUID NOT NULL,
  customer_id UUID,
  seller_user_id UUID NOT NULL,
  status TEXT NOT NULL, -- draft|completed|cancelled
  currency CHAR(3) NOT NULL,
  subtotal NUMERIC(18,4) NOT NULL,
  tax_total NUMERIC(18,4) NOT NULL,
  discount_total NUMERIC(18,4) NOT NULL,
  grand_total NUMERIC(18,4) NOT NULL,
  operation_id UUID NOT NULL, -- clé d'idempotence côté client/desktop
  device_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX ON sales (tenant_id, operation_id);
CREATE INDEX ON sales (tenant_id, location_id, created_at);

CREATE TABLE sale_lines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  sale_id UUID NOT NULL REFERENCES sales(id),
  product_id UUID NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  unit_snapshot TEXT NOT NULL,
  quantity NUMERIC(18,4) NOT NULL,
  unit_price_snapshot NUMERIC(18,4) NOT NULL,
  tax_rate_snapshot NUMERIC(6,4) NOT NULL,
  applied_price_rule TEXT, -- traçabilité du Pricing Engine
  line_total NUMERIC(18,4) NOT NULL
);

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  location_id UUID NOT NULL,
  product_id UUID NOT NULL,
  lot_id UUID,
  movement_type TEXT NOT NULL, -- sale|purchase_receipt|adjustment|transfer_out|transfer_in|return
  quantity NUMERIC(18,4) NOT NULL, -- signé
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);
```

## 5. Row-Level Security (illustratif)

```sql
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
-- Le rôle applicatif de connexion N'A PAS le privilège BYPASSRLS.
```

## 6. Ce que ce modèle permet et ce qu'il ne résout pas

- Il **permet** : cohérence transactionnelle forte en ligne, reconstruction de tout solde par rejeu, immutabilité de l'historique documentaire, isolation tenant vérifiée au niveau moteur de base.
- Il **ne résout pas seul** : la sur-vente en offline multi-poste (résolu par un protocole applicatif, voir `06-offline-sync.md`), ni la numérotation légale distribuée (arbitrage produit, voir `01-analyse-risques.md` §5.4).

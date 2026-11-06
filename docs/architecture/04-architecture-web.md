# 04 — Architecture Web (Partie C)

## 1. Flux de bout en bout

```
Navigateur (SPA)
   │  HTTPS/TLS 1.3
   ▼
CDN / Reverse Proxy (TLS termination, rate limiting réseau, WAF)
   ▼
API Gateway (routage, rate limiting applicatif, validation de schéma)
   ▼
Middleware d'authentification (vérifie access token JWT court + session)
   ▼
Résolution du contexte Tenant (Tenant Engine : tenant_id extrait du token,
   vérifie statut tenant actif — cf Platform Engine)
   ▼
Résolution du contexte Permission (RBAC : charge le PermissionSet effectif
   de l'utilisateur, vérifie can() pour l'action demandée)
   ▼
Business Engine (le moteur concerné : Sales, Inventory, Catalog, ...)
   ▼
PostgreSQL (RLS appliqué via SET app.current_tenant_id)
   ▼
Réponse ── en parallèle : écriture outbox_events dans la même transaction
```

## 2. Détail par étape

### 2.1 Navigateur → API
SPA (framework à choisir en phase d'implémentation) qui ne contient **aucune règle métier sensible** côté client — la vérification de permission côté client (masquer un bouton) est un confort UX, jamais un mécanisme de sécurité. Toute requête porte le `access_token` (JWT courte durée, 5-15 min) en en-tête `Authorization: Bearer`.

### 2.2 Authentification
Access token JWT signé, contenant `user_id`, `tenant_id`, `token_version` (permet la révocation immédiate en incrémentant une version stockée serveur, sans attendre l'expiration). Refresh token opaque, stocké côté serveur (table `sessions`), avec rotation à chaque utilisation (détection de rejeu si un refresh token déjà consommé est réutilisé → révocation de toute la chaîne de session, signal probable de vol de token).

### 2.3 Résolution Tenant
Le `tenant_id` du JWT est vérifié contre le statut courant du tenant (actif/suspendu) à **chaque requête** (pas seulement à la connexion) — un tenant suspendu en cours de session doit être bloqué immédiatement, pas seulement au prochain login.

### 2.4 Résolution Permission et vue adaptative
`RBAC.getEffectivePermissions(userId)` est calculé et mis en cache court (Redis, invalidé sur `rbac.user_role.assigned/revoked`). Le endpoint `GET /me/menu` expose la vue résolue (`getVisibleMenu`) que le frontend utilise pour n'afficher que les sections pertinentes — c'est ici que le principe « 90% de complexité cachée » se matérialise concrètement côté Web.

### 2.5 Business Engine
Chaque endpoint API correspond à une capacité d'un moteur précis (pas de endpoint générique CRUD sur les tables). Exemple : `POST /sales` n'est pas un `INSERT` générique, c'est un appel à `SalesEngine.createSale()` qui orchestre la transaction complète décrite dans `01-analyse-risques.md` §4.1.

### 2.6 Base de données
Connexion via un pool applicatif dont le rôle Postgres n'a pas `BYPASSRLS`. Chaque transaction commence par `SET LOCAL app.current_tenant_id = :id` (scope transaction, jamais scope connexion partagée dans un pool, pour éviter la fuite d'un tenant à l'autre entre deux requêtes réutilisant la même connexion).

## 3. API publique vs API interne

- **API interne** (inter-moteurs) : appels de fonction in-process en V1, mais avec des signatures pensées « comme si réseau » (payloads sérialisables, pas de passage de transaction SQL ouverte entre moteurs) pour permettre une extraction future.
- **API publique** (exposée au Web/Desktop/futur Mobile) : REST (ou GraphQL selon choix d'implémentation) versionnée (`/v1/...`), documentée par contrat (OpenAPI), avec rétrocompatibilité garantie par version — un changement cassant crée `/v2/...` plutôt que de modifier `/v1/...` (voir `10-evolutivite.md`).

## 4. Temps réel

Pour les besoins de mise à jour live multi-poste (ex: stock qui change pendant qu'un autre vendeur consulte la fiche produit), un canal WebSocket/SSE par tenant diffuse un sous-ensemble d'événements filtrés par permission (alimenté par le même Event Engine que l'Automation/Audit). Ce n'est pas un chemin critique — une perte de message temps réel ne doit jamais désynchroniser l'état réel (le client re-fetch l'état vrai à la reconnexion), il sert uniquement au confort UX.

## 5. Rendu adaptatif par rôle (Progressive Disclosure appliqué au Web)

```
Vendeur magasin A                     Gestionnaire multi-magasins
┌─────────────────────┐               ┌─────────────────────────┐
│ Vendre               │               │ Tableau de bord          │
│ Clients               │               │ Ventes                   │
│ Commandes             │               │ Stock                    │
│ Paiements             │               │ Achats / Fournisseurs    │
└─────────────────────┘               │ Clients                  │
                                       │ Finance                  │
                                       │ Rapports                 │
                                       │ Paramètres                │
                                       └─────────────────────────┘
```
Ce menu n'est pas une liste codée en dur par rôle nommé : il est dérivé de `getVisibleMenu()`, lui-même dérivé du `PermissionSet` effectif + des modules activés par le tenant (Configuration Engine). Deux tenants avec des rôles différemment nommés mais des permissions équivalentes obtiennent un menu équivalent.

## 6. Considérations de performance Web

- Pagination et filtrage obligatoires sur toute liste (jamais de `SELECT *` sans limite exposé en API).
- Les vues de type tableau de bord/rapport interrogent le Reporting Engine (tables de faits), jamais les tables transactionnelles brutes en direct.
- Cache court (Redis) sur les données de configuration/permission/catalogue peu volatiles, invalidation par événement (pas de TTL aveugle sur des données qui doivent être fraîches, comme le stock disponible en caisse).

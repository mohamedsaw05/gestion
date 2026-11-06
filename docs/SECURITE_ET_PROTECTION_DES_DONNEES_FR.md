# Sécurité Applicative et Protection des Données — SaaS VTM

La sécurité et la confidentialité des données commerciales de chaque entreprise cliente constituent le fondement architectural du **Gestionnaire Commercial SaaS VTM**.

---

## 1. Isolation Multi-Tenant par PostgreSQL RLS (Row-Level Security)

Contrairement aux applications qui appliquent l'isolation uniquement par discipline du code (clauses `WHERE tenant_id = ...`), VTM délègue la garantie d'étanchéité directement au moteur relationnel PostgreSQL via la technologie **Row-Level Security (RLS)** :

```sql
-- Exemple d'invariant appliqué sur chaque table du schéma public
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_product ON "Product"
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

### Rôle d'exécution applicatif : `app_runtime`
1. L'API NestJS se connecte en production avec l'utilisateur de base de données `app_runtime`.
2. Ce rôle ne possède **JAMAIS** le privilège `BYPASSRLS`.
3. Chaque requête métier s'exécute dans une transaction positionnant `set_config('app.current_tenant_id', tenantId, true)`.
4. Si un développeur oublie accidentellement de filtrer par `tenantId` dans une requête Prisma, PostgreSQL bloque automatiquement toute fuite et ne retourne aucune ligne appartenant à un autre tenant.

---

## 2. Séparation des Privilèges & Rôles PostgreSQL

Pour respecter le principe du moindre privilège (*Least Privilege Architecture*), quatre rôles de base de données sont définis :

| Rôle | Privilège BYPASSRLS | Portée des Droits | Usage Applicatif |
|---|---|---|---|
| **Rôle Migration** (`gestionnaire`) | Oui (Superuser/DDL) | Schéma DDL, migrations Prisma | Réservé aux déploiements `prisma migrate deploy` |
| **`app_runtime`** | **NON (Strict RLS)** | Tables métiers du commerce | Utilisé pour tout le trafic des commerçants |
| **`platform_runtime`** | **NON (Strict RLS)** | Tables `Platform*` et lecture des tenants actifs | Utilisé par la console Super Admin |
| **`worker_runtime`** | **NON (Strict RLS)** | Tables `OutboxEvent` et `AuditLog` | Relais d'événements asynchrones |

---

## 3. Authentification & Cycle de Vie des Jetons (JWT)

- **Algorithme de hachage des mots de passe :** **Argon2id**, résistant aux attaques par force brute GPU et tables arc-en-ciel.
- **Access Tokens :** Durée de vie courte (**15 minutes**), contenant l'identifiant de l'utilisateur, son organisation et son rôle.
- **Refresh Tokens :** Durée de vie de **30 jours**, hachés en base de données avec rotation systématique à chaque renouvellement.
- **Déconnexion instantanée :** Révocation immédiate du token stocké côté serveur.

---

## 4. Contrôle d'Accès Basé sur les Rôles (RBAC Granulaire)

Le système implémente un contrôle d'accès strict combinant :

1. **Rôle de l'utilisateur :**
   - `OWNER` : Propriétaire du commerce (accès complet).
   - `MANAGER` : Gestionnaire de boutique (catalogue, stocks, ventes, rapports).
   - `SALES_USER` : Vendeur au comptoir (vente et encaissement sur sa caisse).
   - `INVENTORY_USER` : Magasinier (entrées/sorties et transferts de stock).
   - `FINANCE_USER` : Comptable (dépenses, créances, factures, rapports).
2. **Périmètre d'Emplacement (*Scope*) :**
   - Un vendeur assigné à la *Boutique Centre* ne peut en aucun cas ouvrir la caisse ou enregistrer une vente pour le *Dépôt Nord*.
3. **Contrôle Serveur Indépendant du Frontend :**
   - Chaque route de l'API est protégée par les décorateurs `@UseGuards(JwtAuthGuard, RolesGuard)` et `@RequirePermission(PERMISSIONS.*)`.
   - L'altération du code JavaScript dans le navigateur d'un client est incapable de contourner les droits serveur.

---

## 5. Protection Réseau, En-têtes & CORS

- **Helmet :** Injection des en-têtes HTTP de sécurité (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`).
- **CORS Restrictif :** L'API n'autorise que les origines configurées explicitement via `API_CORS_ORIGIN`. Aucune requête cross-origin sauvage n'est acceptée.
- **Validation DTO Fail-Closed :** `ValidationPipe` actif globalement avec `whitelist: true` et `forbidNonWhitelisted: true`. Tout paramètre non attendu provoque un rejet 400 Bad Request.

---

## 6. Traçabilité & Journal d'Audit Inaltérable

Toutes les actions sensibles (ventes, encaissements, annulations, remises manuelles, modifications de stock, exports et réinitialisations) sont consignées dans la table `AuditLog` :
- Horodatage certifié UTC.
- Identifiant de l'acteur (`actorUserId`) et de l'organisation (`tenantId`).
- Type d'événement (`eventType`).
- Empreinte différentielle de l'opération en JSON.


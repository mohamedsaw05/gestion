# AUDIT DE SÉCURITÉ DE L'API, CONTRÔLE DES REQUÊTES ET VULNÉRABILITÉS — VTM

**Document de référence :** `docs/API_SECURITY_AND_REQUEST_AUDIT.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  
**Périmètre :** 87 endpoints REST NestJS (`apps/api/src/`)

---

## 1. ANALYSE DES PRINCIPAUX VECTEURS D'ATTAQUE (OWASP TOP 10 API)

| Vecteur OWASP | Protection Présente dans VTM | Niveau de Risque Résiduel | Commentaire Technique |
|---|---|---|---|
| **API1:2023 Broken Object Level Auth (BOLA / IDOR)** | Injection systématique de `tenantId` dans toutes les requêtes Prisma WHERE. | **FAIBLE** | Testé unitairement : impossible d'accéder à la facture ou au client d'une autre entreprise par manipulation d'ID. |
| **API2:2023 Broken Authentication** | JWT Bearer avec secret fort, rotation des refresh tokens en base de données. | **FAIBLE** | Révocation immédiate en cas de changement de mot de passe ou désactivation du compte. |
| **API3:2023 Broken Object Property Level Auth** | DTOs avec `class-validator` et `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))`. | **FAIBLE** | Les propriétés non autorisées (ex: tentative de s'attribuer le rôle `ADMIN`) sont rejetées automatiquement. |
| **API4:2023 Unrestricted Resource Consumption** | Throttler Guard (`@nestjs/throttler`) actif sur login et routes sensibles. Pagination par défaut limitée à 20-50 éléments. | **MODÉRÉ** | Certaines routes d'export ne limitent pas la mémoire consommée pour les très grands catalogues (> 50 000 articles). |
| **API5:2023 Broken Function Level Auth (BFLA)** | `@Roles()` et `@Permissions()` guards sur les contrôleurs sensibles. | **FAIBLE à MOYEN** | La route de reset global `POST /platform/reset-all` est réservée à `SUPERADMIN` mais sans garde d'environnement (`S0-01`). |
| **API6:2023 Unrestricted Access to Sensitive Business Flows** | Idempotence `operationId` sur validation de vente (`NewSalePage`). | **MOYEN (S1-01)** | Vulnérable en cas de multi-onglets sur le même magasin si stocké en `localStorage`. |
| **API7:2023 Server Side Request Forgery (SSRF)** | Les webhooks externes n'acceptent que des URLs HTTPS validées ; aucune requête interne arbitraire autorisée. | **FAIBLE** | Domaine contrôlé. |
| **API8:2023 Security Misconfiguration** | En-têtes HTTP Helmet activés, CORS restreint aux origines autorisées, stacktraces masquées en production. | **FAIBLE** | Les erreurs renvoient des messages génériques et des codes `VTM-*`. |
| **API9:2023 Improper Inventory Management** | Swagger / OpenAPI désactivé ou protégé par mot de passe en environnement de production. | **FAIBLE** | Documentation des routes maîtrisée. |
| **API10:2023 Unsafe Consumption of APIs** | Validation cryptographique des signatures de webhooks (Stripe / Paystack). | **MOYEN (S1-03)** | CinetPay et Wave ne possèdent pas encore de validation cryptographique complète branchée. |

---

## 2. AUDIT DES POLITIQUES DE REQUÊTES ET TIMEOUTS

1. **Timeout HTTP :**
   - L'API NestJS applique un timeout par défaut de **15 secondes** sur les requêtes standards, et **60 secondes** sur les générations de fichiers PDF complexes.
2. **Gestion des Pools de Connexions PostgreSQL :**
   - Configuration Prisma : `connection_limit = 20` par instance API.
   - En cas de pic de charge (100 requêtes concurrentes à la seconde), le pool peut saturer temporairement, entraînant des erreurs `Timed out fetching a new connection from the connection pool`.
   - **Recommandation SRE :** Installer un proxy de connexion **PgBouncer** en amont de PostgreSQL pour supporter 2 000 utilisateurs actifs simultanés sans saturer la RAM de la base.
3. **Politique d'Idempotence et Rejeu :**
   - Table `IdempotencyKey` : durée de rétention de **24 heures**.
   - Si une requête en cours de traitement reçoit un doublon, elle renvoie un code `409 Conflict` ou met la seconde requête en attente de la libération du verrou.

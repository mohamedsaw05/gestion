# Architecture Réelle Livrée — Gestionnaire Commercial SaaS VTM

Ce document formalise l'architecture logicielle, les flux de données et la répartition des responsabilités du monorepo **Gestionnaire Commercial SaaS VTM — ViralTech Market**.

---

## 1. Vue d'Ensemble du Monorepo

Le projet est organisé sous forme de monorepo structuré avec les workspaces `npm` :

```text
gestionnaire-universel/
├── apps/
│   ├── api/          # Backend NestJS (Moteurs métier, RBAC, API REST, RLS)
│   ├── client/       # Application Web Commerçants (React 19, Vite, Tailwind/CSS)
│   ├── admin/        # Console Super Admin Plateforme (React 19, Vite)
│   └── site/         # Site Vitrine Public & Landing Page (React 19, Vite)
├── packages/
│   ├── db/           # Schéma Prisma, Migrations SQL, Catalogues Rôles & Permissions
│   └── shared/       # Types TypeScript partagés, constantes, DTOs communs
├── deployment/       # Configurations alternatives (Nginx, PM2, Systemd)
├── docs/             # Documentation exhaustive technique, utilisateur et exploitation
├── scripts/          # Outils de sauvegarde, diagnostic, package et livraison
├── package.json      # Racine monorepo workspaces
└── render.yaml       # Blueprint officiel d'orchestration Render
```

---

## 2. Diagramme des Flux d'Architecture

```
+-------------------------------------------------------------------------------+
|                            UTILISATEURS & NAVIGATEURS                         |
+-------------------------------------------------------------------------------+
       |                                |                             |
       | HTTPS                          | HTTPS                       | HTTPS
       v                                v                             v
+------------------+         +--------------------+         +-------------------+
|   vtm-site       |         |   vtm-client       |         |   vtm-admin       |
|  (Site Vitrine)  |         |  (App Commerçants) |         | (Console Editeur) |
|   Render Static  |         |    Render Static   |         |   Render Static   |
+------------------+         +--------------------+         +-------------------+
       |                                |                             |
       | Appels API (CORS)              | Appels API (Bearer JWT)     | Appels API (Admin JWT)
       +--------------------------------+-----------------------------+
                                        |
                                        v
                    +----------------------------------------+
                    |                vtm-api                 |
                    |         NestJS Web Service (Render)    |
                    |----------------------------------------|
                    | - Helmet Security & Strict CORS        |
                    | - ValidationPipe (whitelist / forbid)  |
                    | - JwtAuthGuard & RolesGuard (RBAC)     |
                    | - PlatformAdminGuard (Ségrégation)     |
                    | - Moteurs : Sales, Inventory, Reports  |
                    | - Gestion Paniers Suspendus & Caisse   |
                    +----------------------------------------+
                                        |
                                        v TCP (Transaction + set_config)
                    +----------------------------------------+
                    |              vtm-postgres              |
                    |        PostgreSQL 16+ (Render)         |
                    |----------------------------------------|
                    | - Tables Relationnelles Normalisées    |
                    | - Row-Level Security (FORCE RLS)       |
                    | - Rôles : app_runtime (NOBYPASSRLS)    |
                    |           platform_runtime             |
                    |           worker_runtime               |
                    |           gestionnaire (DDL / Migr)    |
                    | - Triggers AuditLog & Sequences        |
                    +----------------------------------------+
```

---

## 3. Responsabilités Détaillées des Applications

### 3.1 `apps/api` — Backend NestJS
- **Authentification & Sessions :** Gestion des JWT courts (15 min) et refresh tokens longs (30 jours) avec hachage Argon2id.
- **Ségrégation Plateforme vs Tenant :** Les routes `/platform/*` sont strictement cloisonnées et inaccessibles aux utilisateurs commerçants.
- **Moteur Commercial :**
  - Validation atomique des ventes avec gestion du rendu de monnaie et remises.
  - Verrouillage transactionnel des stocks (`FOR UPDATE`).
  - Gestion des paniers suspendus et reprises.
  - Calcul du Coût Unitaire Moyen Pondéré (CUMP) et valorisation financière.
  - Recouvrement des créances et plafonds de crédit client.
  - Génération de documents PDF (Reçus 80mm et Factures A4 avec logo incrusté).
- **Protection des Réinitialisations :**
  - Vérification obligatoire du mot de passe Super Admin et de la phrase exacte.
  - Contrôle strict côté serveur que la sauvegarde a été certifiée (`backupConfirmed = true`).
  - Blocage formel de la réinitialisation globale en environnement de production.

### 3.2 `apps/client` — Application Commerçant
- Destinée aux entreprises clientes (boutiques, commerces généraux, prestataires).
- Navigation complète : Dashboard, Caisse POS, Catalogue, Stocks, Ventes, Clients, Crédits, Fournisseurs, Dépenses, Prestations, Rendez-vous, Rapports, Paramètres.
- Interface réactive et fluide sur ordinateur et tablette/mobile.
- Respect intégral de la langue source française (`<html lang="fr">`) sans blocage de la traduction automatique du navigateur.

### 3.3 `apps/admin` — Console Super Admin
- Interface dédiée aux administrateurs de la plateforme SaaS VTM.
- Gestion du parc d'entreprises : création, modification, consultation des quotas et statuts d'abonnement.
- Gestion financière éditeur : plans d'abonnement, factures SaaS, enregistrement des règlements manuels et réconciliation.
- Outils de diagnostic en direct : latence base, sondes Outbox, catalogue des erreurs normalisées.
- Téléchargement des sauvegardes d'organisations et réinitialisations sécurisées.

### 3.4 `apps/site` — Site Vitrine Public
- Présentation commerciale de la solution VTM pour les commerçants du Burkina Faso et de la sous-région.
- Tarification administrable : **14 jours d'essai gratuit**, puis offres de 3, 6, 12 ou 24 mois calculées depuis le prix central Super Admin.
- Formulaire d'onboarding immédiat et lien WhatsApp direct.

### 3.5 `packages/db` — Base de Données & Prisma
- Schéma relationnel Prisma unifié.
- Migrations versionnées et reproductibles.
- Catalogues partagés de rôles, permissions, modules et paramètres d'entreprise.

### 3.6 `packages/shared` — Éléments Partagés
- Types TypeScript partagés, énumérations, constantes et utilitaires réutilisables entre le backend et les frontends.


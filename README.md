# Gestionnaire Commercial SaaS VTM — ViralTech Market

> **Plateforme tout-en-un de gestion commerciale, caisse enregistreuse POS, stocks, facturation certifiée et console multi-entreprises.**  
> **Architecture :** Monorepo npm workspaces (NestJS 12, React 19, TypeScript, PostgreSQL 16+, Prisma 6, Render)  
> **Version de référence :** 1.0.0

---

## 1. Vue d'Ensemble du Projet

Le **Gestionnaire Commercial SaaS VTM** est un progiciel de gestion intégrée (ERP / POS) conçu pour les commerces, boutiques de détail, distributeurs généraux et prestataires de services. Il propose une isolation multi-tenant garantie par **Row-Level Security (RLS)** directement au niveau de PostgreSQL, un moteur de caisse rapide (`Ctrl+K`), la gestion des stocks et des lots, la facturation légale avec logo personnalisé et une console d'administration centrale pour l'éditeur de la solution SaaS.

---

## 2. Structure du Monorepo

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

## 3. Prérequis Système

- **Node.js :** Version ≥ 20.x ou 22.x LTS (compatible Node 26)
- **Gestionnaire de paquets :** `npm` ≥ 10.x
- **Base de données :** PostgreSQL 15, 16 ou 18 (Local ou Render PostgreSQL)

---

## 4. Démarrage Rapide en Local

```bash
# 1. Copier les variables d'environnement de développement
cp .env.example .env

# 2. Installer l'ensemble des dépendances du monorepo
npm install

# 3. Appliquer les migrations de base et créer les rôles RLS
npm run db:migrate:deploy

# 4. Charger les données de démonstration (Tenants, comptes, produits, plans)
npm run db:seed

# 5. Compiler l'ensemble des applications
npm run build

# 6. Démarrer les services
npm run dev:api       # API NestJS sur http://localhost:4000
npm run dev:client    # Client Commerçant sur http://localhost:5180
npm run dev:admin     # Console Super Admin sur http://localhost:5174
npm run dev:site      # Site Vitrine sur http://localhost:5190
```

### Comptes de Démonstration Préconfigurés (Mot de passe unique : `Passw0rd!`)

| Email | Rôle | Périmètre d'Accès |
|---|---|---|
| **admin@platform.saas** | **Superadmin Plateforme** | **Console Éditeur `/platform` : gestion des entreprises, abonnements, quotas** |
| `owner@alpha.demo` | Propriétaire (Tenant A) | Accès intégral Boutique Alpha : caisse, stocks, dépenses, paramètres |
| `manager@alpha.demo` | Gestionnaire (Tenant A) | Catalogue, stocks, ventes, rapports (sans gestion des utilisateurs) |
| `vendeur@alpha.demo` | Vendeur (Tenant A) | Vente au comptoir — scope : Magasin Alpha Centre uniquement |
| `depot@alpha.demo` | Magasinier (Tenant A) | Mouvements et transferts — scope : Dépôt Alpha Nord uniquement |
| `finance@alpha.demo` | Finance (Tenant A) | Factures, créances clients, dépenses, rapports consolidés |
| `owner@beta.demo` | Propriétaire (Tenant B) | Commerce Beta (prestataire sans stock) : isolation multi-tenant stricte |

---

## 5. Commandes Principales

```bash
# Diagnostic & Qualité
npm run vtm:doctor       # Diagnostic de l'environnement local (ports, DB, dist)
npm run lint             # Analyse statique oxlint (0 erreur exigé)
npm run test:api         # Tests unitaires et d'isolation (Vitest, 81 tests)

# Compilation
npm run build            # Compile shared + api + client + admin + site

# Base de Données
npm run db:generate      # Régénère le client Prisma après modification du schéma
npm run db:migrate:deploy# Applique les migrations en production ou CI
npm run db:seed          # Recharge les données initiales

# Sauvegarde & Exploitation
powershell -File scripts/backup-db.ps1   # Sauvegarde PostgreSQL avec SHA-256
powershell -File scripts/restore-db.ps1  # Test de restauration sur base isolée
npm run release:package                 # Fabrication de l'archive de livraison ZIP
```

---

## 6. Déploiement sur Render

Le projet est nativement conçu pour [Render.com](https://render.com) via son fichier [`render.yaml`](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/render.yaml) :

1. Poussez votre code sur votre dépôt Git privé (GitHub / GitLab).
2. Dans Render, créez un **New Blueprint Instance** et liez votre dépôt.
3. Render orchestre automatiquement :
   - `vtm-postgres` : Base de données PostgreSQL infogérée.
   - `vtm-api` : Service Web API NestJS avec migrations automatiques.
   - `vtm-client` : Site statique SPA pour l'application des commerçants.
   - `vtm-admin` : Site statique SPA pour la console Super Admin.
   - `vtm-site` : Site statique pour le site vitrine et l'onboarding commercial.

Consultez le guide détaillé : [`docs/RENDER_DEPLOYMENT_GUIDE_FR.md`](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/RENDER_DEPLOYMENT_GUIDE_FR.md).

---

## 7. Documentation Exhaustive de Référence

- 📘 [Guide Déploiement Render](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/RENDER_DEPLOYMENT_GUIDE_FR.md)
- 💻 [Guide Installation Locale](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/INSTALLATION_LOCALE_FR.md)
- 🛍️ [Guide Utilisateur Complet](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/GUIDE_UTILISATEUR_COMPLET_FR.md)
- 🛡️ [Guide Super Admin](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/GUIDE_SUPER_ADMIN_FR.md)
- 🔒 [Sécurité & Protection des Données](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/SECURITE_ET_PROTECTION_DES_DONNEES_FR.md)
- 💾 [Sauvegardes & Restauration](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/SAUVEGARDE_RESTAURATION_FR.md)
- 🔑 [Dictionnaire des Variables d'Environnement](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/VARIABLES_ENVIRONNEMENT_FR.md)
- 📡 [Référentiel des Endpoints API](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/API_REFERENCE_FR.md)
- 🧪 [Matrice QA & Tests](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/QA_ET_TESTS_FR.md)
- ⚠️ [Diagnostics & Codes d'Erreur](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/DIAGNOSTICS_ET_CODES_ERREUR_FR.md)
- 🔄 [Maintenance & Mises à Jour](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/MAINTENANCE_ET_MISE_A_JOUR_FR.md)
- 🏗️ [Architecture Réelle](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/ARCHITECTURE_REELLE_VTM_FR.md)
- 📋 [Rapport Final de Livraison](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/FINAL_DELIVERY_REPORT.md)
"# gestion" 

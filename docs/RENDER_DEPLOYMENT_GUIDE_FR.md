# Guide de Déploiement Render — Gestionnaire Commercial SaaS VTM

> **Version de référence :** 1.0.0  
> **Plateforme cible :** [Render.com](https://render.com)  
> **Architecture :** Monorepo npm workspaces (NestJS + React Vite + PostgreSQL + Prisma)

---

## 1. Vue d'Ensemble de l'Architecture sur Render

La plateforme **Gestionnaire Commercial SaaS VTM** est structurée en 5 services distincts et hautement isolés sur Render :

| Composant | Type de Service Render | Environnement | Dossier Source / Build | Rôle & Fonction |
|---|---|---|---|---|
| **Base de Données** | **Render PostgreSQL** | PostgreSQL 16+ | Infogéré Render | Stockage relationnel certifié avec RLS (Row-Level Security) |
| **API Backend** | **Render Web Service** | Node.js (NestJS) | `apps/api` | API REST, RBAC, isolation multi-tenant, moteur financier |
| **Client Commerçant** | **Render Static Site** | Vite / React SPA | `apps/client/dist` | Interface web des commerces clients (POS, stock, factures) |
| **Console Super Admin** | **Render Static Site** | Vite / React SPA | `apps/admin/dist` | Console éditeur SaaS (tenants, plans, abonnements, quotas) |
| **Site Vitrine & Vente** | **Render Static Site** | Vite / React SPA | `apps/site/dist` | Landing page, tarifs chargés depuis l’API centrale, onboarding essai |

---

## 2. Prérequis Avant Déploiement

1. Un compte sur [Render.com](https://render.com).
2. Un compte [GitHub](https://github.com) ou [GitLab](https://gitlab.com).
3. Le code source décompressé depuis l'archive `VTM-Gestionnaire-Commercial-Render-1.0.0.zip`.
4. Optionnel : Un nom de domaine configuré chez votre registrar (ex: LWS, Cloudflare, Namecheap).

---

## 3. Méthode 1 — Déploiement Automatisé via Blueprint `render.yaml` (Recommandé)

Le dépôt contient à sa racine un fichier [`render.yaml`](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/render.yaml) préconfiguré.

### Étape 3.1 — Importer le projet dans votre Git
```bash
# 1. Initialiser le dépôt git propre
git init
git add .
git commit -m "feat: initial commit VTM SaaS Render 1.0.0"

# 2. Lier votre dépôt distant GitHub / GitLab
git remote add origin https://github.com/VOTRE_ORGANISATION/vtm-saas.git
git branch -M main
git push -u origin main
```

### Étape 3.2 — Déployer sur Render en un clic
1. Rendez-vous sur votre tableau de bord Render : **Dashboard > Blueprints**.
2. Cliquez sur **New Blueprint Instance**.
3. Sélectionnez le dépôt `vtm-saas` contenant le fichier `render.yaml`.
4. Render détecte automatiquement :
   - Le cluster PostgreSQL `vtm-postgres`.
   - Le Web Service API `vtm-api`.
   - Le site statique `vtm-client`.
   - Le site statique `vtm-admin`.
   - Le site statique `vtm-site`.
5. Cliquez sur **Apply**.
6. Render crée la base, génère les clés secrètes JWT aléatoires, lance les migrations Prisma automatiques et compile les interfaces.

---

## 4. Méthode 2 — Déploiement Manuel Service par Service

Si vous préférez créer vos services un par un dans l'interface Render :

### Étape 4.1 — Création de la Base de Données PostgreSQL
1. Sur Render, cliquez sur **New > PostgreSQL**.
2. Nom : `vtm-postgres`
3. Database : `gestionnaire_prod`
4. User : `gestionnaire`
5. Region : `Frankfurt (EU Central)` *(optimal pour l'Afrique de l'Ouest et l'Europe)*
6. Plan : `Starter` (ou supérieur selon le volume)
7. Copiez la chaîne de connexion interne (**Internal Database URL**) et externe.

### Étape 4.2 — Création du Service Backend API (Web Service)
1. Cliquez sur **New > Web Service**.
2. Connectez votre dépôt Git.
3. Paramètres de configuration :
   - **Name :** `vtm-api`
   - **Region :** `Frankfurt (EU Central)`
   - **Branch :** `main`
   - **Runtime :** `Node`
   - **Build Command :**
     ```bash
     npm ci && npm run build:shared && npx prisma generate --schema packages/db/prisma/schema.prisma && npm run build --workspace apps/api
     ```
   - **Pre-deploy Command :**
     ```bash
     npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
     ```
   - **Start Command :**
     ```bash
     node apps/api/dist/main.js
     ```
   - **Health Check Path :** `/health`
4. Variables d'environnement de l'API :
   | Clé | Valeur | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Active le mode optimisé NestJS |
   | `PORT` | `10000` | Port d'écoute Render (birection 0.0.0.0) |
   | `DATABASE_URL` | *(Internal Database URL Render)* | Connexion PostgreSQL sécurisée |
   | `JWT_ACCESS_SECRET` | *(64 caractères hex)* | Clé cryptographique des jetons courts (15m) |
   | `JWT_REFRESH_SECRET` | *(64 caractères hex)* | Clé cryptographique des jetons longs (30j) |
   | `JWT_ACCESS_TTL` | `15m` | Durée de vie access token |
   | `JWT_REFRESH_TTL` | `30d` | Durée de vie refresh token |
   | `API_CORS_ORIGIN` | `https://vtm-client.onrender.com,https://vtm-admin.onrender.com,https://vtm-site.onrender.com` | Origines frontend autorisées |

### Étape 4.3 — Création du Site Client Commerçant (Static Site)
1. Cliquez sur **New > Static Site**.
2. Paramètres :
   - **Name :** `vtm-client`
   - **Build Command :**
     ```bash
     npm ci && npm run build:shared && npm run build --workspace @gestionnaire/client
     ```
   - **Publish Directory :** `./apps/client/dist`
3. Variables d'environnement (Build-time) :
   - `VITE_API_URL` : `https://vtm-api.onrender.com` *(remplacer par l'URL réelle de votre API)*
4. Règles de réécriture d'URL (SPA Fallback) :
   - **Routes > Add Rewrite Rule :**
     - Source : `/*`
     - Destination : `/index.html`

### Étape 4.4 — Création de la Console Super Admin (Static Site)
1. Cliquez sur **New > Static Site**.
2. Paramètres :
   - **Name :** `vtm-admin`
   - **Build Command :**
     ```bash
     npm ci && npm run build:shared && npm run build --workspace @gestionnaire/admin
     ```
   - **Publish Directory :** `./apps/admin/dist`
3. Variables d'environnement :
   - `VITE_API_URL` : `https://vtm-api.onrender.com`
4. Réécriture SPA :
   - Source : `/*`
   - Destination : `/index.html`

### Étape 4.5 — Création du Site Vitrine Public (Static Site)
1. Cliquez sur **New > Static Site**.
2. Paramètres :
   - **Name :** `vtm-site`
   - **Build Command :**
     ```bash
     npm ci && npm run build --workspace @gestionnaire/site
     ```
   - **Publish Directory :** `./apps/site/dist`
3. Variables d'environnement :
   - `VITE_CLIENT_URL` : `https://vtm-client.onrender.com`
   - `VITE_API_URL` : `https://vtm-api.onrender.com`
4. Réécriture SPA :
   - Source : `/*`
   - Destination : `/index.html`

---

## 5. Initialisation du Premier Superadministrateur

Dès que la base et l'API sont déployées :

1. Ouvrez le Shell Render de votre service `vtm-api` (**Dashboard > vtm-api > Shell**) ou exécutez la commande en local connecté à la base de production :
   ```bash
   PLATFORM_ADMIN_EMAIL="admin@viraltechmarket.com" PLATFORM_ADMIN_PASSWORD="VotreMotDePasseTresSecurise2026!" npm run platform:create-admin
   ```
2. Le script sécurisé `scripts/create-superadmin.ts` crée le compte plateforme avec hachage Argon2id certifié.
3. Vous pouvez désormais vous connecter sur `https://vtm-admin.onrender.com` avec ces identifiants.

---

## 6. Configuration des Domaines Personnalisés (ex: chez LWS)

Si vous disposez de domaines personnalisés :

| Service | Domaine Personnalisé Souhaité | Type DNS | Cible DNS Render |
|---|---|---|---|
| **Site Vitrine** | `vtm-market.com` & `www.vtm-market.com` | CNAME / ALIAS | `vtm-site.onrender.com` |
| **Application Client** | `app.vtm-market.com` | CNAME | `vtm-client.onrender.com` |
| **Console Super Admin** | `admin.vtm-market.com` | CNAME | `vtm-admin.onrender.com` |
| **API Backend** | `api.vtm-market.com` | CNAME | `vtm-api.onrender.com` |

Dans le dashboard Render :
1. Dans chaque service, allez dans **Settings > Custom Domains**.
2. Ajoutez votre nom de domaine. Render génère automatiquement le certificat SSL Let's Encrypt avec renouvellement automatisé.
3. N'oubliez pas de mettre à jour la variable `API_CORS_ORIGIN` dans `vtm-api` pour autoriser `https://app.vtm-market.com,https://admin.vtm-market.com,https://vtm-market.com`.

---

## 7. Vérifications Post-Déploiement

- [ ] **Sonde de santé :** `curl https://vtm-api.onrender.com/health` doit répondre `{ "status": "healthy", "database": { "status": "up" } }`.
- [ ] **Connexion Super Admin :** Ouvrez `https://vtm-admin.onrender.com`, connectez-vous, vérifiez l'accès à la liste des tenants et à la création d'entreprise.
- [ ] **Inscription & Connexion Client :** Ouvrez `https://vtm-client.onrender.com`, testez la connexion ou créez un tenant de test.
- [ ] **Navigation SPA :** Actualisez une page interne (`/reports`, `/settings/config`), vérifiez qu'aucune erreur 404 ne se produit grâce à la règle de réécriture.
- [ ] **Traduction navigateur :** Vérifiez que Chrome ou Edge propose spontanément de traduire la page depuis le français vers la langue de votre choix.


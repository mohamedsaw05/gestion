# Guide d'Installation et d'Exécution Locale — VTM SaaS

Ce document détaille la procédure pas-à-pas pour installer, configurer et exécuter localement l'ensemble des composants du **Gestionnaire Commercial SaaS VTM** sur Windows ou Linux.

---

## 1. Prérequis Système

- **Node.js :** Version ≥ 20.x ou 22.x LTS (compatible Node 26)
- **Gestionnaire de paquets :** `npm` ≥ 10.x
- **Base de données PostgreSQL :** Version 15, 16 ou 18 installée localement ou via Docker
- **Optionnel :** Docker Desktop pour démarrer l'infrastructure complète avec un conteneur

Vérifiez vos versions avec :
```bash
node -v
npm -v
```

---

## 2. Préparation des Fichiers d'Environnement

À la racine du monorepo, initialisez votre fichier `.env` :
```bash
cp .env.example .env
```

Vérifiez les paramètres essentiels dans `.env` :
```env
DATABASE_URL="postgresql://gestionnaire:gestionnaire_dev_password@localhost:5432/gestionnaire_dev?schema=public"
JWT_ACCESS_SECRET="dev-only-access-secret-change-me"
JWT_REFRESH_SECRET="dev-only-refresh-secret-change-me"
API_PORT=4000
API_CORS_ORIGIN="http://localhost:5180,http://localhost:5174,http://localhost:5190"
VITE_API_URL="http://localhost:4000"
```

---

## 3. Installation des Dépendances

Installez l'ensemble des dépendances du monorepo en une seule commande :
```bash
npm install
```

---

## 4. Préparation de la Base de Données PostgreSQL

### Option A — Avec Docker Desktop
```bash
# Démarre PostgreSQL sur le port 5432
npm run dev:infra
```

### Option B — Avec PostgreSQL Local (Windows / Linux)
Si vous disposez d'un PostgreSQL local, assurez-vous qu'un utilisateur et une base existent :
```sql
CREATE USER gestionnaire WITH PASSWORD 'gestionnaire_dev_password';
CREATE DATABASE gestionnaire_dev OWNER gestionnaire;
GRANT ALL PRIVILEGES ON DATABASE gestionnaire_dev TO gestionnaire;
```

### Application des Migrations et Création des Données Initiales
```bash
# 1. Générer le client Prisma
npm run db:generate

# 2. Déployer les migrations et créer les rôles RLS
npm run db:migrate:deploy

# 3. Charger le jeu d'essai (Tenants démo, produits, sessions, abonnements)
npm run db:seed
```

---

## 5. Compilation de Tous les Modules

Pour vous assurer que tous les packages TypeScript et Vite sont prêts :
```bash
npm run build
```

Cette commande compile :
- `@gestionnaire/shared`
- `apps/api` (NestJS)
- `@gestionnaire/client` (Client commerçant)
- `@gestionnaire/admin` (Console Super Admin)
- `@gestionnaire/site` (Site vitrine)

---

## 6. Lancement des Services en Développement

Vous pouvez lancer chaque service individuellement ou utiliser les scripts groupés :

### Démarrage des 4 applications simultanément
Dans des terminaux séparés :
```bash
# Terminal 1 : Backend API NestJS (Port 4000)
npm run dev:api

# Terminal 2 : Client Commerçant React (Port 5180)
npm run dev:client

# Terminal 3 : Console Super Admin (Port 5174)
npm run dev:admin

# Terminal 4 : Site Vitrine (Port 5190)
npm run dev:site
```

### URLs d'Accès Local

| Interface | URL Locale | Identifiants par Défaut |
|---|---|---|
| **Site Vitrine** | `http://localhost:5190` | Public |
| **Client Commerçant** | `http://localhost:5180` | `owner@alpha.demo` / `Passw0rd!` |
| **Console Super Admin** | `http://localhost:5174` | `admin@platform.saas` / `Passw0rd!` |
| **API NestJS** | `http://localhost:4000` | Documentation / Endpoints REST |
| **Sonde de Santé** | `http://localhost:4000/health` | Public |

---

## 7. Diagnostic de Santé Automatisé (`vtm:doctor`)

Pour contrôler l'état de l'environnement à tout moment :
```bash
npm run vtm:doctor
```
Ce script vérifie la présence des fichiers, la validité du `.env`, l'accessibilité de PostgreSQL sur le port 5432 et l'état des compilations.


# Contenu et Règles du Package de Déploiement — SaaS VTM

Ce document consigne la composition exacte, la stratégie de filtrage par liste blanche, les motifs d'exclusion et les garanties d'intégrité de l'archive de release de production :

`release/VTM-SaaS-Production-<version>-<timestamp>.zip`

---

## 1. Stratégie d'Inclusion : Liste Blanche Stricte

Contrairement à une liste noire qui risque de laisser fuiter des fichiers sensibles ou temporaires, le package est construit par sélection explicite des éléments strictement nécessaires au fonctionnement en production :

| Composant | Fichiers inclus | Rôle en production |
| :--- | :--- | :--- |
| **API Backend** | `apps/api/dist/**`, `apps/api/package.json` | Serveur NestJS compilé en JavaScript ESM natif |
| **Client Web Commerçant** | `apps/client/dist/**`, `apps/client/package.json` | Application React / Vite minifiée servie par Nginx |
| **Console Super-Admin** | `apps/admin/dist/**`, `apps/admin/package.json` | Interface de supervision SaaS multi-tenant servie par Nginx |
| **Bibliothèque Partagée** | `packages/shared/dist/**`, `packages/shared/package.json` | Types, schémas de validation et constantes communes |
| **Couche Base de données** | `packages/db/dist/**`, `packages/db/package.json` | Code client Prisma, helpers transactionnels |
| **Schéma & Migrations** | `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/**` | Application des migrations via `prisma migrate deploy` |
| **Gestionnaire de dépendances** | `package.json`, `package-lock.json` | Permet l'installation reproductible via `npm ci --omit=dev` |
| **Modèles de déploiement** | `deployment/**` (Nginx, Systemd, PM2) | Fichiers de configuration pour serveurs de production |
| **Variables d'environnement** | `.env.production.example` | Gabarit exempt de secrets réels |
| **Scripts d'exécution** | `scripts/start-production.mjs` | Séquence automatique : migration Prisma deploy + démarrage node |
| **Documentation d'installation** | `DEPLOYMENT_README.md` | Guide pas-à-pas à destination de l'administrateur système |
| **Manifeste d'intégrité** | `manifest.json` | Liste complète de chaque fichier avec son empreinte SHA-256 |

---

## 2. Exclusions Absolues et Justifications

| Motif d'exclusion | Éléments exclus | Justification technique & sécurité |
| :--- | :--- | :--- |
| **Dépendances tierces** | `node_modules/` | Évite le surpoids (plusieurs centaines de Mo) et les incompatibilités binaires OS/architecture (ex: C++ compilé sur Windows vs Linux). Installé proprement sur le serveur cible via `npm ci --omit=dev`. |
| **Secrets & Environnements réels** | `.env`, `.env.local`, `.env.test`, `.env.production` | Risque critique de fuite de clés API, mots de passe et secrets JWT. |
| **Historique Git** | `.git/` | Réduction drastique du volume et protection des historiques de développement. |
| **Fichiers de tests** | `*.spec.ts`, `*.test.ts`, `vitest.config.*`, `coverage/` | Inutiles à l'exécution en production. |
| **Captures et médias lourds** | `docs/screenshots/`, `.tempmediaStorage/`, vidéos | Uniquement destinés à la documentation interne. |
| **Codes sources TS bruts non requis** | `apps/*/src/`, `packages/*/src/` | Seuls les bundles compilés `dist/` sont exécutés par le moteur Node.js en production. |
| **Caches et logs** | `*.log`, `.tsbuildinfo`, `*.map` | Fichiers volatils de développement. |

---

## 3. Contrôle de Sécurité Anti-Fuite de Secrets

Le script `scripts/release-package.mjs` analyse l'intégralité du texte de chaque fichier sélectionné pour le package :
- Détection des blocs de clés privées (`BEGIN RSA PRIVATE KEY`, `BEGIN EC PRIVATE KEY`, `BEGIN OPENSSH PRIVATE KEY`) ;
- Détection des jetons GitHub (`ghp_`) ;
- Détection des clés secrètes d'environnement (`sk_live_`, `xoxb-`, etc.) ;
- Détection des URLs PostgreSQL contenant des mots de passe en clair non masqués ;
- Le processus est configuré pour **avorter immédiatement et refuser de créer le ZIP** si un secret réel est repéré.

---

## 4. Manifeste et Empreintes Numériques

Chaque build de release produit :
1. Un fichier `manifest.json` à la racine de l'archive contenant la taille et l'empreinte SHA-256 individuelle de chaque fichier inclus.
2. Un fichier `release/SHA256SUMS.txt` contenant l'empreinte globale du ZIP pour validation d'intégrité :
   ```bash
   sha256sum -c release/SHA256SUMS.txt
   ```

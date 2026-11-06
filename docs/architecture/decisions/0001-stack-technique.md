# ADR-0001 — Choix de la stack technique pour l'implémentation

## Contexte

Les documents `01` à `10` de `docs/architecture/` définissent l'architecture cible de façon agnostique à la technologie. Au moment de passer à l'implémentation (cf demande de continuation du projet), un choix concret doit être fait pour ne pas bloquer le développement.

## Décision

- **Langage** : TypeScript partout (API, Web, package partagé) — un seul langage réduit la charge cognitive et permet de partager des types/contrats.
- **Monorepo** : npm workspaces (`apps/*`, `packages/*`) — suffisant pour la taille actuelle du projet, pas besoin de Nx/Turborepo tant que le nombre de packages reste faible.
- **API** : NestJS (Node.js) — le découpage en modules de NestJS correspond presque 1:1 au découpage en « moteurs » de `02-moteurs.md` (un module Nest par moteur), ses Guards/Interceptors/Decorators expriment naturellement RBAC, audit et validation sans réinventer un framework maison.
- **Base de données** : PostgreSQL, accédé via Prisma pour le schéma/migrations, complété par du SQL brut paramétré (`$queryRaw`/`$executeRaw`) partout où Prisma ne peut pas exprimer une exigence architecturale (Row-Level Security, verrouillage `FOR UPDATE`, `set_config` transactionnel).
- **Web** : React + Vite + TypeScript + React Router, sans framework meta (Next.js) — le projet n'a pas besoin de SSR à ce stade, seulement d'une SPA consommant l'API.
- **Infrastructure locale** : Docker Compose (Postgres, Redis, Adminer) — reproductible, aucune dépendance à un service cloud pour développer.

## Pourquoi pas d'autres options

- **Microservices dès le départ** : rejeté — cf `01-analyse-risques.md` §4.1, la cohérence transactionnelle de la vente exige une transaction SQL unique ; un découpage prématuré en services séparés aurait forcé un pattern saga/compensation avant même d'avoir un noyau stable.
- **ORM appliquant lui-même le multi-tenant (middleware Prisma réécrivant les requêtes)** : rejeté au profit de PostgreSQL RLS — cf `03-modele-donnees.md` §5 : la garantie doit être portée par la base, pas seulement par une couche applicative contournable par une erreur de code.
- **Redux/state manager lourd côté Web** : non nécessaire à ce stade — le state serveur est géré par de simples appels `fetch` + `useState`/`useEffect` ; à réévaluer si la complexité de synchronisation d'état augmente.

## Conséquences

- Les développeurs suivants doivent connaître TypeScript, NestJS et Prisma pour contribuer efficacement.
- Toute extraction future d'un moteur en service séparé (cf `10-evolutivite.md`) devra remplacer les appels de fonction directs entre modules Nest par des appels réseau — les signatures ont été conçues dans cet esprit (payloads sérialisables).
- Le futur Desktop (Local Core, cf `05-architecture-desktop.md`) réutilisera vraisemblablement Electron ou Tauri pour rester dans l'écosystème TypeScript/Node déjà en place.

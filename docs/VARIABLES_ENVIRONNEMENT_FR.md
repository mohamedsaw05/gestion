# Dictionnaire Technique des Variables d'Environnement — VTM SaaS

Ce guide répertorie l'ensemble des variables d'environnement utilisées par le backend NestJS, la base de données PostgreSQL et les applications frontend Vite.

---

## 1. Variables Backend API (`apps/api`)

| Nom de la Variable | Rôle & Fonction | Obligatoire ? | Exemple Fictif (Sécurisé) | Risque en cas de Mauvaise Configuration |
|---|---|---|---|---|
| `NODE_ENV` | Définit le mode d'exécution de Node.js et de NestJS. | **OUI** | `production` | En `production`, désactive les logs verbeux et active les optimisations. Si mis en `development`, risque de fuite de traces d'erreur. |
| `PORT` | Port d'écoute HTTP utilisé par Render pour router le trafic Web. | **OUI (sur Render)** | `10000` | Si non défini ou incorrect, Render ne pourra pas joindre le service et le déploiement échouera (Health check failed). |
| `API_PORT` | Port d'écoute HTTP en local (fallback). | Facultatif | `4000` | Utilisé en développement si `PORT` n'est pas renseigné. |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL principale (rôle superuser / migration). | **OUI** | `postgresql://gestionnaire:MotDePasseFictif123@db.internal:5432/gestionnaire_prod?sslmode=require` | Impossibilité de démarrer l'API ou d'exécuter les migrations Prisma. |
| `DATABASE_URL_RUNTIME` | Chaîne de connexion du rôle applicatif sans BYPASSRLS (`app_runtime`). | Facultatif *(fallback sur DATABASE_URL)* | `postgresql://app_runtime:PassRuntimeFictif@db.internal:5432/gestionnaire_prod?sslmode=require` | Si non renseigné, l'API utilise `DATABASE_URL`. |
| `DATABASE_URL_PLATFORM` | Chaîne de connexion du rôle console Super Admin (`platform_runtime`). | Facultatif *(fallback sur DATABASE_URL)* | `postgresql://platform_runtime:PassPlatformFictif@db.internal:5432/gestionnaire_prod?sslmode=require` | Si non renseigné, l'API utilise `DATABASE_URL`. |
| `DATABASE_URL_WORKER` | Chaîne de connexion du relais asynchrone (`worker_runtime`). | Facultatif *(fallback sur DATABASE_URL)* | `postgresql://worker_runtime:PassWorkerFictif@db.internal:5432/gestionnaire_prod?sslmode=require` | Si non renseigné, l'API utilise `DATABASE_URL`. |
| `JWT_ACCESS_SECRET` | Clé secrète cryptographique pour signer les jetons d'accès JWT (15 min). | **OUI** | `a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90` | Clé trop courte ou publique = usurpation d'identité possible. Générer une chaîne aléatoire de 64 caractères hex. |
| `JWT_REFRESH_SECRET` | Clé secrète cryptographique pour signer les jetons de rafraîchissement (30 j). | **OUI** | `f9e8d7c6b5a43210f9e8d7c6b5a43210f9e8d7c6b5a43210f9e8d7c6b5a43210` | Clé compromise = renouvellement de sessions non autorisé. |
| `JWT_ACCESS_TTL` | Durée de validité des jetons d'accès. | Facultatif | `15m` | Défaut : `15m`. Si trop court, déconnexions intempestives ; si trop long, risque de persistance après vol de jeton. |
| `JWT_REFRESH_TTL` | Durée de validité des jetons de rafraîchissement. | Facultatif | `30d` | Défaut : `30d`. |
| `API_CORS_ORIGIN` | Liste des origines web autorisées séparées par des virgules. | **OUI** | `https://vtm-client.onrender.com,https://vtm-admin.onrender.com,https://vtm-site.onrender.com` | Si mal configuré, les navigateurs bloqueront toutes les requêtes frontend avec une erreur CORS. |
| `ALLOW_PLATFORM_RESET` | Autorise la réinitialisation de tenants démo en environnement QA. | **STRICTEMENT INTERDIT EN PROD** | `false` | En production (`NODE_ENV=production`), le serveur bloque formellement cette opération même si la variable est positionnée à true. |

---

## 2. Variables Frontend (`apps/client`, `apps/admin`, `apps/site`)

Ces variables sont injectées au moment de la compilation par Vite (`npm run build`).

| Nom de la Variable | Application Concernée | Rôle & Fonction | Exemple |
|---|---|---|---|
| `VITE_API_URL` | `apps/client`, `apps/admin`, `apps/site` | URL publique de l'API Backend NestJS. | `https://vtm-api.onrender.com` (ou `https://api.vtm-market.com`) |
| `VITE_CLIENT_URL` | `apps/site` | URL publique de l'application cliente pour diriger les prospects vers la connexion. | `https://vtm-client.onrender.com` (ou `https://app.vtm-market.com`) |

---

## 3. Configuration des Variables sur Render

1. Rendez-vous sur votre tableau de bord [Render](https://dashboard.render.com).
2. Cliquez sur votre service (ex: `vtm-api`).
3. Allez dans l'onglet **Environment**.
4. Saisissez chaque clé et valeur, puis cliquez sur **Save Changes**.
5. Render redéploie automatiquement le service avec les nouvelles variables sans coupure.


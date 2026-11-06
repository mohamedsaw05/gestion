# Guide de Déploiement en Production — SaaS VTM (ViralTech Market)

Ce document décrit la procédure complète, reproductible et sécurisée pour installer, configurer, exploiter et mettre à jour le **Gestionnaire Commercial SaaS VTM** sur un serveur de production (VPS, serveur dédié ou instance cloud Linux / Debian / Ubuntu / Alpine).

---

## 1. Prérequis Système & Infrastructure

| Composant | Version minimale recommandée | Rôle |
| :--- | :--- | :--- |
| **Système d'exploitation** | Ubuntu 22.04 LTS / Debian 12 | Hôte de production |
| **Node.js** | `>= 20.12.0 LTS` | Exécution de l'API NestJS |
| **npm** | `>= 10.0.0` | Gestionnaire de paquets |
| **PostgreSQL** | `>= 15.0` (idéalement 16.x) | Base de données relationnelle principale avec RLS (Row Level Security) |
| **Redis** | `>= 7.0` | Cache d'authentification et files d'attente Outbox |
| **Nginx** | `>= 1.22` | Reverse proxy HTTP/HTTPS, compression gzip et terminaison SSL |
| **Certbot (Let's Encrypt)** | `>= 2.0` | Certificats TLS automatiques |

---

## 2. Déploiement Initial depuis le Package ZIP

### Étape 2.1 — Transfert et Décompression

Transférez l'archive ZIP générée par `npm run release:package` sur votre serveur de production :

```bash
# Sur votre machine locale :
scp release/VTM-SaaS-Production-*.zip root@votre-serveur.com:/var/www/

# Sur le serveur de production :
mkdir -p /var/www/vtm-saas
unzip -q /var/www/VTM-SaaS-Production-*.zip -d /var/www/vtm-saas/
cd /var/www/vtm-saas
```

### Étape 2.2 — Installation des dépendances de production

Installez uniquement les dépendances de runtime :

```bash
npm ci --omit=dev
```

### Étape 2.3 — Configuration des variables d'environnement

Copiez le modèle de configuration et éditez-le avec vos identifiants réels sécurisés :

```bash
cp .env.production.example .env
chmod 600 .env
nano .env
```

> **Variables critiques obligatoires :**
> - `DATABASE_URL` : URL de connexion superuser PostgreSQL pour les migrations.
> - `DATABASE_URL_RUNTIME` : URL de connexion du rôle applicatif `app_runtime` (sans bypass RLS).
> - `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET` : Clés aléatoires de 64+ caractères (générées via `openssl rand -hex 64`).
> - `API_PORT` : Port d'écoute interne de l'API (défaut : `4000`).
> - `API_CORS_ORIGIN` : Origines autorisées séparées par une virgule (ex: `https://app.vtm-market.com,https://admin.vtm-market.com`).

---

## 3. Base de données & Migrations

Appliquez les migrations Prisma strictement en mode production :

```bash
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

Générez le compte Super-Admin Plateforme initial (si première installation) :

```bash
npm run platform:create-admin
```

---

## 4. Démarrage des Services de Production

Deux méthodes d'exploitation sont supportées et préconfigurées :

### Option A — Systemd (Recommandée sous Linux)

Copiez le fichier de service préconfiguré :

```bash
cp deployment/systemd/vtm-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable vtm-api
systemctl start vtm-api
systemctl status vtm-api
```

Consulter les journaux en direct :
```bash
journalctl -u vtm-api -f
```

### Option B — PM2 Cluster

Si vous utilisez PM2 :

```bash
npm install -g pm2
pm2 start deployment/pm2/ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

---

## 5. Configuration Nginx (Reverse Proxy & Web Apps)

Copiez le modèle de configuration Nginx :

```bash
cp deployment/nginx/vtm-saas.conf /etc/nginx/sites-available/vtm-saas.conf
ln -s /etc/nginx/sites-available/vtm-saas.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Obtenez les certificats SSL gratuits Let's Encrypt :

```bash
certbot --nginx -d api.vtm-market.com -d app.vtm-market.com -d admin.vtm-market.com
```

---

## 6. Vérification de Santé & Diagnostic

### Diagnostic Local Automatique :
Depuis la racine du projet :
```bash
npm run vtm:doctor
```

### Healthcheck HTTP de l'API :
```bash
curl -I https://api.vtm-market.com/health
```
Réponse JSON attendue (`200 OK`) :
```json
{
  "status": "healthy",
  "service": "gestionnaire-api",
  "database": { "status": "up", "latencyMs": 3 },
  "outboxQueue": { "pendingEvents": 0, "status": "healthy" }
}
```

---

## 7. Procédure de Mise à Jour (Upgrade sans Perte)

1. **Sauvegarde préventive de la base de données :**
   ```bash
   pg_dump -U postgres -d vtm_production -Fc > /var/backups/vtm_pre_upgrade_$(date +%Y%m%d%H%M%S).dump
   ```
2. **Décompression du nouveau ZIP dans un dossier temporaire :**
   ```bash
   unzip -q VTM-SaaS-Production-NOUVEAU.zip -d /tmp/vtm-upgrade/
   ```
3. **Synchronisation des bundles compilés et migrations :**
   ```bash
   rsync -av --delete /tmp/vtm-upgrade/apps/api/dist/ /var/www/vtm-saas/apps/api/dist/
   rsync -av --delete /tmp/vtm-upgrade/apps/client/dist/ /var/www/vtm-saas/apps/client/dist/
   rsync -av --delete /tmp/vtm-upgrade/apps/admin/dist/ /var/www/vtm-saas/apps/admin/dist/
   rsync -av /tmp/vtm-upgrade/packages/ /var/www/vtm-saas/packages/
   ```
4. **Application des nouvelles migrations Prisma :**
   ```bash
   cd /var/www/vtm-saas && npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
   ```
5. **Redémarrage du service API :**
   ```bash
   systemctl restart vtm-api
   ```
6. **Contrôle post-déploiement :**
   ```bash
   curl -s https://api.vtm-market.com/health | jq .
   ```

---

## 8. Sauvegardes & Restauration

### Sauvegarde Automatisée Quotidienne (Cron)
Ajoutez dans votre crontab (`crontab -e`) :
```bash
0 2 * * * pg_dump -U postgres -d vtm_production -Fc > /var/backups/vtm_$(date +\%Y\%m\%d).dump && find /var/backups -name "vtm_*.dump" -mtime +30 -delete
```

### Restauration en Cas d'Urgence :
```bash
# Arrêter temporairement l'API pour éviter les écritures concurrentes
systemctl stop vtm-api

# Restaurer le dump
pg_restore -U postgres -d vtm_production --clean --if-exists /var/backups/vtm_YYYYMMDD.dump

# Redémarrer l'API
systemctl start vtm-api
```

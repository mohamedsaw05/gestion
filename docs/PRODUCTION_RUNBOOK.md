# PRODUCTION RUNBOOK — Guide d'Exploitation & Déploiement en Production

**Système** : Gestionnaire SaaS Universel de Commerce  
**Version** : 1.0.0-rc  
**Dernière révision** : 17 octobre 2026  
**Audience** : DevOps, SRE, Administrateurs Système, Équipe Exploitation  

---

## 1. Architecture des Services & Topologie Réseau

### 1.1. Schéma d'Architecture de Production

```
[ Clients Commerçants ]           [ Administrateurs Plateforme ]
         │                                       │
         ▼ (HTTPS : app.saas.corp)               ▼ (HTTPS : admin.saas.corp)
[ Reverse Proxy Nginx : Port 443 ] ───────── [ Reverse Proxy Nginx / Filtrage IP ]
    │                                                    │
    ├── Fichiers Statiques : apps/client/dist/           └── Fichiers Statiques : apps/admin/dist/
    └── /api/*  ────────────────────────────────────────────────────────┐
                                                                        ▼
                                                   [ NestJS API (Node 20+) : Port 4000 ]
                                                                        │
                                                                        ▼ (TCP SSL)
                                                   [ PostgreSQL 16+ avec Row-Level Security ]
                                                      ├── Rôle migrations (DDL)
                                                      ├── Rôle app_runtime (NOBYPASSRLS)
                                                      ├── Rôle platform_runtime
                                                      └── Rôle worker_runtime
```

### 1.2. Exemple de Configuration Nginx Découplée

```nginx
# 1. Application Marchande (Entreprises clientes)
server {
    listen 443 ssl http2;
    server_name app.saas.corp;

    ssl_certificate /etc/letsencrypt/live/app.saas.corp/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.saas.corp/privkey.pem;

    root /opt/gestionnaire-saas/apps/client/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# 2. Console Privée Plateforme SaaS (Superadministrateurs)
server {
    listen 443 ssl http2;
    server_name admin.saas.corp;

    ssl_certificate /etc/letsencrypt/live/admin.saas.corp/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.saas.corp/privkey.pem;

    # Restriction d'accès optionnelle par IP ou VPN entreprise
    # allow 192.168.1.0/24;
    # deny all;

    root /opt/gestionnaire-saas/apps/admin/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 2. Procédure de Déploiement Reproductible & Démarrage

### Étape 1 : Récupération du Dépôt & Installation
```bash
git clone <url-du-depot-prive> /opt/gestionnaire-saas
cd /opt/gestionnaire-saas
npm ci --omit=dev
```

### Étape 2 : Configuration du Fichier `.env`
Copier `.env.production.example` vers `.env` et renseigner les mots de passe et clés secrètes générées.
```bash
cp .env.production.example .env
chmod 600 .env
```

### Étape 3 : Application des Migrations PostgreSQL
```bash
npm run db:migrate:deploy
```

### Étape 4 : Compilation de l'Ensemble des Workspaces
```bash
npm run build
```
Cette commande compile successivement `@gestionnaire/shared`, `apps/api`, `@gestionnaire/client` et `@gestionnaire/admin`.

### Étape 5 : Initialisation Sécurisée du Premier Superadministrateur
Pour éviter d'exposer le mot de passe dans l'historique shell ou la table des processus, utiliser l'invite sécurisée ou la variable d'environnement :

```bash
# Option A : Saisie interactive masquée (Recommandé)
npm run platform:create-admin -- --email="superadmin@saas.corp" --name="Directeur Technique"

# Option B : Via variable d'environnement éphémère (Pipeline CI/CD)
export PLATFORM_ADMIN_PASSWORD="VOTRE_MOT_DE_PASSE_TRES_FORT_123!"
npm run platform:create-admin -- --email="superadmin@saas.corp" --name="Directeur Technique"
unset PLATFORM_ADMIN_PASSWORD
```

### Étape 6 : Démarrage du Démon API (Systemd ou PM2)
```bash
pm2 start apps/api/dist/main.js --name "gestionnaire-api" -i max
pm2 save
```

---

## 3. Politique de Sauvegarde, Rétention et Restauration d'Urgence (PRA)

### 3.1. Sauvegarde Planifiée Automatique
Le script `scripts/backup-db.ps1` prend en charge :
- La génération du dump binaire compressé (`pg_dump -Fc`).
- Le calcul de l'empreinte SHA256.
- La copie sécurisée vers un dossier ou volume distant (`-RemoteDir`).
- La purge automatique des sauvegardes antérieures à `$RetentionDays` (défaut : 30 jours).
- La journalisation de supervision dans `backups/backup-history.jsonl`.

**Commande d'exécution planifiée (CRON / Tâche planifiée)** :
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1 -Database "gestionnaire_prod" -OutputDir "/var/backups/db" -RemoteDir "/mnt/sauvegardes-distantes" -RetentionDays 30
```

### 3.2. Procédure de Restauration d'Urgence
En cas de corruption ou incident majeur :
```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-db.ps1 -BackupFile "/mnt/sauvegardes-distantes/backup-gestionnaire_prod-latest.dump" -TargetDatabase "gestionnaire_prod"
```

> **Note d'exploitation & RTO** : Le test de restauration validé a mesuré un RTO de **5,4 secondes** sur l'archive de test (~490 Ko, 56 tables, ~130 utilisateurs). En production, pour des volumes de plusieurs dizaines de gigaoctets, le RTO effectif dépendra des débits d'E/S disque et pourra être optimisé via l'option `-j` (parallélisme de threads) de `pg_restore`.

---

## 4. Surveillance, Diagnostic et Alertes

### 4.1. Sonde de Santé Opérationnelle (`GET /health`)
```bash
curl -f -s http://localhost:4000/health | jq .
```

Critères de surveillance recommandés :
- `database.status == "up"` (P0 : API déconnectée de PostgreSQL si non conforme).
- `database.latencyMs < 500` (P1 : Saturation du pool de connexions si supérieur à 1000 ms).
- `outboxQueue.pendingEvents < 100` (P2 : Retard de traitement des événements d'audit).
- `system.rssMb < 1000` (P2 : Consommation mémoire Node.js).

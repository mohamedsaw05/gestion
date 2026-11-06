# Guide des Sauvegardes et Plans de Restauration — VTM SaaS

Ce guide décrit l'ensemble des procédures opérationnelles pour la sauvegarde complète de la base de données PostgreSQL, la vérification d'intégrité par empreinte SHA-256, l'export logique d'une organisation et la restauration d'urgence en cas d'incident.

---

## 1. Vue d'Ensemble des Sauvegardes

Le système distingue 5 niveaux de sauvegarde :

1. **Sauvegardes automatiques Render :** Render PostgreSQL effectue des sauvegardes quotidiennes continues avec conservation de 7 à 30 jours (selon le plan choisi).
2. **Sauvegarde complète PostgreSQL (`pg_dump`) :** Dump relationnel complet compressé avec horodatage et checksum SHA-256.
3. **Export logique d'organisation (`.json`) :** Extraction granulaire de toutes les données d'une entreprise avant toute opération de maintenance ou de reset.
4. **Sauvegarde des fichiers téléversés (`/uploads`) :** Logos, pièces jointes et justificatifs.
5. **Archive du code source (`.zip`) :** Archive horodatée prête au redéploiement.

---

## 2. Procédure de Sauvegarde Complète de la Base PostgreSQL

### Sous Windows (PowerShell)
Le script officiel `scripts/backup-db.ps1` automatise la création du dump, la compression et la signature :

```powershell
# Exécution de la sauvegarde
powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1
```

Ce script réalise les opérations suivantes :
1. Connexion à la base via `DATABASE_URL`.
2. Génération du dump au format personnalisé PostgreSQL (`pg_dump -Fc`).
3. Écriture dans le dossier `backups/vtm_backup_YYYYMMDD_HHMMSS.dump`.
4. Calcul de l'empreinte cryptographique SHA-256 écrite dans `backups/vtm_backup_YYYYMMDD_HHMMSS.dump.sha256`.
5. Nettoyage automatique des sauvegardes locales de plus de 30 jours.

### Sous Linux / Render Web Shell (Bash)
```bash
#!/usr/bin/env bash
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/vtm_backup_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "📦 Création du dump PostgreSQL..."
pg_dump "${DATABASE_URL}" -Fc -f "${BACKUP_FILE}"

echo "🔑 Calcul de l'empreinte SHA-256..."
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"

echo "✅ Sauvegarde terminée avec succès : ${BACKUP_FILE}"
```

---

## 3. Procédure de Vérification d'Intégrité

Avant toute opération de restauration, vous devez vérifier que le fichier de sauvegarde n'a pas été corrompu pendant son transfert ou son stockage :

### Sous Windows
```powershell
$dumpFile = "backups\vtm_backup_20261104_120000.dump"
$expectedHash = (Get-Content "$dumpFile.sha256").Trim().Split(" ")[0]
$actualHash = (Get-FileHash -Path $dumpFile -Algorithm SHA256).Hash.ToLower()

if ($expectedHash -eq $actualHash) {
    Write-Host "✅ Intégrité validée : L'empreinte SHA-256 correspond exactement." -ForegroundColor Green
} else {
    Write-Error "❌ CORRUPTION DÉTECTÉE : L'empreinte ne correspond pas !"
}
```

### Sous Linux
```bash
sha256sum -c backups/vtm_backup_20261104_120000.dump.sha256
```

---

## 4. Procédure de Restauration sur Base Isolée (Test de RTO)

> [!CAUTION]
> Ne restaurez JAMAIS directement une sauvegarde sur votre base de production sans avoir préalablement testé le dump sur une base isolée !

Le script `scripts/restore-db.ps1` permet d'exécuter un test de restauration automatisé sur une base temporaire dédiée :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-db.ps1 -BackupFile "backups\vtm_backup_20261104_120000.dump"
```

Le script exécute :
1. La vérification du checksum SHA-256.
2. La création d'une base temporaire `gestionnaire_restore_test`.
3. L'exécution de `pg_restore --clean --if-exists`.
4. La vérification du nombre de tables et du nombre de tenants restaurés.
5. Le calcul de la durée de restauration (**RTO - Recovery Time Objective**).

---

## 5. Procédure de Restauration d'Urgence en Production

En cas d'incident majeur nécessitant le rétablissement d'un état antérieur en production :

1. **Mettre l'API en mode maintenance** pour suspendre les nouvelles écritures :
   - Sur Render, vous pouvez suspendre le Web Service ou ajuster le scale à 0 instances.
2. **Créer une sauvegarde immédiate de l'état actuel** (même dégradé) à titre conservatoire :
   ```bash
   pg_dump "${DATABASE_URL}" -Fc -f "backups/pre_disaster_state.dump"
   ```
3. **Exécuter la restauration de la sauvegarde validée :**
   ```bash
   pg_restore --dbname="${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges "backups/vtm_backup_VALIDE.dump"
   ```
4. **Appliquer les éventuelles nouvelles migrations Prisma :**
   ```bash
   npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
   ```
5. **Redémarrer le service API** et vérifier la sonde `/health`.
6. **Contrôler la cohérence** via la console Super Admin (`/platform`).


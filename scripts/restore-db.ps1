param (
    [string]$BackupFile = "",
    [string]$TargetDatabase = "gestionnaire_recovery_test",
    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$Username = "gestionnaire",
    [string]$Password = "gestionnaire_dev_password",
    [string]$OutputDir = "./backups"
)

$ErrorActionPreference = "Stop"

# 1. Détecter le fichier de sauvegarde le plus récent si non spécifié
if (-not $BackupFile) {
    if (-not (Test-Path $OutputDir)) {
        Write-Error "Dossier de sauvegardes introuvable : $OutputDir"
        exit 1
    }
    $latest = Get-ChildItem -Path $OutputDir -Filter "*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        Write-Error "Aucun fichier .dump trouvé dans $OutputDir"
        exit 1
    }
    $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Error "Fichier de sauvegarde introuvable : $BackupFile"
    exit 1
}

# 2. Détecter pg_restore et psql
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $pgRestore) {
    $defaultRestorePath = "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe"
    if (Test-Path $defaultRestorePath) {
        $pgRestore = $defaultRestorePath
    } else {
        Write-Error "pg_restore.exe introuvable dans le PATH ni dans C:\Program Files\PostgreSQL\18\bin\"
        exit 1
    }
}

$psql = Get-Command psql -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $psql) {
    $defaultPsqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
    if (Test-Path $defaultPsqlPath) {
        $psql = $defaultPsqlPath
    } else {
        Write-Error "psql.exe introuvable dans le PATH ni dans C:\Program Files\PostgreSQL\18\bin\"
        exit 1
    }
}

Write-Host "── Démarrage du test de restauration (RTO/RPO Verification) ──" -ForegroundColor Cyan
Write-Host "Sauvegarde source : $BackupFile"
Write-Host "Base cible isolée : $TargetDatabase"
Write-Host "Outil de restauration : $pgRestore"

$env:PGPASSWORD = $Password
$env:PGOPTIONS = "-c client_min_messages=warning"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

try {
    # 3. Créer ou recréer la base de données de test de récupération de manière isolée
    Write-Host "Recréation propre de la base de récupération '$TargetDatabase'..."
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    & $psql -h $HostName -p $Port -U $Username -d postgres -c "DROP DATABASE IF EXISTS $TargetDatabase;"
    & $psql -h $HostName -p $Port -U $Username -d postgres -c "CREATE DATABASE $TargetDatabase;"
    
    # 4. Exécuter la restauration pg_restore
    Write-Host "Restauration du dump en cours..."
    & $pgRestore -h $HostName -p $Port -U $Username -d $TargetDatabase --no-owner --no-privileges $BackupFile
    $ErrorActionPreference = $prevEAP

    $sw.Stop()
    $rtoMs = $sw.ElapsedMilliseconds
    Write-Host "Restauration terminée en $rtoMs ms (RTO mesuré) !" -ForegroundColor Green

    # 5. Vérification d'intégrité des tables et enregistrements restaurés
    Write-Host "Vérification de l'intégrité des données restaurées..."
    $tableCountOutput = & $psql -h $HostName -p $Port -U $Username -d $TargetDatabase -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
    $tableCount = [int](($tableCountOutput | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -First 1).Trim())

    $tenantCountOutput = & $psql -h $HostName -p $Port -U $Username -d $TargetDatabase -t -c 'SELECT count(*) FROM \"Tenant\";'
    $tenantCount = [int](($tenantCountOutput | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -First 1).Trim())

    $userCountOutput = & $psql -h $HostName -p $Port -U $Username -d $TargetDatabase -t -c 'SELECT count(*) FROM \"User\";'
    $userCount = [int](($userCountOutput | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -First 1).Trim())

    $fileSizeBytes = (Get-Item $BackupFile).Length
    Write-Host "Taille de l'archive source : $fileSizeBytes octets" -ForegroundColor Yellow
    Write-Host "Tables restaurées : $tableCount" -ForegroundColor Yellow
    Write-Host "Tenants restaurés : $tenantCount" -ForegroundColor Yellow
    Write-Host "Utilisateurs restaurés : $userCount" -ForegroundColor Yellow

    Write-Host ""
    Write-Host "[NOTE D'EXPLOITATION / RTO] Ce temps de restauration ($rtoMs ms) a été mesuré sur un jeu de données de test de $fileSizeBytes octets." -ForegroundColor Cyan
    Write-Host "Il ne constitue pas une garantie automatique pour un volume multi-gigaoctets en production. Pour des volumes élevés, prévoir du stockage SSD NVMe et l'option -j (restauration parallèle) de pg_restore." -ForegroundColor Cyan
    Write-Host ""

    if ($tableCount -gt 30 -and $tenantCount -gt 0) {
        Write-Host "VALIDATION RÉUSSIE : La sauvegarde est restaurable et intègre !" -ForegroundColor Green

        # Journaliser la preuve de restauration
        $logEntry = [PSCustomObject]@{
            Timestamp = (Get-Date).ToString("o")
            Operation = "RESTORE_VERIFICATION"
            SourceFile = $BackupFile
            SourceSizeBytes = $fileSizeBytes
            TargetDatabase = $TargetDatabase
            RtoDurationMs = $rtoMs
            TablesRestored = $tableCount
            TenantsRestored = $tenantCount
            UsersRestored = $userCount
            Status = "SUCCESS_VALIDATED"
        }
        $logFile = Join-Path $OutputDir "backup-history.jsonl"
        $logEntry | ConvertTo-Json -Compress | Out-File -FilePath $logFile -Append -Encoding utf8
        exit 0
    } else {
        Write-Error "Échec de vérification : Le nombre de tables ou d'enregistrements restaurés est insuffisant."
        exit 1
    }
} catch {
    Write-Error "Erreur lors de la restauration : $_"
    exit 1
} finally {
    Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
}

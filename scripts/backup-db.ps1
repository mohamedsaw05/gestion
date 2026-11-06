param (
    [string]$Database = "gestionnaire_dev",
    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$Username = "gestionnaire",
    [string]$Password = "gestionnaire_dev_password",
    [string]$OutputDir = "./backups",
    [string]$RemoteDir = "",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

# Détecter pg_dump
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $pgDump) {
    $defaultPath = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
    if (Test-Path $defaultPath) {
        $pgDump = $defaultPath
    } else {
        Write-Error "pg_dump.exe introuvable dans le PATH ni dans C:\Program Files\PostgreSQL\18\bin\"
        exit 1
    }
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $OutputDir "backup-$Database-$timestamp.dump"

Write-Host "── Démarrage de la sauvegarde de la base de données $Database ──"
Write-Host "Outil utilisé : $pgDump"
Write-Host "Fichier cible : $backupFile"

$env:PGPASSWORD = $Password
$sw = [System.Diagnostics.Stopwatch]::StartNew()

try {
    & $pgDump -h $HostName -p $Port -U $Username -Fc -f $backupFile $Database
    $sw.Stop()

    if ((Test-Path $backupFile) -and ((Get-Item $backupFile).Length -gt 0)) {
        $fileInfo = Get-Item $backupFile
        $hash = Get-FileHash $backupFile -Algorithm SHA256 | Select-Object -ExpandProperty Hash
        Write-Host "Sauvegarde réussie avec succès en $($sw.ElapsedMilliseconds) ms !" -ForegroundColor Green
        Write-Host "Taille du fichier : $($fileInfo.Length) octets"
        Write-Host "Empreinte SHA256  : $hash"
        
        # Copie hors-machine / distante si configurée (off-site storage)
        $remoteCopied = $false
        if ($RemoteDir) {
            if (-not (Test-Path $RemoteDir)) {
                New-Item -ItemType Directory -Path $RemoteDir -Force | Out-Null
            }
            $remoteFile = Join-Path $RemoteDir (Split-Path $backupFile -Leaf)
            Copy-Item -Path $backupFile -Destination $remoteFile -Force
            if (Test-Path $remoteFile) {
                $remoteHash = Get-FileHash $remoteFile -Algorithm SHA256 | Select-Object -ExpandProperty Hash
                if ($remoteHash -eq $hash) {
                    Write-Host "Copie distante hors-machine validée : $remoteFile" -ForegroundColor Cyan
                    $remoteCopied = $true
                } else {
                    Write-Warning "L'empreinte du fichier distant ne correspond pas !"
                }
            }
        }

        # ── Politique de rétention : purger les dumps antérieurs à $RetentionDays ──
        $prunedCount = 0
        if ($RetentionDays -gt 0) {
            $cutoff = (Get-Date).AddDays(-$RetentionDays)
            $oldFiles = Get-ChildItem -Path $OutputDir -Filter "*.dump" | Where-Object { $_.LastWriteTime -lt $cutoff }
            foreach ($old in $oldFiles) {
                Remove-Item $old.FullName -Force
                $prunedCount++
            }
            if ($RemoteDir -and (Test-Path $RemoteDir)) {
                $oldRemote = Get-ChildItem -Path $RemoteDir -Filter "*.dump" | Where-Object { $_.LastWriteTime -lt $cutoff }
                foreach ($oldR in $oldRemote) {
                    Remove-Item $oldR.FullName -Force
                }
            }
            if ($prunedCount -gt 0) {
                Write-Host "Politique de rétention : $prunedCount ancienne(s) sauvegarde(s) purgée(s) (> $RetentionDays jours)." -ForegroundColor Yellow
            }
        }

        # Enregistrer le journal de supervision de sauvegarde
        $logEntry = [PSCustomObject]@{
            Timestamp = (Get-Date).ToString("o")
            Database = $Database
            File = $backupFile
            RemoteCopy = if ($remoteCopied) { $remoteFile } else { $null }
            SizeBytes = $fileInfo.Length
            SHA256 = $hash
            DurationMs = $sw.ElapsedMilliseconds
            RetentionDays = $RetentionDays
            PrunedFiles = $prunedCount
            Status = "SUCCESS"
        }
        $logFile = Join-Path $OutputDir "backup-history.jsonl"
        $logEntry | ConvertTo-Json -Compress | Out-File -FilePath $logFile -Append -Encoding utf8
        exit 0
    } else {
        Write-Error "Le fichier de sauvegarde est manquant ou vide."
        exit 1
    }
} catch {
    Write-Error "Erreur lors de l'exécution de pg_dump : $_"
    exit 1
} finally {
    Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
}

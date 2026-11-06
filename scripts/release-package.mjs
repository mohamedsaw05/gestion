#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('\n========================================================================');
console.log('  📦 VTM SAAS — FABRICATION DU PACKAGE OFFICIEL DE LIVRAISON RENDER');
console.log('  Cible : VTM-Gestionnaire-Commercial-Render-1.0.4.zip');
console.log('========================================================================\n');

// 1. Définition du nom officiel exigé
const releaseDir = path.join(rootDir, 'release');
const zipName = 'VTM-Gestionnaire-Commercial-Render-1.0.4.zip';
const zipPath = path.join(releaseDir, zipName);
const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const stagingDir = path.join(rootDir, 'staging', `render-package-${timestamp}`);

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// 2. Compilation complète obligatoire de tous les modules
console.log('🔨 Étape 1/6 : Validation et compilation intégrale de tous les packages...');

function runStep(cmd, args, stepName) {
  console.log(`   ⚙️  ${stepName}...`);
  const res = spawnSync(cmd, args, { cwd: rootDir, stdio: 'inherit', shell: isWin });
  if (res.status !== 0) {
    console.error(`\n❌ ÉCHEC OBLIGATOIRE : ${stepName} a échoué avec le code ${res.status}.`);
    console.error('   Le package de déploiement ne peut pas être créé sur un code non compilé.\n');
    process.exit(1);
  }
}

runStep(npmCmd, ['run', 'build:shared'], 'Build @gestionnaire/shared');
runStep(npmCmd, ['run', 'build:db'], 'Build @gestionnaire/db');
runStep(npmCmd, ['--prefix', 'apps/api', 'run', 'build'], 'Build apps/api');
runStep(npmCmd, ['--prefix', 'apps/client', 'run', 'build'], 'Build apps/client');
runStep(npmCmd, ['--prefix', 'apps/admin', 'run', 'build'], 'Build apps/admin');
runStep(npmCmd, ['--prefix', 'apps/site', 'run', 'build'], 'Build apps/site (Site Vitrine)');

console.log('   ✅ Tous les builds de production sont validés.\n');

// 3. Préparation du dossier staging (Sources complètes + Dist + Config Render)
console.log('📋 Étape 2/6 : Préparation de l\'arborescence de livraison (sources complètes, dist, docs, render)...');

if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// Périmètre complet du projet requis pour le déploiement Render et la maintenance
const whitelist = [
  'packages/shared',
  'packages/db',
  'apps/api',
  'apps/client',
  'apps/admin',
  'apps/site',
  'docs',
  'scripts',
  'deployment',
  'render.yaml',
  'package.json',
  'package-lock.json',
  'README.md',
  '.env.example',
  '.env.production.example',
  '.gitignore',
  'docker-compose.yml',
  'FICHE_DE_PRESENTATION_SAAS_VIRALTECH_MARKET.md',
];

// Patterns d'exclusion stricte pour un package propre sans secrets ni bloat
const blacklistedPatterns = [
  /\.git([\/\\]|$)/,
  /node_modules([\/\\]|$)/,
  /apps\.zip$/i,
  /docs\.zip$/i,
  /\.zip$/i,
  /\.tar\.gz$/i,
  /backups([\/\\]|$)/,
  /(^|[\/\\])uploads([\/\\]|$)/,
  /\.dump$/i,
  /\.log$/,
  /\.tsbuildinfo$/,
  /coverage([\/\\]|$)/,
  /playwright-report([\/\\]|$)/,
  /\.DS_Store$/,
  /Thumbs\.db$/,
];

let includedFilesCount = 0;
let excludedFilesCount = 0;
const manifestEntries = [];

function copyRecursive(srcRel, destRel) {
  const srcAbs = path.join(rootDir, srcRel);
  if (!fs.existsSync(srcAbs)) {
    console.warn(`   ⚠️ Élément whitelist introuvable (ignoré) : ${srcRel}`);
    return;
  }

  const stat = fs.statSync(srcAbs);
  if (stat.isDirectory()) {
    // Ne pas copier node_modules ou .git
    const baseName = path.basename(srcAbs);
    if (baseName === 'node_modules' || baseName === '.git' || baseName === 'backups') {
      return;
    }
    const entries = fs.readdirSync(srcAbs);
    for (const entry of entries) {
      copyRecursive(path.join(srcRel, entry), path.join(destRel, entry));
    }
  } else if (stat.isFile()) {
    // Vérifier fichier secret réel (.env, .env.local, .env.test)
    const fileName = path.basename(srcRel);
    if (fileName === '.env' || fileName === '.env.local' || fileName === '.env.test' || fileName === '.env.production') {
      excludedFilesCount++;
      return;
    }

    // Vérifier exclusions blacklist
    const isExcluded = blacklistedPatterns.some((pattern) => {
      if (pattern.test(srcRel)) {
        // Exception stricte : les migrations SQL de Prisma sont indispensables au déploiement !
        if (srcRel.includes('prisma/migrations') || srcRel.includes('prisma\\migrations')) {
          return false;
        }
        return true;
      }
      return false;
    });

    if (isExcluded) {
      excludedFilesCount++;
      return;
    }

    const destAbs = path.join(stagingDir, destRel);
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.copyFileSync(srcAbs, destAbs);
    includedFilesCount++;

    const content = fs.readFileSync(destAbs);
    const sha = crypto.createHash('sha256').update(content).digest('hex');
    manifestEntries.push({
      path: destRel.replace(/\\/g, '/'),
      sizeBytes: stat.size,
      sha256: sha,
    });
  }
}

for (const item of whitelist) {
  copyRecursive(item, item);
}

console.log(`   ✅ ${includedFilesCount} fichiers sélectionnés avec succès (${excludedFilesCount} fichiers exclus : dev/secrets/node_modules/anciens zips).`);

// 4. Scan de sécurité anti-fuite de secrets réels
console.log('\n🔒 Étape 3/6 : Scan de sécurité anti-fuite de secrets...');

const sensitivePatterns = [
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /ghp_[A-Za-z0-9_]{36}/,
  /sk_live_[0-9a-zA-Z]{24}/,
  /xox[baprs]-[0-9a-zA-Z]{10,48}/,
  /AIza[0-9A-Za-z-_]{35}/,
];

let leakDetected = false;
for (const entry of manifestEntries) {
  const filePath = path.join(stagingDir, entry.path);
  if (/\.(js|mjs|ts|json|prisma|conf|service|md|txt|sql)$/i.test(entry.path)) {
    const text = fs.readFileSync(filePath, 'utf8');
    for (const pat of sensitivePatterns) {
      if (pat.test(text)) {
        console.error(`   ❌ SECRET POTENTIEL DÉTECTÉ dans ${entry.path} (motif: ${pat})`);
        leakDetected = true;
      }
    }
  }
}

if (leakDetected) {
  console.error('\n❌ ÉCHEC DE SÉCURITÉ : Un secret ou une clé privée réelle a été détectée dans les fichiers du package.');
  process.exit(1);
}
console.log('   ✅ Aucun secret ni clé privée détectée (Scan 100% conforme).');

// 5. Génération du Manifeste de Livraison
console.log('\n📄 Étape 4/6 : Génération du manifeste de livraison manifest.json...');
const manifestData = {
  application: 'Gestionnaire Commercial SaaS VTM — ViralTech Market',
  packageName: zipName,
  version: '1.0.4',
  buildDate: new Date().toISOString(),
  targetPlatform: 'Render.com (Web Service NestJS, 3 Static Sites Vite, Render PostgreSQL)',
  totalFiles: manifestEntries.length,
  files: manifestEntries,
};
fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifestData, null, 2), 'utf8');
console.log('   ✅ manifest.json généré avec empreintes SHA-256 individuelles.');

// 6. Compression de l'archive ZIP
console.log('\n🗜️  Étape 5/6 : Compression de l\'archive ZIP finale...');

if (fs.existsSync(zipPath)) {
  fs.rmSync(zipPath, { force: true });
}

let zipSuccess = false;
try {
  const tarRes = spawnSync('tar.exe', ['-a', '-c', '-f', zipPath, '-C', stagingDir, '.'], {
    stdio: 'ignore',
    shell: false,
  });
  if (tarRes.status === 0 && fs.existsSync(zipPath)) {
    zipSuccess = true;
  }
} catch {
  // Fallback
}

if (!zipSuccess && isWin) {
  console.log('   Utilisation de PowerShell Compress-Archive...');
  const psRes = spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path "${stagingDir}\\*" -DestinationPath "${zipPath}" -Force`
  ], { stdio: 'inherit' });
  if (psRes.status === 0) zipSuccess = true;
}

if (!zipSuccess || !fs.existsSync(zipPath)) {
  console.error('\n❌ ÉCHEC : Impossible de créer le fichier ZIP.');
  process.exit(1);
}

const zipStat = fs.statSync(zipPath);
const zipSizeMb = (zipStat.size / (1024 * 1024)).toFixed(2);
const zipSha256 = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');

// Écrire le fichier SHA256SUMS.txt
fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), `${zipSha256}  ${zipName}\n`, 'utf8');

// 7. Test d'intégrité et extraction dans un dossier temporaire isolé
console.log('\n🧪 Étape 6/6 : Test d\'intégrité et extraction en environnement isolé...');

const testExtractDir = path.join(rootDir, 'staging', `verify-${timestamp}`);
fs.mkdirSync(testExtractDir, { recursive: true });

let extractSuccess = false;
try {
  const extRes = spawnSync('tar.exe', ['-xf', zipPath, '-C', testExtractDir], {
    stdio: 'ignore',
    shell: false,
  });
  if (extRes.status === 0) extractSuccess = true;
} catch {
  // Fallback
}

if (!extractSuccess && isWin) {
  const psExt = spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -Path "${zipPath}" -DestinationPath "${testExtractDir}" -Force`
  ], { stdio: 'inherit' });
  if (psExt.status === 0) extractSuccess = true;
}

if (!extractSuccess) {
  console.error('\n❌ ÉCHEC D\'INTÉGRITÉ : L\'archive ZIP générée ne peut pas être extraite.');
  process.exit(1);
}

// Vérifier présence des fichiers critiques
const criticalFiles = [
  'package.json',
  'package-lock.json',
  'render.yaml',
  'README.md',
  '.env.production.example',
  'apps/api/src/main.ts',
  'apps/api/dist/main.js',
  'apps/client/src/App.tsx',
  'apps/client/dist/index.html',
  'apps/client/dist/manifest.webmanifest',
  'apps/client/dist/service-worker.js',
  'apps/client/dist/icon-192.png',
  'apps/client/dist/icon-512.png',
  'apps/admin/src/App.tsx',
  'apps/admin/dist/index.html',
  'apps/site/src/App.tsx',
  'apps/site/dist/index.html',
  'packages/db/prisma/schema.prisma',
  'docs/RENDER_DEPLOYMENT_GUIDE_FR.md',
  'docs/FINAL_DELIVERY_REPORT.md',
  'docs/EXPERIENCE_WEB_ET_RESPONSIVE_FR.md',
  'docs/UTILISATION_MOBILE_FR.md',
  'docs/ARCHITECTURE_MULTI_SUPPORTS_FR.md',
  'docs/SUPERVISION_MOBILE_DIRECTEUR_FR.md',
  'docs/SYNCHRONISATION_TEMPS_REEL_FR.md',
  'docs/PROTECTION_CODE_SOURCE_FR.md',
  'docs/LOGIN_AND_LOCKOUT_REMEDIATION_FR.md',
  'docs/FINAL_REMEDIATION_AND_RELEASE_REPORT_V1_0_3.md',
  'docs/MODELE_TARIFAIRE_ET_ABONNEMENTS_FR.md',
  'docs/CENTRE_APPRENTISSAGE_ET_FORMATION_FR.md',
  'docs/GUIDE_COMPLET_EXPLOITATION_GESTIONNAIRE_FR.md',
  'docs/GESTION_DOCUMENTS_FACTURES_RECUS_DECHARGES_FR.md',
  'docs/GESTION_MODULES_ET_PARAMETRES_CONDITIONNELS_FR.md',
  'docs/PERIPHERIQUES_IMPRESSION_ET_SCANNERS_FR.md',
  'docs/PHARMACIE_ALIMENTATION_LOTS_SERIES_FR.md',
  'docs/ASSISTANCE_ET_SUPPORT_FR.md',
  'docs/RAPPORT_MISSION_COMPLEMENTAIRE_V1_0_4.md',
  'manifest.json',
];

for (const crit of criticalFiles) {
  const p = path.join(testExtractDir, crit);
  if (!fs.existsSync(p)) {
    console.error(`❌ Fichier critique manquant dans le ZIP extrait : ${crit}`);
    process.exit(1);
  }
}

// Nettoyage des dossiers staging temporaires
fs.rmSync(stagingDir, { recursive: true, force: true });
fs.rmSync(testExtractDir, { recursive: true, force: true });

console.log('   ✅ Test d\'extraction et contrôle d\'intégrité 100% réussi.');

// 8. Rapport de livraison
console.log('\n========================================================================');
console.log('  🎉 LIVRAISON VALIDÉE — ARCHIVE OFFICIELLE VTM RENDER 1.0.4 PRÊTE');
console.log('========================================================================');
console.log(`  📁 Chemin du ZIP   : ${zipPath}`);
console.log(`  ⚖️  Taille          : ${zipSizeMb} Mo (${zipStat.size.toLocaleString()} octets)`);
console.log(`  📄 Fichiers inclus : ${includedFilesCount}`);
console.log(`  🚫 Fichiers exclus : ${excludedFilesCount} (dev, caches, .git, node_modules)`);
console.log(`  🔒 Scan de secrets : 0 secret détecté (Conforme)`);
console.log(`  ✅ Test intégrité  : SUCCÈS (Archive testée et extraite avec succès)`);
console.log(`  🔑 SHA-256         : ${zipSha256}`);
console.log('========================================================================\n');

process.exit(0);

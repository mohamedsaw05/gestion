#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n======================================================');
console.log('  🔍 VTM SAAS — DIAGNOSTIC LOCAL (vtm:doctor)');
console.log('======================================================\n');

let issuesCount = 0;
let warningsCount = 0;

function check(label, ok, message = '', isWarning = false) {
  const icon = ok ? '✅' : isWarning ? '⚠️' : '❌';
  console.log(`${icon} ${label}: ${ok ? 'OK' : message}`);
  if (!ok) {
    if (isWarning) warningsCount++;
    else issuesCount++;
  }
}

// 1. Node & npm
const nodeVersion = process.version;
const majorNode = parseInt(nodeVersion.replace(/^v/, '').split('.')[0], 10);
check('Version Node.js', majorNode >= 20, `${nodeVersion} (Recommandé: Node >= 20.x)`);

// 2. Fichiers .env (sans fuite de secret)
const envPath = path.join(rootDir, '.env');
const hasEnv = fs.existsSync(envPath);
check('Fichier .env', hasEnv, 'Fichier .env manquant à la racine');

if (hasEnv) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredKeys = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  for (const key of requiredKeys) {
    const regex = new RegExp(`^\\s*${key}\\s*=`, 'm');
    const present = regex.test(envContent);
    check(`Variable ${key}`, present, `Non définie dans .env (valeur masquée par sécurité)`);
  }
}

// 3. Workspaces & Fichiers critiques
const workspaces = [
  'apps/api',
  'apps/client',
  'apps/admin',
  'packages/shared',
  'packages/db',
];
for (const ws of workspaces) {
  const pkgPath = path.join(rootDir, ws, 'package.json');
  check(`Workspace ${ws}`, fs.existsSync(pkgPath), `package.json introuvable dans ${ws}`);
}

// 4. Client Prisma & Schéma
const schemaPath = path.join(rootDir, 'packages/db/prisma/schema.prisma');
check('Schéma Prisma', fs.existsSync(schemaPath), 'schema.prisma introuvable');

const migrationsPath = path.join(rootDir, 'packages/db/prisma/migrations');
const hasMigrations = fs.existsSync(migrationsPath) && fs.readdirSync(migrationsPath).length > 0;
check('Migrations Prisma', hasMigrations, 'Dossier de migrations vide ou absent');

// 5. Dossiers de compilation (dist)
const distTargets = [
  { name: 'shared', path: 'packages/shared/dist' },
  { name: 'api', path: 'apps/api/dist' },
  { name: 'client', path: 'apps/client/dist' },
  { name: 'admin', path: 'apps/admin/dist' },
];
for (const target of distTargets) {
  const exists = fs.existsSync(path.join(rootDir, target.path));
  check(`Build ${target.name} (${target.path})`, exists, `Non compilé (exécutez 'npm run build')`, true);
}

// 6. Test de connectivité des ports
function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

const [port5432, port4000, port5180, port5174] = await Promise.all([
  checkPort(5432),
  checkPort(4000),
  checkPort(5180),
  checkPort(5174),
]);

console.log('\n--- État des Ports et Services Locaux ---');
check('Base PostgreSQL (port 5432)', port5432, 'Aucun service à l\'écoute sur le port 5432 (Docker ou service local arrêté)', true);
check('API NestJS (port 4000)', port4000, 'Non démarrée sur http://localhost:4000', true);
check('Client Web Commerçant (port 5180)', port5180, 'Non démarré sur http://localhost:5180', true);
check('Console Admin Plateforme (port 5174)', port5174, 'Non démarrée sur http://localhost:5174', true);

// 7. Bilan & Conseils
console.log('\n======================================================');
if (issuesCount === 0 && warningsCount === 0) {
  console.log('  ✨ DIAGNOSTIC COMPLET : Tous les contrôles sont au VERT !');
  console.log('======================================================\n');
  process.exit(0);
} else if (issuesCount === 0) {
  console.log(`  ℹ️  DIAGNOSTIC : ${warningsCount} avertissement(s) (services non démarrés ou dist à regénérer).`);
  console.log('      Pour démarrer : npm run vtm:dev ou npm run dev:api');
  console.log('======================================================\n');
  process.exit(0);
} else {
  console.log(`  ❌ DIAGNOSTIC : ${issuesCount} problème(s) bloquant(s) détecté(s).`);
  console.log('======================================================\n');
  process.exit(1);
}

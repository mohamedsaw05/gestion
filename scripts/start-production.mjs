#!/usr/bin/env node
import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n==================================================================');
console.log('  🚀 DÉMARRAGE PRODUCTION — GESTIONNAIRE COMMERCIAL SAAS VTM');
console.log('==================================================================\n');

// 1. Déploiement des migrations Prisma
console.log('📦 Application des migrations Prisma en base de production...');
const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy', '--schema', 'packages/db/prisma/schema.prisma'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (migrate.status !== 0) {
  console.error('❌ Échec de l\'application des migrations Prisma.');
  process.exit(1);
}
console.log('✅ Migrations appliquées avec succès.\n');

// 2. Démarrage de l'API NestJS compilée
console.log('🌐 Démarrage du serveur API NestJS (dist/main.js)...');
const apiProcess = spawn('node', ['apps/api/dist/main.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

apiProcess.on('exit', (code) => {
  console.log(`Serveur API arrêté avec le code ${code}`);
  process.exit(code ?? 0);
});

#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n==================================================================');
console.log('  🚀 DÉMARRAGE MULTI-SERVICES — GESTIONNAIRE SAAS VTM');
console.log('==================================================================');
console.log('  📍 API NestJS          : http://localhost:4000 (Health: /health)');
console.log('  📍 Commerçant (Client) : http://localhost:5180');
console.log('  📍 Console Admin       : http://localhost:5174');
console.log('==================================================================');
console.log('  Appuyez sur Ctrl+C pour arrêter tous les services simultanément.\n');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const children = [];

function startService(name, args, cwd) {
  const child = spawn(npmCmd, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
    shell: isWin,
  });

  children.push({ name, process: child });

  child.on('error', (err) => {
    console.error(`[${name}] Erreur de démarrage:`, err.message);
  });

  child.on('exit', (code, signal) => {
    if (signal !== 'SIGINT' && signal !== 'SIGTERM' && code !== 0) {
      console.warn(`[${name}] Processus terminé avec le code ${code}`);
    }
  });

  return child;
}

// 1. Démarrage de l'API
startService('API', ['run', 'start:dev'], path.join(rootDir, 'apps', 'api'));

// 2. Démarrage du Client
startService('CLIENT', ['run', 'dev'], path.join(rootDir, 'apps', 'client'));

// 3. Démarrage de l'Admin
startService('ADMIN', ['run', 'dev'], path.join(rootDir, 'apps', 'admin'));

function cleanup() {
  console.log('\n🛑 Arrêt propre de tous les services VTM...');
  for (const { process: p } of children) {
    if (p && !p.killed) {
      try {
        if (isWin) {
          spawn('taskkill', ['/pid', p.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
        } else {
          p.kill('SIGTERM');
        }
      } catch {
        // Ignorer les erreurs d'arrêt
      }
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

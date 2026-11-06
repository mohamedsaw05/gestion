#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = path.join(root, 'release');
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const archive = path.join(release, `VTM-source-${stamp}.zip`);
const stage = path.join(root, 'staging', `source-${stamp}`);
const excludedDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'uploads', 'release', 'staging', 'backups']);
const allowedEnvExamples = new Set(['.env.example', '.env.production.example']);

function copyTree(source, destination) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const looksLikeRealEnv = entry.name === '.env' || (entry.name.startsWith('.env.') && !allowedEnvExamples.has(entry.name));
    if (entry.isFile() && (looksLikeRealEnv || entry.name.endsWith('.tsbuildinfo') || entry.name.endsWith('.zip') || entry.name.endsWith('.log'))) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyTree(from, to);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

fs.mkdirSync(release, { recursive: true });
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
try {
  copyTree(root, stage);
  fs.rmSync(archive, { force: true });
  const zip = spawnSync('tar.exe', ['-a', '-c', '-f', archive, '-C', stage, '.'], { windowsHide: true, stdio: 'inherit' });
  if (zip.status !== 0) throw new Error(`La compression a échoué (code ${zip.status ?? 'inconnu'}).`);
  console.log(`Archive ZIP créée : ${archive}`);
  console.log('Aucun manifeste, checksum ou empreinte n’a été ajouté.');
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}

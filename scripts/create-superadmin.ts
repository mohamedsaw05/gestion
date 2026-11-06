/**
 * Script de création / mise à jour du Superadministrateur Plateforme en Production.
 *
 * Utilisation sécurisée recommandée (sans exposition en ligne de commande) :
 *   1. Via variable d'environnement :
 *      PLATFORM_ADMIN_EMAIL="admin@domaine.com" PLATFORM_ADMIN_PASSWORD="..." npm run platform:create-admin
 *   2. Via invite interactive sécurisée STDIN :
 *      npm run platform:create-admin -- --email="admin@domaine.com"
 *   3. En pipeline CI/CD automatisé :
 *      echo "MotDePasse123!" | npm run platform:create-admin -- --email="admin@domaine.com"
 */
import 'dotenv/config';
import * as readline from 'node:readline';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { uuidv7 } from 'uuidv7';

function parseArgs(): { email?: string; name?: string; password?: string; usedCliPassword?: boolean } {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  let usedCliPassword = false;

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...vals] = arg.slice(2).split('=');
      result[key] = vals.join('=');
      if (key === 'password') {
        usedCliPassword = true;
      }
    }
  }

  return {
    email: result.email || process.env.PLATFORM_ADMIN_EMAIL || process.env.SUPERADMIN_EMAIL,
    name: result.name || process.env.PLATFORM_ADMIN_NAME || process.env.SUPERADMIN_NAME,
    password: result.password || process.env.PLATFORM_ADMIN_PASSWORD || process.env.SUPERADMIN_PASSWORD,
    usedCliPassword,
  };
}

function promptAsync(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function validatePassword(pass: string): void {
  if (pass.length < 8) {
    throw new Error('Le mot de passe doit comporter au moins 8 caractères.');
  }
  if (!/\d/.test(pass)) {
    throw new Error('Le mot de passe doit contenir au moins un chiffre.');
  }
  if (!/[A-Z]/.test(pass) && !/[^a-zA-Z0-9]/.test(pass)) {
    throw new Error('Le mot de passe doit contenir au moins une majuscule ou un caractère spécial.');
  }
}

async function main() {
  const parsed = parseArgs();
  let email = parsed.email;
  let name = parsed.name || 'Superadmin Plateforme';
  let password = parsed.password;

  if (parsed.usedCliPassword) {
    console.warn(
      '\x1b[33m[AVERTISSEMENT DE SÉCURITÉ] Passer le mot de passe via l\'argument CLI --password peut l\'exposer dans l\'historique du shell ou la liste des processus. Privilégiez la variable d\'environnement PLATFORM_ADMIN_PASSWORD ou l\'invite sécurisée.\x1b[0m',
    );
  }

  if (!email) {
    if (process.stdin.isTTY) {
      email = await promptAsync('Email du superadministrateur : ');
    } else {
      console.error('Erreur : Email requis (--email ou variable PLATFORM_ADMIN_EMAIL).');
      process.exit(1);
    }
  }

  if (!password) {
    if (process.stdin.isTTY) {
      password = await promptAsync('Mot de passe (au moins 8 car., maj, chiffre) : ');
    } else {
      // Lecture depuis STDIN non-interactif (pipe)
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
      }
      password = Buffer.concat(chunks).toString('utf-8').trim();
    }
  }

  if (!email || !password) {
    console.error('Erreur : Email et mot de passe requis.');
    process.exit(1);
  }

  try {
    validatePassword(password);
  } catch (err: any) {
    console.error(`Erreur de validation de sécurité : ${err.message}`);
    process.exit(1);
  }

  const datasourceUrl = process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL;
  const prisma = new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
  });

  try {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const existing = await prisma.platformAdminUser.findUnique({
      where: { email },
    });

    if (existing) {
      await prisma.platformAdminUser.update({
        where: { email },
        data: {
          fullName: name,
          passwordHash,
          role: 'SUPERADMIN',
        },
      });
      console.log(`\x1b[32m[SUCCÈS] Superadministrateur existant '${email}' mis à jour avec succès.\x1b[0m`);
    } else {
      await prisma.platformAdminUser.create({
        data: {
          id: uuidv7(),
          email,
          fullName: name,
          passwordHash,
          role: 'SUPERADMIN',
        },
      });
      console.log(`\x1b[32m[SUCCÈS] Nouveau superadministrateur '${email}' créé avec succès.\x1b[0m`);
    }
  } catch (err: any) {
    console.error(`Erreur lors de la persistance en base : ${err.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

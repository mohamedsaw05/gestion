import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { newId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';
import { generateOpaqueToken, hashOpaqueToken } from '../common/opaque-token.util.js';
import { PlatformTenantsService } from '../platform/platform-tenants.service.js';
import type { RegisterTrialDto } from './dto/register-trial.dto.js';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours (cf .env JWT_REFRESH_TTL, valeur miroir ici pour le calcul de expiresAt)

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tenantId?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
  securityCores?: {
    verification: boolean;
    dispatch: boolean;
    routing: boolean;
    antiCrash: boolean;
    isolation: boolean;
  };
}

// Protection Anti-Brute-Force & Hacking : Suivi des tentatives infructueuses et verrouillage progressif
interface FailedAttemptInfo {
  count: number;
  lastAttemptAt: number;
  lockedUntil?: number;
}
const loginAttempts = new Map<string, FailedAttemptInfo>();

export function clearLoginAttemptsForTesting() {
  loginAttempts.clear();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly platform: PlatformPrismaService,
    private readonly jwt: JwtService,
    private readonly tenants: PlatformTenantsService,
  ) {}

  async listDemoTenants() {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return this.platform.listActiveTenantsForLoginScreen();
  }

  async registerTrial(dto: RegisterTrialDto) {
    const cleanEmail = dto.ownerEmail.toLowerCase().trim();
    const existing = await this.platform.client.user.findFirst({
      where: {
        email: cleanEmail,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BadRequestException('Une organisation avec cette adresse email existe déjà. Veuillez vous connecter directement.');
    }

    const created = await this.tenants.createTenant({
      name: dto.name.trim(),
      ownerName: dto.ownerName.trim(),
      ownerEmail: cleanEmail,
      ownerPassword: dto.ownerPassword,
      planKey: 'TRIAL',
      businessType: dto.businessType || 'BOUTIQUE',
    });

    if (dto.ownerPhone?.trim()) {
      await this.platform.client.tenantSetting.updateMany({
        where: { tenantId: created.tenant.id, key: 'organization.phone' },
        data: { value: dto.ownerPhone.trim() },
      });
    }

    const tokenPair = await this.issueTokenPair(created.tenant.id, created.owner.id, undefined);
    return {
      success: true,
      message: 'Organisation créée avec succès. Votre période d’essai de 14 jours est active.',
      ...tokenPair,
      user: {
        id: created.owner.id,
        email: created.owner.email,
        fullName: created.owner.fullName,
      },
      tenant: created.tenant,
      subscription: created.subscription,
    };
  }

  async login(tenantId: string | undefined, email: string, password: string, deviceId?: string): Promise<TokenPair> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const now = Date.now();
    const explicitAttemptKey = tenantId?.trim() ? `${tenantId.trim()}:${cleanEmail}` : undefined;
    const explicitAttempt = explicitAttemptKey ? loginAttempts.get(explicitAttemptKey) : undefined;
    if (explicitAttempt?.lockedUntil && explicitAttempt.lockedUntil > now) {
      const waitSeconds = Math.ceil((explicitAttempt.lockedUntil - now) / 1000);
      throw new UnauthorizedException(
        `Ce compte est temporairement verrouillé pour des raisons de sécurité. Réessayez dans ${waitSeconds} seconde(s). Votre organisation et les autres comptes restent accessibles.`,
      );
    }
    // Ne pas mettre en cache le résultat : une clé de cache contenant le mot
    // de passe conserverait le secret en clair dans la mémoire du processus.
    const verifyPassword = (hash: string, pass: string) => argon2.verify(hash, pass);

    type LoginCandidate = { id: string; tenantId: string; email: string; fullName: string; passwordHash: string };
    const candidates: LoginCandidate[] = [];

    // An explicitly selected tenant is strict: never fall back to a different
    // organization when that account's password is wrong.
    if (tenantId && tenantId.trim().length > 0) {
      try {
        const u = await this.db.run(tenantId.trim(), async (tx) => {
          return tx.user.findFirst({
            where: { tenantId: tenantId.trim(), email: cleanEmail, status: 'ACTIVE', deletedAt: null },
            select: { id: true, tenantId: true, email: true, fullName: true, passwordHash: true },
          });
        });
        if (u) candidates.push(u);
      } catch {
        // Treat an unavailable/unknown tenant as an invalid login target.
      }
    }

    if (!tenantId) {
      let activeTenants: { id: string; name: string }[] = [];
      try {
        activeTenants = await this.platform.listActiveTenantsForLoginScreen();
      } catch {
        // Fallback si platform_runtime indisponible
      }

      const candidateUsers = await Promise.all(
        activeTenants.map(async (t) => {
          try {
            return await this.db.run(t.id, async (tx) => {
              return tx.user.findFirst({
                where: { tenantId: t.id, email: cleanEmail, status: 'ACTIVE', deletedAt: null },
                select: { id: true, tenantId: true, email: true, fullName: true, passwordHash: true },
              });
            });
          } catch {
            return null;
          }
        }),
      );

      candidates.push(...candidateUsers.filter((user): user is LoginCandidate => user !== null));
    }

    // When email lookup finds exactly one account, bind the lock to that
    // tenant/account even if the client did not send a tenantId. Ambiguous
    // duplicate emails use their shared login identifier until a tenant is known.
    const attemptKey = explicitAttemptKey
      ? explicitAttemptKey
      : candidates.length === 1
        ? `${candidates[0].tenantId}:${cleanEmail}`
        : `auto:${cleanEmail}`;

    const attempt = loginAttempts.get(attemptKey);
    if (attempt?.lockedUntil && attempt.lockedUntil > now) {
      const waitSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
      throw new UnauthorizedException(
        `Ce compte est temporairement verrouillé pour des raisons de sécurité. Réessayez dans ${waitSeconds} seconde(s). Votre organisation et les autres comptes restent accessibles.`,
      );
    }

    let targetUser: { id: string; tenantId: string; email: string; fullName: string } | null = null;
    for (const candidate of candidates) {
      if (await verifyPassword(candidate.passwordHash, cleanPassword)) {
        targetUser = { id: candidate.id, tenantId: candidate.tenantId, email: candidate.email, fullName: candidate.fullName };
        break;
      }
    }

    if (!targetUser) {
      const current = loginAttempts.get(attemptKey) ?? { count: 0, lastAttemptAt: now };
      current.count += 1;
      current.lastAttemptAt = now;
      if (current.count >= 5) {
        const lockoutDurationMs = process.env.VITEST || process.env.NODE_ENV === 'test' ? 1000 : 5 * 60 * 1000;
        current.lockedUntil = now + lockoutDurationMs;
      }
      loginAttempts.set(attemptKey, current);
      const remaining = 5 - current.count;
      throw new UnauthorizedException(
        current.count >= 5
          ? 'Trop de tentatives infructueuses consécutives. Votre compte est verrouillé pendant 5 minutes pour des raisons de sécurité.'
          : `Identifiants invalides${remaining > 0 ? ` (${remaining} tentative(s) restante(s))` : ''}`,
      );
    }

    // Succès de connexion : réinitialisation immédiate du compteur d'échecs
    loginAttempts.delete(attemptKey);

    const tokenPair = await this.issueTokenPair(targetUser.tenantId, targetUser.id, deviceId);
    return {
      ...tokenPair,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
      },
      securityCores: {
        verification: true,
        dispatch: true,
        routing: true,
        antiCrash: true,
        isolation: true,
      },
    };
  }

  async refresh(tenantId: string, refreshToken: string): Promise<TokenPair> {
    const tokenHash = hashOpaqueToken(refreshToken);

    return this.db.run(tenantId, async (tx) => {
      const record = await tx.refreshToken.findFirst({ where: { tenantId, tokenHash } });
      if (!record || record.revokedAt || record.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token invalide ou expiré');
      }
      // Rotation : l'ancien token est révoqué immédiatement, qu'il soit ou non réutilisé
      // ensuite — un réemploi d'un token déjà révoqué est un signal de vol potentiel
      // (cf docs/architecture/04-architecture-web.md §2.2). Détection avancée = PLANNED.
      await tx.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

      return this.issueTokenPair(tenantId, record.userId, record.deviceId ?? undefined, tx);
    });
  }

  async logout(tenantId: string, refreshToken: string): Promise<void> {
    const tokenHash = hashOpaqueToken(refreshToken);
    await this.db.run(tenantId, async (tx) => {
      await tx.refreshToken.updateMany({
        where: { tenantId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private async issueTokenPair(
    tenantId: string,
    userId: string,
    deviceId: string | undefined,
    tx?: Parameters<Parameters<PrismaTenantService['run']>[1]>[0],
  ): Promise<TokenPair> {
    const accessToken = this.jwt.sign({ sub: userId, tenantId, deviceId });
    const refreshToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    const create = async (t: Parameters<Parameters<PrismaTenantService['run']>[1]>[0]) =>
      t.refreshToken.create({
        data: { id: newId(), tenantId, userId, deviceId, tokenHash, expiresAt },
      });

    if (tx) {
      await create(tx);
    } else {
      await this.db.run(tenantId, create);
    }

    return { accessToken, refreshToken, expiresIn: process.env.JWT_ACCESS_TTL ?? '15m', tenantId };
  }
}

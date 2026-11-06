import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { newId, newTransactionalId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { AssignRoleDto } from './dto/assign-role.dto.js';

function generateTemporaryPassword(): string {
  // 16 octets aléatoires -> ~22 caractères base64url, largement suffisant en
  // entropie pour un mot de passe temporaire affiché une seule fois.
  return randomBytes(16).toString('base64url');
}

/**
 * Gestion des utilisateurs du tenant (Phase 8.4 — cf docs/PROJECT_STATUS.md).
 * Le modèle RBAC atomique (Role/RolePermission/UserRole avec scope) existe
 * déjà (cf RbacService) ; ce service ne fait qu'exposer sa gestion via une
 * vraie API, il ne réimplémente pas la logique d'autorisation elle-même.
 */
@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaTenantService) {}

  async list(tenantId: string) {
    return this.db.run(tenantId, async (tx) => {
      const users = await tx.user.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { fullName: 'asc' },
      });
      const userRoles = await tx.userRole.findMany({
        where: { tenantId },
        include: { role: true },
      });
      const rolesByUserId = new Map<string, typeof userRoles>();
      for (const ur of userRoles) {
        const list = rolesByUserId.get(ur.userId) ?? [];
        list.push(ur);
        rolesByUserId.set(ur.userId, list);
      }
      return users.map((u) => ({
        ...u,
        passwordHash: undefined,
        roles: (rolesByUserId.get(u.id) ?? []).map((ur) => ({
          userRoleId: ur.id,
          roleId: ur.roleId,
          roleName: ur.role.name,
          scopeType: ur.scopeType,
          scopeLocationIds: ur.scopeLocationIds,
        })),
      }));
    });
  }

  async create(tenantId: string, actingUserId: string, dto: CreateUserDto) {
    const temporaryPassword = dto.password ?? generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);

    try {
      const user = await this.db.run(tenantId, async (tx) => {
        const existing = await tx.user.findFirst({
          where: { tenantId, email: dto.email, deletedAt: null },
        });
        if (existing) {
          throw new ConflictException('Un utilisateur existe déjà avec cet email');
        }

        const sub = await tx.platformSubscription.findUnique({
          where: { tenantId },
          include: { plan: true },
        });
        if (sub) {
          if (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED') {
            throw new ForbiddenException(`Espace de travail suspendu (${sub.status}). Action impossible.`);
          }
          if (sub.plan && sub.plan.maxUsers > 0) {
            const activeUsersCount = await tx.user.count({
              where: { tenantId, status: 'ACTIVE', deletedAt: null },
            });
            if (activeUsersCount >= sub.plan.maxUsers) {
              throw new BadRequestException(
                `Quota d'utilisateurs atteint (${activeUsersCount}/${sub.plan.maxUsers}). Veuillez passer à une offre supérieure.`,
              );
            }
          }
        }

        const created = await tx.user.create({
          data: { id: newId(), tenantId, email: dto.email, fullName: dto.fullName, passwordHash },
        });
        // Audit (cf continuation §38 : toute action sensible doit être traçable) —
        // jamais le mot de passe, même généré, dans le payload de l'événement.
        await tx.outboxEvent.create({
          data: {
            id: newTransactionalId(),
            tenantId,
            eventType: 'users.user.created',
            payload: { actorUserId: actingUserId, entityType: 'User', entityId: created.id, email: created.email },
          },
        });
        return created;
      });
      return {
        ...user,
        passwordHash: undefined,
        // Absent si l'admin a fourni son propre mot de passe : il le connaît déjà.
        temporaryPassword: dto.password ? undefined : temporaryPassword,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Un utilisateur existe déjà avec cet email');
      }
      throw err;
    }
  }

  async updateProfile(tenantId: string, userId: string, dto: UpdateUserDto) {
    return this.db.run(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } });
      if (!user) throw new NotFoundException('Utilisateur introuvable');
      const updated = await tx.user.update({ where: { id: userId }, data: { fullName: dto.fullName } });
      return { ...updated, passwordHash: undefined };
    });
  }

  /**
   * Compte les attributions ACTIVES du rôle-modèle "tenant_owner" pour ce
   * tenant, utilisateur actif exclu — sert à empêcher qu'une action (retrait
   * de rôle ou désactivation de compte) ne laisse le tenant sans aucun
   * propriétaire, ce qui le rendrait irrécupérable sans intervention manuelle
   * en base (cf règle de continuation §38 : toute action sensible doit rester
   * cohérente, pas seulement traçable).
   */
  private async countOtherActiveOwners(
    tx: Prisma.TransactionClient,
    tenantId: string,
    excludingUserId: string,
  ): Promise<number> {
    const owners = await tx.userRole.findMany({
      where: { tenantId, role: { key: 'tenant_owner' }, userId: { not: excludingUserId } },
      include: { user: true },
    });
    return owners.filter((o) => o.user.status === 'ACTIVE' && !o.user.deletedAt).length;
  }

  async setStatus(tenantId: string, actingUserId: string, userId: string, status: 'ACTIVE' | 'DISABLED') {
    if (status === 'DISABLED' && userId === actingUserId) {
      throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte');
    }
    return this.db.run(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } });
      if (!user) throw new NotFoundException('Utilisateur introuvable');

      if (status === 'DISABLED') {
        const userOwnerRoles = await tx.userRole.findFirst({
          where: { tenantId, userId, role: { key: 'tenant_owner' } },
        });
        if (userOwnerRoles) {
          const otherOwners = await this.countOtherActiveOwners(tx, tenantId, userId);
          if (otherOwners === 0) {
            throw new BadRequestException(
              'Impossible de désactiver le dernier propriétaire actif de ce commerce',
            );
          }
        }
      }

      const updated = await tx.user.update({ where: { id: userId }, data: { status } });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'users.user.status_changed',
          payload: { actorUserId: actingUserId, entityType: 'User', entityId: userId, before: user.status, after: status },
        },
      });
      return { ...updated, passwordHash: undefined };
    });
  }

  async assignRole(tenantId: string, actingUserId: string, userId: string, dto: AssignRoleDto) {
    return this.db.run(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } });
      if (!user) throw new NotFoundException('Utilisateur introuvable');

      // Le rôle attribué peut être un rôle-modèle (tenantId NULL, cf RLS
      // "tenant_isolation_or_template") ou un rôle propre au tenant — jamais
      // celui d'un AUTRE tenant (le findFirst filtré par tenantId+null via la
      // policy RLS elle-même garantit déjà cette isolation).
      const role = await tx.role.findFirst({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Rôle introuvable');

      // TEAM porte aussi une liste d'emplacements (ceux supervisés, cf
      // RbacService.getRecordVisibility) — même exigence que LOCATIONS.
      const usesLocationIds = dto.scopeType === 'LOCATIONS' || dto.scopeType === 'TEAM';
      if (usesLocationIds && (!dto.scopeLocationIds || dto.scopeLocationIds.length === 0)) {
        throw new BadRequestException(`Au moins un emplacement est requis pour le scope ${dto.scopeType}`);
      }

      const userRole = await tx.userRole.create({
        data: {
          id: newId(),
          tenantId,
          userId,
          roleId: dto.roleId,
          scopeType: dto.scopeType,
          scopeLocationIds: usesLocationIds ? (dto.scopeLocationIds ?? []) : [],
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'users.role.assigned',
          payload: {
            actorUserId: actingUserId,
            entityType: 'User',
            entityId: userId,
            roleId: dto.roleId,
            roleName: role.name,
            scopeType: dto.scopeType,
          },
        },
      });
      return userRole;
    });
  }

  async removeRole(tenantId: string, actingUserId: string, userId: string, userRoleId: string) {
    return this.db.run(tenantId, async (tx) => {
      const userRole = await tx.userRole.findFirst({
        where: { id: userRoleId, tenantId, userId },
        include: { role: true },
      });
      if (!userRole) throw new NotFoundException('Attribution de rôle introuvable');

      if (userRole.role.key === 'tenant_owner') {
        const otherOwners = await this.countOtherActiveOwners(tx, tenantId, userId);
        if (otherOwners === 0) {
          throw new ForbiddenException(
            'Impossible de retirer le rôle Propriétaire : ce serait le dernier de ce commerce',
          );
        }
      }

      await tx.userRole.delete({ where: { id: userRoleId } });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'users.role.removed',
          payload: {
            actorUserId: actingUserId,
            entityType: 'User',
            entityId: userId,
            roleId: userRole.roleId,
            roleName: userRole.role.name,
          },
        },
      });
      return { removed: true };
    });
  }

  /**
   * Changement de mot de passe PAR L'UTILISATEUR LUI-MÊME (distinct de la
   * réinitialisation admin — cf continuation §2.1) : exige le mot de passe
   * actuel, n'a besoin d'aucune permission autre que d'être authentifié
   * (jamais USERS_MANAGE — cet utilisateur ne doit pas pouvoir changer le
   * mot de passe d'un autre par cette route). Toutes les sessions existantes
   * sont révoquées après coup : un attaquant qui aurait volé une session ne
   * doit pas y conserver l'accès une fois le mot de passe changé.
   */
  async changeOwnPassword(tenantId: string, userId: string, currentPassword: string, newPassword: string) {
    return this.db.run(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } });
      if (!user) throw new NotFoundException('Utilisateur introuvable');

      const valid = await argon2.verify(user.passwordHash, currentPassword);
      if (!valid) {
        throw new BadRequestException('Mot de passe actuel incorrect');
      }

      const passwordHash = await argon2.hash(newPassword);
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { tenantId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'users.password.changed',
          payload: { actorUserId: userId, entityType: 'User', entityId: userId, source: 'self_service' },
        },
      });
      return { changed: true };
    });
  }
}

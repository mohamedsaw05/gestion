import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidPermissionKey, newId, newTransactionalId, PERMISSIONS_CATALOG } from '@gestionnaire/db';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';
import type { UpdateRoleDto } from './dto/update-role.dto.js';

function assertValidPermissions(permissions: string[]): void {
  const invalid = permissions.filter((p) => !isValidPermissionKey(p));
  if (invalid.length > 0) {
    throw new BadRequestException(`Permission(s) inconnue(s) : ${invalid.join(', ')}`);
  }
}

/**
 * Gestion des rôles du tenant (Phase 8.4). ATTENTION SÉCURITÉ : la policy RLS
 * de "Role"/"RolePermission" (cf migration init, "tenant_isolation_or_template")
 * autorise la LECTURE des rôles-modèles plateforme (tenantId NULL, partagés
 * par TOUS les tenants) mais ne bloque PAS leur écriture au niveau base — un
 * `UPDATE ... WHERE "tenantId" IS NULL` matche toujours la clause USING. La
 * protection réelle contre la modification d'un rôle-modèle par un tenant est
 * donc APPLICATIVE, ici, systématiquement avant toute écriture.
 */
@Injectable()
export class RolesService {
  constructor(private readonly db: PrismaTenantService) {}

  getPermissionsCatalog() {
    return PERMISSIONS_CATALOG;
  }

  async list(tenantId: string) {
    return this.db.run(tenantId, async (tx) => {
      const roles = await tx.role.findMany({
        where: { OR: [{ tenantId: null }, { tenantId }] },
        include: { permissions: true },
        orderBy: [{ isTemplate: 'desc' }, { name: 'asc' }],
      });
      return roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        isTemplate: r.tenantId === null,
        permissions: r.permissions.map((p) => p.permissionKey),
      }));
    });
  }

  /**
   * Lecture réutilisable AVEC un `tx` déjà ouvert — jamais via `this.db.run`
   * imbriqué dans une transaction en cours (Prisma ouvrirait une seconde
   * transaction sur une connexion séparée du pool, qui ne verrait pas les
   * écritures non committées de la première : piège déjà rencontré et évité
   * dans CashRegisterService, reproduit puis corrigé ici).
   */
  private async mapRole(tx: Prisma.TransactionClient, id: string) {
    const role = await tx.role.findFirst({ where: { id }, include: { permissions: true } });
    if (!role) throw new NotFoundException('Rôle introuvable');
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      isTemplate: role.tenantId === null,
      permissions: role.permissions.map((p) => p.permissionKey),
    };
  }

  async getById(tenantId: string, id: string) {
    return this.db.run(tenantId, (tx) => this.mapRole(tx, id));
  }

  async create(tenantId: string, actorUserId: string, dto: CreateRoleDto) {
    assertValidPermissions(dto.permissions);
    const key = `custom_${newId()}`;

    return this.db.run(tenantId, async (tx) => {
      const role = await tx.role.create({
        data: { id: newId(), tenantId, key, name: dto.name, isTemplate: false },
      });
      await tx.rolePermission.createMany({
        data: dto.permissions.map((permissionKey) => ({
          id: newId(),
          tenantId,
          roleId: role.id,
          permissionKey,
        })),
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'roles.role.created',
          payload: { actorUserId, entityType: 'Role', entityId: role.id, name: role.name, permissions: dto.permissions },
        },
      });
      return this.mapRole(tx, role.id);
    });
  }

  async update(tenantId: string, actorUserId: string, id: string, dto: UpdateRoleDto) {
    if (dto.permissions) assertValidPermissions(dto.permissions);

    return this.db.run(tenantId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id, tenantId }, include: { permissions: true } });
      // findFirst filtré explicitement par tenantId (PAS tx.role.findFirst({id}) seul,
      // qui laisserait passer un rôle-modèle tenantId=NULL via la policy RLS de lecture) :
      // un rôle-modèle ou un rôle d'un autre tenant renvoie ici "introuvable", jamais
      // "interdit" — pas de fuite d'existence cross-tenant.
      if (!role) throw new NotFoundException('Rôle introuvable pour ce commerce');
      const beforePermissions = role.permissions.map((p) => p.permissionKey);

      if (dto.name) {
        await tx.role.update({ where: { id }, data: { name: dto.name } });
      }
      if (dto.permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: id, tenantId } });
        await tx.rolePermission.createMany({
          data: dto.permissions.map((permissionKey) => ({
            id: newId(),
            tenantId,
            roleId: id,
            permissionKey,
          })),
        });
      }
      // "changement de permission" est explicitement listé comme action sensible
      // à tracer (cf continuation §38) — avant/après conservés dans le payload.
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'roles.role.updated',
          payload: {
            actorUserId,
            entityType: 'Role',
            entityId: id,
            nameBefore: role.name,
            nameAfter: dto.name ?? role.name,
            permissionsBefore: beforePermissions,
            permissionsAfter: dto.permissions ?? beforePermissions,
          },
        },
      });
      return this.mapRole(tx, id);
    });
  }

  async clone(tenantId: string, actorUserId: string, sourceRoleId: string, name?: string) {
    return this.db.run(tenantId, async (tx) => {
      const source = await tx.role.findFirst({ where: { id: sourceRoleId }, include: { permissions: true } });
      if (!source) throw new NotFoundException('Rôle source introuvable');

      const role = await tx.role.create({
        data: {
          id: newId(),
          tenantId,
          key: `custom_${newId()}`,
          name: name ?? `${source.name} (copie)`,
          isTemplate: false,
        },
      });
      if (source.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: source.permissions.map((p) => ({
            id: newId(),
            tenantId,
            roleId: role.id,
            permissionKey: p.permissionKey,
          })),
        });
      }
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'roles.role.created',
          payload: {
            actorUserId,
            entityType: 'Role',
            entityId: role.id,
            name: role.name,
            clonedFromRoleId: source.id,
          },
        },
      });
      return this.mapRole(tx, role.id);
    });
  }

  async delete(tenantId: string, actorUserId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id, tenantId } });
      if (!role) throw new NotFoundException('Rôle introuvable pour ce commerce');

      const usage = await tx.userRole.findFirst({ where: { tenantId, roleId: id } });
      if (usage) {
        throw new ConflictException('Ce rôle est attribué à au moins un utilisateur et ne peut pas être supprimé');
      }

      await tx.rolePermission.deleteMany({ where: { roleId: id, tenantId } });
      await tx.role.delete({ where: { id } });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'roles.role.deleted',
          payload: { actorUserId, entityType: 'Role', entityId: id, name: role.name },
        },
      });
      return { deleted: true };
    });
  }
}

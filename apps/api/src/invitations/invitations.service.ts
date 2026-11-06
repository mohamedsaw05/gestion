import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { newId, newTransactionalId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { generateOpaqueToken, hashOpaqueToken } from '../common/opaque-token.util.js';
import type { CreateInvitationDto } from './dto/create-invitation.dto.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

/**
 * Invitation par email (Phase 8.4 §3). L'envoi réel de l'email est ABSTRAIT
 * derrière un provider qui n'existe pas encore (Notification Engine =
 * PLANNED) : le lien d'invitation est retourné une seule fois dans la
 * réponse HTTP à l'émetteur, exactement comme le mot de passe temporaire
 * (cf UsersService.create) — honnête sur ce qui est réellement vérifié
 * (le flux complet token→acceptation) par opposition à ce qui ne l'est pas
 * (la livraison réelle d'un email).
 *
 * Le tenant d'une invitation est FIXE dès sa création : l'acceptation
 * re-fournit ce même tenantId (jamais déduit d'ailleurs), donc une
 * invitation ne peut jamais faire "changer de tenant" un compte.
 */
@Injectable()
export class InvitationsService {
  constructor(private readonly db: PrismaTenantService) {}

  async create(tenantId: string, actorUserId: string, dto: CreateInvitationDto) {
    const usesLocationIds = dto.scopeType === 'LOCATIONS' || dto.scopeType === 'TEAM';
    if (usesLocationIds && (!dto.scopeLocationIds || dto.scopeLocationIds.length === 0)) {
      throw new BadRequestException(`Au moins un emplacement est requis pour le scope ${dto.scopeType}`);
    }

    const token = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(token);

    return this.db.run(tenantId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Rôle introuvable');

      const existingUser = await tx.user.findFirst({
        where: { tenantId, email: dto.email, deletedAt: null },
      });
      if (existingUser) {
        throw new ConflictException('Un utilisateur existe déjà avec cet email dans ce commerce');
      }

      const invitation = await tx.invitation.create({
        data: {
          id: newId(),
          tenantId,
          email: dto.email,
          roleId: dto.roleId,
          scopeType: dto.scopeType,
          scopeLocationIds: usesLocationIds ? (dto.scopeLocationIds ?? []) : [],
          tokenHash,
          invitedByUserId: actorUserId,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'users.invitation.created',
          payload: {
            actorUserId,
            entityType: 'Invitation',
            entityId: invitation.id,
            email: dto.email,
            roleId: dto.roleId,
          },
        },
      });

      return {
        invitation: { ...invitation, tokenHash: undefined },
        invitationToken: token,
        deliveryStatus: 'CREATED_LINK_GENERATED_NO_SMTP_DISPATCH',
      };
    });
  }

  async list(tenantId: string) {
    return this.db.run(tenantId, (tx) =>
      tx.invitation.findMany({
        where: { tenantId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async revoke(tenantId: string, actorUserId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const invitation = await tx.invitation.findFirst({ where: { id, tenantId } });
      if (!invitation) throw new NotFoundException('Invitation introuvable');
      if (invitation.status !== 'PENDING') {
        throw new BadRequestException('Cette invitation n\'est plus en attente');
      }
      await tx.invitation.update({ where: { id }, data: { status: 'REVOKED' } });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'users.invitation.revoked',
          payload: { actorUserId, entityType: 'Invitation', entityId: id, email: invitation.email },
        },
      });
      return { revoked: true };
    });
  }

  /** PUBLIC (pas de JWT) : aperçu minimal avant acceptation, sans fuiter plus que nécessaire. */
  async preview(tenantId: string, token: string) {
    const tokenHash = hashOpaqueToken(token);
    return this.db.run(tenantId, async (tx) => {
      const invitation = await tx.invitation.findFirst({ where: { tenantId, tokenHash } });
      if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
        throw new NotFoundException('Invitation invalide ou expirée');
      }
      const role = await tx.role.findFirst({ where: { id: invitation.roleId } });
      return { email: invitation.email, roleName: role?.name ?? null };
    });
  }

  /** PUBLIC (pas de JWT) : crée le compte et l'attribution de rôle prévue par l'invitation. */
  async accept(tenantId: string, token: string, fullName: string, password: string) {
    const tokenHash = hashOpaqueToken(token);
    const passwordHash = await argon2.hash(password);

    return this.db.run(tenantId, async (tx) => {
      const invitation = await tx.invitation.findFirst({ where: { tenantId, tokenHash } });
      if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
        throw new NotFoundException('Invitation invalide ou expirée');
      }

      const existingUser = await tx.user.findFirst({
        where: { tenantId, email: invitation.email, deletedAt: null },
      });
      if (existingUser) {
        throw new ConflictException('Un utilisateur existe déjà avec cet email dans ce commerce');
      }

      const user = await tx.user.create({
        data: { id: newId(), tenantId, email: invitation.email, fullName, passwordHash },
      });
      await tx.userRole.create({
        data: {
          id: newId(),
          tenantId,
          userId: user.id,
          roleId: invitation.roleId,
          scopeType: invitation.scopeType,
          scopeLocationIds: invitation.scopeLocationIds,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'users.invitation.accepted',
          payload: { entityType: 'User', entityId: user.id, invitationId: invitation.id, email: user.email },
        },
      });

      return { ...user, passwordHash: undefined };
    });
  }
}

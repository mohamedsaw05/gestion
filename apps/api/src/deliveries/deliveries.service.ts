import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newTransactionalId, PERMISSIONS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import type { CreateDeliveryDto } from './dto/create-delivery.dto.js';

/**
 * Delivery Engine (Phase 14, capability "delivery", module dépendant de
 * "orders" déjà déclaré dans ModuleRegistry depuis la Phase 8.2). Une
 * livraison est rattachée à UNE commande (contrainte d'unicité — plusieurs
 * expéditions pour la même commande = PLANNED). Cycle PENDING →
 * OUT_FOR_DELIVERY → DELIVERED (génère un DELIVERY_NOTE) ou FAILED ;
 * CANCELLED possible avant DELIVERED.
 *
 * Ne déclenche JAMAIS automatiquement la complétion de la commande
 * (paiement/stock) — décision assumée pour cette phase : livraison physique
 * et encaissement restent deux actions distinctes, l'opérateur complète la
 * commande via POST /orders/:id/complete quand le paiement est réellement
 * encaissé (cf commentaire du modèle Delivery dans schema.prisma).
 */
@Injectable()
export class DeliveriesService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly documents: DocumentsService,
    private readonly rbac: RbacService,
  ) {}

  /**
   * Delivery n'a pas de `locationId` propre (elle suit l'emplacement de sa
   * commande) et n'a PAS de relation Prisma formelle vers Order (cf le reste
   * du schéma : les FK inter-entités restent des colonnes scalaires, jointes
   * applicativement — jamais un `@relation` hors des tables lignes). Le
   * scope LOCATIONS se résout donc en deux temps : quelles commandes sont
   * dans ces emplacements, PUIS quelles livraisons pointent vers elles.
   *
   * Appelée HORS de toute transaction ouverte (comme dans Orders/Returns
   * Service) : `resolveTeamMemberUserIds` ouvre sa propre transaction, et
   * Prisma ne supporte pas l'imbrication de transactions interactives.
   */
  private async buildVisibilityWhere(tenantId: string, userId: string): Promise<Prisma.DeliveryWhereInput> {
    const visibility = await this.rbac.getRecordVisibility(tenantId, userId, PERMISSIONS.DELIVERIES_READ);
    if (visibility.allLocations) return {};

    const or: Prisma.DeliveryWhereInput[] = [];
    if (visibility.ownRecordsOnly) or.push({ createdByUserId: userId });
    if (visibility.teamLocationIds.length > 0) {
      const teamUserIds = await this.rbac.resolveTeamMemberUserIds(tenantId, visibility.teamLocationIds);
      if (teamUserIds.length > 0) or.push({ createdByUserId: { in: teamUserIds } });
    }
    if (visibility.locationIds.length > 0) {
      const ordersInScope = await this.db.run(tenantId, (tx) =>
        tx.order.findMany({ where: { tenantId, locationId: { in: visibility.locationIds } }, select: { id: true } }),
      );
      if (ordersInScope.length > 0) {
        or.push({ orderId: { in: ordersInScope.map((o) => o.id) } });
      }
    }
    return or.length > 0 ? { OR: or } : { id: '__none__' };
  }

  async list(tenantId: string, userId: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    return this.db.run(tenantId, async (tx) => {
      const deliveries = await tx.delivery.findMany({ where: { tenantId, ...visibilityWhere }, orderBy: { createdAt: 'desc' } });
      const orders = await tx.order.findMany({ where: { tenantId, id: { in: deliveries.map((d) => d.orderId) } } });
      const orderById = new Map(orders.map((o) => [o.id, o]));
      return deliveries.map((d) => ({ ...d, order: orderById.get(d.orderId) ?? null }));
    });
  }

  async getById(tenantId: string, userId: string, id: string) {
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    const delivery = await this.db.run(tenantId, (tx) =>
      tx.delivery.findFirst({ where: { id, tenantId, ...visibilityWhere } }),
    );
    if (!delivery) throw new NotFoundException('Livraison introuvable');
    return delivery;
  }

  async create(tenantId: string, actorUserId: string, dto: CreateDeliveryDto) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.delivery.findFirst({ where: { tenantId, operationId: dto.operationId } });
      if (existing) return existing;

      const order = await tx.order.findFirst({ where: { id: dto.orderId, tenantId } });
      if (!order) throw new BadRequestException('Commande introuvable');
      if (order.status === 'CANCELLED' || order.status === 'DRAFT') {
        throw new BadRequestException(
          `Une commande ${order.status} ne peut pas être planifiée pour livraison (doit être au moins confirmée)`,
        );
      }
      const alreadyDelivery = await tx.delivery.findFirst({ where: { tenantId, orderId: dto.orderId } });
      if (alreadyDelivery) {
        throw new BadRequestException('Cette commande a déjà une livraison planifiée');
      }

      const delivery = await tx.delivery.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          orderId: dto.orderId,
          address: dto.address,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
          assignedUserId: dto.assignedUserId,
          createdByUserId: actorUserId,
          operationId: dto.operationId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'deliveries.delivery.created',
          payload: { actorUserId, entityType: 'Delivery', entityId: delivery.id, orderId: dto.orderId },
        },
      });

      return delivery;
    });
  }

  async markOutForDelivery(tenantId: string, actorUserId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const delivery = await tx.delivery.findFirst({ where: { id, tenantId } });
      if (!delivery) throw new NotFoundException('Livraison introuvable');
      if (delivery.status !== 'PENDING') {
        throw new BadRequestException(`Seule une livraison PENDING peut passer en cours (statut actuel : ${delivery.status})`);
      }

      const updated = await tx.delivery.update({
        where: { id },
        data: { status: 'OUT_FOR_DELIVERY', outForDeliveryAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'deliveries.delivery.out_for_delivery',
          payload: { actorUserId, entityType: 'Delivery', entityId: id },
        },
      });
      return updated;
    });
  }

  /** Génère le bon de livraison (DELIVERY_NOTE) dans la même transaction — jamais une livraison "livrée" sans sa preuve. */
  async markDelivered(tenantId: string, actorUserId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const delivery = await tx.delivery.findFirst({ where: { id, tenantId } });
      if (!delivery) throw new NotFoundException('Livraison introuvable');
      if (delivery.status !== 'OUT_FOR_DELIVERY' && delivery.status !== 'PENDING') {
        throw new BadRequestException(`Une livraison ${delivery.status} ne peut pas être marquée livrée`);
      }

      const order = await tx.order.findFirst({ where: { id: delivery.orderId, tenantId }, include: { lines: true } });
      if (!order) throw new NotFoundException('Commande introuvable');

      const updated = await tx.delivery.update({
        where: { id },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });

      const number = await this.documents.nextDocumentNumber(tx, tenantId, order.locationId, 'DELIVERY_NOTE');
      const contentSnapshot = {
        documentType: 'DELIVERY_NOTE',
        number,
        issuedAt: new Date().toISOString(),
        orderNumber: order.id.slice(0, 8).toUpperCase(),
        orderId: order.id,
        address: delivery.address,
        status: 'DELIVERED',
        lines: order.lines.map((l) => ({
          product: l.productNameSnapshot,
          unit: l.unitSnapshot,
          quantity: l.quantity.toString(),
        })),
      };
      await tx.document.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          type: 'DELIVERY_NOTE',
          number,
          orderId: order.id,
          contentSnapshot: contentSnapshot as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'deliveries.delivery.delivered',
          payload: { actorUserId, entityType: 'Delivery', entityId: id, orderId: order.id },
        },
      });
      return updated;
    });
  }

  async markFailed(tenantId: string, actorUserId: string, id: string, reason: string) {
    return this.db.run(tenantId, async (tx) => {
      const delivery = await tx.delivery.findFirst({ where: { id, tenantId } });
      if (!delivery) throw new NotFoundException('Livraison introuvable');
      if (delivery.status !== 'OUT_FOR_DELIVERY') {
        throw new BadRequestException(`Seule une livraison en cours peut être marquée échouée (statut actuel : ${delivery.status})`);
      }

      const updated = await tx.delivery.update({
        where: { id },
        data: { status: 'FAILED', failureReason: reason },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'deliveries.delivery.failed',
          payload: { actorUserId, entityType: 'Delivery', entityId: id, reason },
        },
      });
      return updated;
    });
  }

  async cancel(tenantId: string, actorUserId: string, id: string, reason?: string) {
    return this.db.run(tenantId, async (tx) => {
      const delivery = await tx.delivery.findFirst({ where: { id, tenantId } });
      if (!delivery) throw new NotFoundException('Livraison introuvable');
      if (delivery.status === 'DELIVERED') {
        throw new BadRequestException('Une livraison déjà effectuée ne peut pas être annulée');
      }
      if (delivery.status === 'CANCELLED') return delivery;

      const updated = await tx.delivery.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });
      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'deliveries.delivery.cancelled',
          payload: { actorUserId, entityType: 'Delivery', entityId: id, reason: reason ?? null },
        },
      });
      return updated;
    });
  }
}

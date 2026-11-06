import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CAPABILITIES, newId, newTransactionalId, PERMISSIONS } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import type { CreateServiceOrderDto } from './dto/create-service-order.dto.js';
import type { UpdateServiceOrderDto } from './dto/update-service-order.dto.js';
import type { AddServiceItemDto } from './dto/add-service-item.dto.js';
import type { BillServiceOrderDto } from './dto/bill-service-order.dto.js';

@Injectable()
export class ServicesService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly businessProfile: BusinessProfileService,
    private readonly inventory: InventoryService,
    private readonly rbac: RbacService,
  ) {}

  private async checkCapability(tenantId: string) {
    const enabled = await this.businessProfile.isCapabilityEnabled(tenantId, CAPABILITIES.SERVICES);
    if (!enabled) {
      throw new BadRequestException(
        "Le module Prestations & Services n'est pas activé pour ce commerce (cf Profil du commerce)",
      );
    }
  }

  private async buildVisibilityWhere(tenantId: string, userId: string): Promise<Prisma.ServiceOrderWhereInput> {
    const visibility = await this.rbac.getRecordVisibility(tenantId, userId, PERMISSIONS.SERVICES_READ);
    if (visibility.allLocations) return {};

    const or: Prisma.ServiceOrderWhereInput[] = [];
    if (visibility.locationIds.length > 0) or.push({ locationId: { in: visibility.locationIds } });
    if (visibility.ownRecordsOnly) or.push({ assignedUserId: userId });
    if (visibility.teamLocationIds.length > 0) {
      const teamUserIds = await this.rbac.resolveTeamMemberUserIds(tenantId, visibility.teamLocationIds);
      if (teamUserIds.length > 0) or.push({ assignedUserId: { in: teamUserIds } });
    }
    return or.length > 0 ? { OR: or } : { id: '__none__' };
  }

  async list(
    tenantId: string,
    userId: string,
    query: {
      status?: string;
      customerId?: string;
      locationId?: string;
      assignedUserId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.checkCapability(tenantId);
    const visibilityWhere = await this.buildVisibilityWhere(tenantId, userId);
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceOrderWhereInput = {
      tenantId,
      ...visibilityWhere,
    };

    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
    if (query.search) {
      where.OR = [
        { referenceNumber: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { diagnosisNotes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.db.run(tenantId, async (tx) => {
      const [total, orders] = await Promise.all([
        tx.serviceOrder.count({ where }),
        tx.serviceOrder.findMany({
          where,
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      const customerIds = orders.map((o) => o.customerId).filter(Boolean) as string[];
      const locationIds = [...new Set(orders.map((o) => o.locationId))];
      const userIds = [...new Set(orders.map((o) => o.assignedUserId).filter(Boolean) as string[])];

      const [customers, locations, users] = await Promise.all([
        customerIds.length > 0
          ? tx.customer.findMany({
              where: { tenantId, id: { in: customerIds } },
              select: { id: true, name: true, phone: true },
            })
          : [],
        locationIds.length > 0
          ? tx.location.findMany({
              where: { tenantId, id: { in: locationIds } },
              select: { id: true, name: true },
            })
          : [],
        userIds.length > 0
          ? tx.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, email: true },
            })
          : [],
      ]);

      const customerMap = new Map(customers.map((c) => [c.id, c]));
      const locationMap = new Map(locations.map((l) => [l.id, l]));
      const userMap = new Map(users.map((u) => [u.id, u]));

      const data = orders.map((o) => ({
        ...o,
        customer: o.customerId ? customerMap.get(o.customerId) ?? null : null,
        location: locationMap.get(o.locationId) ?? null,
        assignedUser: o.assignedUserId ? userMap.get(o.assignedUserId) ?? null : null,
      }));

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }

  async getById(tenantId: string, id: string) {
    await this.checkCapability(tenantId);
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.serviceOrder.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Dossier de prestation introuvable');

      const [customer, location, assignedUser] = await Promise.all([
        order.customerId
          ? tx.customer.findFirst({
              where: { tenantId, id: order.customerId },
              select: { id: true, name: true, phone: true, email: true },
            })
          : null,
        tx.location.findFirst({
          where: { tenantId, id: order.locationId },
          select: { id: true, name: true },
        }),
        order.assignedUserId
          ? tx.user.findFirst({
              where: { id: order.assignedUserId },
              select: { id: true, email: true },
            })
          : null,
      ]);

      return {
        ...order,
        customer,
        location,
        assignedUser,
      };
    });
  }

  async create(tenantId: string, userId: string, dto: CreateServiceOrderDto) {
    await this.checkCapability(tenantId);
    const orderId = newId();

    return this.db.run(tenantId, async (tx) => {
      // Vérifier emplacement
      const loc = await tx.location.findFirst({ where: { id: dto.locationId, tenantId, deletedAt: null } });
      if (!loc) throw new BadRequestException('Emplacement introuvable');

      // Générer référence unique séquentielle
      const count = await tx.serviceOrder.count({ where: { tenantId } });
      const seq = String(count + 1).padStart(4, '0');
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const referenceNumber = `SRV-${today}-${seq}`;

      const quotedPrice = dto.quotedPrice ? new Prisma.Decimal(dto.quotedPrice) : new Prisma.Decimal(0);
      const scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : null;
      const status = scheduledDate ? 'SCHEDULED' : 'DRAFT';

      const order = await tx.serviceOrder.create({
        data: {
          id: orderId,
          tenantId,
          referenceNumber,
          title: dto.title,
          description: dto.description ?? null,
          diagnosisNotes: dto.diagnosisNotes ?? null,
          status,
          priority: dto.priority ?? 'NORMAL',
          customerId: dto.customerId ?? null,
          locationId: dto.locationId,
          assignedUserId: dto.assignedUserId ?? null,
          scheduledDate,
          estimatedDurationMinutes: dto.estimatedDurationMinutes ?? null,
          hourlyLaborRate: dto.hourlyLaborRate ? new Prisma.Decimal(dto.hourlyLaborRate) : null,
          quotedPrice,
          finalPrice: quotedPrice,
          grossMargin: quotedPrice,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'services.order.created',
          payload: {
            actorUserId: userId,
            entityType: 'ServiceOrder',
            entityId: order.id,
            referenceNumber,
            title: dto.title,
            status,
          },
        },
      });

      return order;
    });
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateServiceOrderDto) {
    await this.checkCapability(tenantId);
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.serviceOrder.findFirst({ where: { id, tenantId } });
      if (!order) throw new NotFoundException('Dossier de prestation introuvable');

      if (order.status === 'BILLED') {
        throw new BadRequestException('Impossible de modifier un dossier déjà facturé');
      }

      const data: Prisma.ServiceOrderUpdateInput = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.diagnosisNotes !== undefined) data.diagnosisNotes = dto.diagnosisNotes;
      if (dto.resolutionNotes !== undefined) data.resolutionNotes = dto.resolutionNotes;
      if (dto.priority !== undefined) data.priority = dto.priority;
      if (dto.customerId !== undefined) data.customerId = dto.customerId;
      if (dto.locationId !== undefined) data.locationId = dto.locationId;
      if (dto.assignedUserId !== undefined) data.assignedUserId = dto.assignedUserId;
      if (dto.scheduledDate !== undefined) data.scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : null;
      if (dto.estimatedDurationMinutes !== undefined) data.estimatedDurationMinutes = dto.estimatedDurationMinutes;
      if (dto.actualDurationMinutes !== undefined) data.actualDurationMinutes = dto.actualDurationMinutes;
      if (dto.hourlyLaborRate !== undefined) data.hourlyLaborRate = dto.hourlyLaborRate ? new Prisma.Decimal(dto.hourlyLaborRate) : null;
      if (dto.quotedPrice !== undefined) data.quotedPrice = new Prisma.Decimal(dto.quotedPrice);

      if (dto.finalPrice !== undefined) {
        const finalPrice = new Prisma.Decimal(dto.finalPrice);
        data.finalPrice = finalPrice;
        data.grossMargin = finalPrice.minus(order.totalCost);
      }

      if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === 'COMPLETED' && !order.completedAt) {
          data.completedAt = new Date();
        }
      }

      const updated = await tx.serviceOrder.update({
        where: { id },
        data,
        include: { items: true },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'services.order.updated',
          payload: {
            actorUserId: userId,
            entityType: 'ServiceOrder',
            entityId: id,
            status: updated.status,
          },
        },
      });

      return updated;
    });
  }

  async addItem(tenantId: string, userId: string, serviceOrderId: string, dto: AddServiceItemDto) {
    await this.checkCapability(tenantId);
    const qty = new Prisma.Decimal(dto.quantity);
    if (qty.lessThanOrEqualTo(0)) {
      throw new BadRequestException('La quantité doit être strictement positive');
    }

    return this.db.run(tenantId, async (tx) => {
      const order = await tx.serviceOrder.findFirst({ where: { id: serviceOrderId, tenantId } });
      if (!order) throw new NotFoundException('Dossier de prestation introuvable');
      if (order.status === 'BILLED') {
        throw new BadRequestException("Impossible d'ajouter des éléments à un dossier déjà facturé");
      }

      let unitCost = dto.unitCost ? new Prisma.Decimal(dto.unitCost) : new Prisma.Decimal(0);
      let stockDeducted = false;
      let stockMovementId: string | null = null;

      if (dto.itemType === 'PART' && dto.productId) {
        const product = await tx.product.findFirst({
          where: { id: dto.productId, tenantId, deletedAt: null },
        });
        if (!product) throw new BadRequestException('Produit/pièce détachée introuvable');

        if (!dto.unitCost) {
          unitCost = product.costPrice ? new Prisma.Decimal(product.costPrice) : new Prisma.Decimal(0);
        }

        if (product.isStocked) {
          // Décrémenter le stock avec traçabilité complète
          const mov = await this.inventory.applyStockMovementWithTx(
            tx,
            tenantId,
            order.locationId,
            product.id,
            qty.negated(),
            'service_consumption',
            'service_order',
            serviceOrderId,
          );
          stockDeducted = true;
          stockMovementId = mov.movementId;
        }
      }

      const unitPrice = new Prisma.Decimal(dto.unitPrice);
      const lineTotal = unitPrice.times(qty);
      const itemId = newId();

      await tx.serviceOrderItem.create({
        data: {
          id: itemId,
          tenantId,
          serviceOrderId,
          productId: dto.productId ?? null,
          itemType: dto.itemType,
          name: dto.name,
          quantity: qty,
          unitCost,
          unitPrice,
          lineTotal,
          stockDeducted,
          stockMovementId,
        },
      });

      // Recalculer les coûts et le prix final
      const allItems = await tx.serviceOrderItem.findMany({ where: { tenantId, serviceOrderId } });
      let laborCost = new Prisma.Decimal(0);
      let partsCost = new Prisma.Decimal(0);
      let otherCost = new Prisma.Decimal(0);
      let calculatedPrice = new Prisma.Decimal(0);

      for (const it of allItems) {
        calculatedPrice = calculatedPrice.plus(it.lineTotal);
        const itemCost = it.unitCost.times(it.quantity);
        if (it.itemType === 'LABOR') laborCost = laborCost.plus(itemCost);
        else if (it.itemType === 'PART') partsCost = partsCost.plus(itemCost);
        else otherCost = otherCost.plus(itemCost);
      }

      const totalCost = laborCost.plus(partsCost).plus(otherCost);
      const finalPrice = calculatedPrice;
      const grossMargin = finalPrice.minus(totalCost);

      const updated = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          laborCost,
          partsCost,
          otherCost,
          totalCost,
          finalPrice,
          grossMargin,
        },
        include: { items: true },
      });

      return updated;
    });
  }

  async removeItem(tenantId: string, userId: string, serviceOrderId: string, itemId: string) {
    await this.checkCapability(tenantId);
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.serviceOrder.findFirst({ where: { id: serviceOrderId, tenantId } });
      if (!order) throw new NotFoundException('Dossier de prestation introuvable');
      if (order.status === 'BILLED') {
        throw new BadRequestException('Impossible de modifier un dossier déjà facturé');
      }

      const item = await tx.serviceOrderItem.findFirst({
        where: { id: itemId, serviceOrderId, tenantId },
      });
      if (!item) throw new NotFoundException('Élément introuvable');

      // Si du stock avait été déduit, restituer le stock
      if (item.stockDeducted && item.productId) {
        await this.inventory.applyStockMovementWithTx(
          tx,
          tenantId,
          order.locationId,
          item.productId,
          item.quantity,
          'service_return',
          'service_order',
          serviceOrderId,
        );
      }

      await tx.serviceOrderItem.delete({ where: { id: itemId } });

      // Recalculer
      const allItems = await tx.serviceOrderItem.findMany({ where: { tenantId, serviceOrderId } });
      let laborCost = new Prisma.Decimal(0);
      let partsCost = new Prisma.Decimal(0);
      let otherCost = new Prisma.Decimal(0);
      let calculatedPrice = new Prisma.Decimal(0);

      for (const it of allItems) {
        calculatedPrice = calculatedPrice.plus(it.lineTotal);
        const itemCost = it.unitCost.times(it.quantity);
        if (it.itemType === 'LABOR') laborCost = laborCost.plus(itemCost);
        else if (it.itemType === 'PART') partsCost = partsCost.plus(itemCost);
        else otherCost = otherCost.plus(itemCost);
      }

      const totalCost = laborCost.plus(partsCost).plus(otherCost);
      const finalPrice = calculatedPrice;
      const grossMargin = finalPrice.minus(totalCost);

      return tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          laborCost,
          partsCost,
          otherCost,
          totalCost,
          finalPrice,
          grossMargin,
        },
        include: { items: true },
      });
    });
  }

  async bill(tenantId: string, userId: string, serviceOrderId: string, dto: BillServiceOrderDto) {
    await this.checkCapability(tenantId);
    return this.db.run(tenantId, async (tx) => {
      const order = await tx.serviceOrder.findFirst({
        where: { id: serviceOrderId, tenantId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Dossier de prestation introuvable');
      if (order.status === 'BILLED') {
        throw new BadRequestException('Ce dossier est déjà facturé');
      }
      if (order.finalPrice.lessThanOrEqualTo(0)) {
        throw new BadRequestException('Le montant final à facturer doit être supérieur à zéro');
      }

      const saleId = newId();
      const operationId = newId();
      const paymentMethod = dto.paymentMethod ?? 'CASH';
      const amountPaid = dto.amountPaid ? new Prisma.Decimal(dto.amountPaid) : order.finalPrice;
      const balanceDue = order.finalPrice.minus(amountPaid);
      const paymentStatus = balanceDue.isZero() ? 'PAID' : amountPaid.isZero() ? 'UNPAID' : 'PARTIAL';

      // Créer la vente pour traçabilité comptable et financière
      await tx.sale.create({
        data: {
          id: saleId,
          tenantId,
          locationId: order.locationId,
          customerId: order.customerId,
          sellerUserId: userId,
          currency: 'XOF',
          subtotal: order.finalPrice,
          taxTotal: new Prisma.Decimal(0),
          discountTotal: new Prisma.Decimal(0),
          grandTotal: order.finalPrice,
          amountPaid,
          balanceDue,
          paymentStatus,
          status: 'COMPLETED',
          operationId,
        },
      });

      // Lignes de vente depuis les items de service
      for (const it of order.items) {
        await tx.saleLine.create({
          data: {
            id: newTransactionalId(),
            tenantId,
            saleId,
            productId: it.productId ?? order.id,
            productNameSnapshot: `[${it.itemType}] ${it.name}`,
            unitSnapshot: 'unite',
            quantity: it.quantity,
            conversionFactorSnapshot: new Prisma.Decimal(1),
            unitPriceSnapshot: it.unitPrice,
            appliedPriceRule: 'SERVICE_ORDER',
            lineTotal: it.lineTotal,
            costPriceSnapshot: it.unitCost,
          },
        });
      }

      // Enregistrement du paiement
      if (amountPaid.greaterThan(0)) {
        await tx.payment.create({
          data: {
            id: newTransactionalId(),
            tenantId,
            saleId,
            currency: 'XOF',
            method: paymentMethod,
            amount: amountPaid,
          },
        });
      }

      // Si solde dû avec client, enregistrer la créance
      if (balanceDue.greaterThan(0) && order.customerId) {
        const acc = await tx.creditAccount.findUnique({
          where: { tenantId_customerId: { tenantId, customerId: order.customerId } },
        });
        if (acc) {
          await tx.creditAccount.update({
            where: { id: acc.id },
            data: { balance: acc.balance.plus(balanceDue) },
          });
          await tx.creditMovement.create({
            data: {
              id: newTransactionalId(),
              tenantId,
              accountId: acc.id,
              movementType: 'DEBIT',
              amount: balanceDue,
              referenceType: 'sale',
              referenceId: saleId,
            },
          });
        }
      }

      // Mettre à jour le dossier de service
      const billed = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          status: 'BILLED',
          saleId,
          completedAt: order.completedAt ?? new Date(),
        },
        include: { items: true },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'services.order.billed',
          payload: {
            actorUserId: userId,
            entityType: 'ServiceOrder',
            entityId: serviceOrderId,
            saleId,
            finalPrice: order.finalPrice.toString(),
            grossMargin: order.grossMargin.toString(),
          },
        },
      });

      return billed;
    });
  }

  async getStats(tenantId: string) {
    await this.checkCapability(tenantId);
    return this.db.run(tenantId, async (tx) => {
      const [total, draft, inProgress, completed, billed] = await Promise.all([
        tx.serviceOrder.count({ where: { tenantId } }),
        tx.serviceOrder.count({ where: { tenantId, status: { in: ['DRAFT', 'QUALIFIED', 'SCHEDULED'] } } }),
        tx.serviceOrder.count({ where: { tenantId, status: { in: ['IN_PROGRESS', 'ON_HOLD'] } } }),
        tx.serviceOrder.count({ where: { tenantId, status: 'COMPLETED' } }),
        tx.serviceOrder.count({ where: { tenantId, status: 'BILLED' } }),
      ]);

      const billedOrders = await tx.serviceOrder.findMany({
        where: { tenantId, status: 'BILLED' },
        select: { finalPrice: true, grossMargin: true, totalCost: true },
      });

      let totalRevenue = new Prisma.Decimal(0);
      let totalMargin = new Prisma.Decimal(0);
      let totalCost = new Prisma.Decimal(0);

      for (const o of billedOrders) {
        totalRevenue = totalRevenue.plus(o.finalPrice);
        totalMargin = totalMargin.plus(o.grossMargin);
        totalCost = totalCost.plus(o.totalCost);
      }

      return {
        totalOrders: total,
        pendingOrders: draft,
        inProgressOrders: inProgress,
        completedOrders: completed,
        billedOrders: billed,
        totalRevenue: Number(totalRevenue),
        totalMargin: Number(totalMargin),
        totalCost: Number(totalCost),
        marginRate: Number(totalCost) > 0 ? (Number(totalMargin) / Number(totalCost)) * 100 : 0,
      };
    });
  }
}

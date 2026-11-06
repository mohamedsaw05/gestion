import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { newTransactionalId } from '@gestionnaire/db';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

export interface HeldCartItem {
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  unit?: string;
  discountPercent?: string;
  serialNumbers?: string[];
}

export interface HeldCart {
  id: string;
  tenantId: string;
  locationId: string;
  sellerUserId: string;
  label: string;
  customerId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  items: HeldCartItem[];
  estimatedTotal: string;
  currency: string;
  status: string;
  createdAt: string;
}

export interface SaveHeldCartDto {
  locationId: string;
  label?: string;
  customerId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  items: HeldCartItem[];
  estimatedTotal: string;
}

@Injectable()
export class HeldCartsService {
  constructor(private readonly db: PrismaTenantService) {}

  async list(tenantId: string, locationId?: string): Promise<HeldCart[]> {
    return this.db.run(tenantId, async (tx) => {
      const carts = await tx.heldCart.findMany({
        where: {
          tenantId,
          ...(locationId ? { locationId } : {}),
          status: 'HELD',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      return carts.map((c) => ({
        id: c.id,
        tenantId: c.tenantId,
        locationId: c.locationId,
        sellerUserId: c.sellerUserId,
        label: c.label,
        customerId: c.customerId,
        customerName: c.customerName,
        notes: null,
        items: c.items as unknown as HeldCartItem[],
        estimatedTotal: c.estimatedTotal.toString(),
        currency: c.currency,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      }));
    });
  }

  async get(tenantId: string, id: string): Promise<HeldCart> {
    return this.db.run(tenantId, async (tx) => {
      const cart = await tx.heldCart.findFirst({
        where: { id, tenantId },
      });
      if (!cart) throw new NotFoundException('Panier suspendu introuvable');
      return {
        id: cart.id,
        tenantId: cart.tenantId,
        locationId: cart.locationId,
        sellerUserId: cart.sellerUserId,
        label: cart.label,
        customerId: cart.customerId,
        customerName: cart.customerName,
        notes: null,
        items: cart.items as unknown as HeldCartItem[],
        estimatedTotal: cart.estimatedTotal.toString(),
        currency: cart.currency,
        status: cart.status,
        createdAt: cart.createdAt.toISOString(),
      };
    });
  }

  async create(tenantId: string, sellerUserId: string, dto: SaveHeldCartDto): Promise<HeldCart> {
    return this.db.run(tenantId, async (tx) => {
      const id = newTransactionalId();
      const label =
        dto.label?.trim() ||
        (dto.customerName
          ? `Panier - ${dto.customerName}`
          : `Panier suspendu (${dto.items.length} art.)`);

      const created = await tx.heldCart.create({
        data: {
          id,
          tenantId,
          locationId: dto.locationId,
          sellerUserId,
          label,
          customerId: dto.customerId ?? null,
          customerName: dto.customerName ?? null,
          items: dto.items as unknown as Prisma.InputJsonValue,
          estimatedTotal: new Prisma.Decimal(dto.estimatedTotal || 0),
          currency: 'XOF',
          status: 'HELD',
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // Expiration 7 jours
        },
      });

      return {
        id: created.id,
        tenantId: created.tenantId,
        locationId: created.locationId,
        sellerUserId: created.sellerUserId,
        label: created.label,
        customerId: created.customerId,
        customerName: created.customerName,
        notes: null,
        items: created.items as unknown as HeldCartItem[],
        estimatedTotal: created.estimatedTotal.toString(),
        currency: created.currency,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      };
    });
  }

  async resume(tenantId: string, id: string, resumedByUserId: string): Promise<HeldCart> {
    return this.db.run(tenantId, async (tx) => {
      const cart = await tx.heldCart.findFirst({
        where: { id, tenantId },
      });
      if (!cart) throw new NotFoundException('Panier suspendu introuvable');
      if (cart.expiresAt && cart.expiresAt < new Date()) {
        throw new ConflictException('Ce panier suspendu a expiré et ne peut plus être repris');
      }

      // Verrou atomique conditionnel (Correction S1-02) :
      // updateMany acquiert un verrou exclusif sur la ligne et ne réussit que si le statut est encore strictement 'HELD'
      const now = new Date();
      const updatedCount = await tx.heldCart.updateMany({
        where: {
          id: cart.id,
          tenantId,
          status: 'HELD',
        },
        data: {
          status: 'RESUMED',
          resumedAt: now,
          resumedByUserId,
        },
      });

      if (updatedCount.count === 0) {
        throw new ConflictException(
          'VTM-CART-ALREADY-RESUMED: Ce panier a déjà été repris ou annulé par un autre utilisateur',
        );
      }

      return {
        id: cart.id,
        tenantId: cart.tenantId,
        locationId: cart.locationId,
        sellerUserId: cart.sellerUserId,
        label: cart.label,
        customerId: cart.customerId,
        customerName: cart.customerName,
        notes: null,
        items: cart.items as unknown as HeldCartItem[],
        estimatedTotal: cart.estimatedTotal.toString(),
        currency: cart.currency,
        status: 'RESUMED',
        createdAt: cart.createdAt.toISOString(),
      };
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.db.run(tenantId, async (tx) => {
      const updatedCount = await tx.heldCart.updateMany({
        where: { id, tenantId, status: 'HELD' },
        data: { status: 'DISCARDED' },
      });
      if (updatedCount.count === 0) {
        const cart = await tx.heldCart.findFirst({ where: { id, tenantId } });
        if (!cart) throw new NotFoundException('Panier suspendu introuvable');
        throw new ConflictException('Ce panier ne peut plus être annulé car il a déjà été repris ou clôturé');
      }
    });
  }
}

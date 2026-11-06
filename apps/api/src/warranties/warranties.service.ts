import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newTransactionalId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import type { ClaimWarrantyDto } from './dto/claim-warranty.dto.js';
import type { CreateWarrantyDto } from './dto/create-warranty.dto.js';
import type { UpdateWarrantyConfigurationDto } from './dto/update-warranty-configuration.dto.js';

export const DEFAULT_WARRANTY_CONFIGURATION = {
  defaultDurationMonths: 12,
  allowedDurations: [1, 3, 6, 12, 24],
  defaultType: 'STANDARD',
  types: ['STANDARD', 'CONSTRUCTEUR', 'MAGASIN', 'EXTENSION'],
  terms: 'Garantie applicable aux défauts de fonctionnement non imputables à une mauvaise utilisation.',
  exclusions: 'Chocs, oxydation, liquide, ouverture non autorisée et usure normale.',
  alertDays: [30, 7],
  requiredDocuments: ['Facture ou reçu'],
  handlingModes: ['Réparation', 'Remplacement', 'Diagnostic'],
  timeZone: 'Africa/Ouagadougou',
  categoryPolicies: {} as Record<string, { durationMonths?: number; type?: string; terms?: string; exclusions?: string }>,
};

function addCalendarMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/**
 * Warranty Engine (Phase 12, capability "warranties"). Une Warranty est créée
 * automatiquement par SalesService à la vente si une WarrantyPolicy existe
 * pour le produit vendu (snapshot immuable de la durée/termes, cf modèle).
 * L'expiration n'est jamais écrite en base par un job planifié — calculée à
 * la LECTURE (`expiresAt` comparé à maintenant), cf commentaire du schéma.
 *
 * Visibilité NON filtrée par scope RBAC de localisation pour cette phase
 * (contrairement à Sales/Orders/Purchases/Returns) : Warranty n'a pas de
 * `locationId` propre (une garantie suit le PRODUIT et le CLIENT, pas un
 * emplacement) — étendre `RbacService.getRecordVisibility` à cette
 * ressource nécessiterait une jointure vers Sale non justifiée pour le
 * périmètre minimal de cette phase. Décision assumée, pas un oubli.
 */
@Injectable()
export class WarrantiesService {
  constructor(private readonly db: PrismaTenantService) {}

  private withEffectiveStatus<T extends { status: string; expiresAt: Date }>(w: T, alertDays = 30) {
    const remaining = w.expiresAt.getTime() - Date.now();
    const effectiveStatus = w.status === 'ACTIVE' && remaining < 0 ? 'EXPIRED' : w.status === 'ACTIVE' && remaining <= alertDays * 86400000 ? 'EXPIRING_SOON' : w.status;
    return { ...w, effectiveStatus };
  }

  async getConfiguration(tenantId: string) {
    return this.db.run(tenantId, async (tx) => {
      const row = await tx.warrantyConfiguration.findUnique({ where: { tenantId } });
      return { ...DEFAULT_WARRANTY_CONFIGURATION, ...(row?.config as object ?? {}) };
    });
  }

  async updateConfiguration(tenantId: string, actorUserId: string, dto: UpdateWarrantyConfigurationDto) {
    const current = await this.getConfiguration(tenantId);
    const next = { ...current, ...dto };
    if (!next.allowedDurations.length || next.allowedDurations.some((n: number) => !Number.isInteger(n) || n < 1 || n > 120)) throw new BadRequestException('Les durées autorisées doivent être des mois entiers entre 1 et 120');
    if (!next.allowedDurations.includes(next.defaultDurationMonths)) throw new BadRequestException('La durée par défaut doit appartenir aux durées autorisées');
    if (!next.types.includes(next.defaultType)) throw new BadRequestException('Le type de garantie par défaut doit être sélectionné dans la liste des types');
    if (!next.alertDays.length || next.alertDays.some((n: number) => !Number.isInteger(n) || n < 0 || n > 365)) throw new BadRequestException('Configurez au moins un délai d’alerte valide (0 à 365 jours)');
    try { new Intl.DateTimeFormat('fr-FR', { timeZone: next.timeZone }); } catch { throw new BadRequestException('Le fuseau horaire de garantie est invalide'); }
    return this.db.run(tenantId, (tx) => tx.warrantyConfiguration.upsert({
      where: { tenantId },
      create: { id: newTransactionalId(), tenantId, config: next, updatedByUserId: actorUserId },
      update: { config: next, updatedByUserId: actorUserId },
    }));
  }

  async stats(tenantId: string) {
    const [rows, config] = await Promise.all([
      this.db.run(tenantId, (tx) => tx.warranty.findMany({ where: { tenantId }, select: { id: true, status: true, expiresAt: true } })),
      this.getConfiguration(tenantId),
    ]);
    const effective = rows.map((row) => this.withEffectiveStatus(row, Math.max(...config.alertDays)));
    return {
      total: rows.length,
      active: effective.filter((w) => w.effectiveStatus === 'ACTIVE').length,
      expiringSoon: effective.filter((w) => w.effectiveStatus === 'EXPIRING_SOON').length,
      expired: effective.filter((w) => w.effectiveStatus === 'EXPIRED').length,
      claimed: rows.filter((w) => w.status === 'CLAIMED').length,
      inRepair: rows.filter((w) => w.status === 'IN_REPAIR').length,
      closed: rows.filter((w) => w.status === 'CLOSED').length,
    };
  }

  async list(tenantId: string, query = '') {
    const [warranties, config] = await Promise.all([
      this.db.run(tenantId, (tx) => tx.warranty.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 500 })),
      this.getConfiguration(tenantId),
    ]);
    const q = query.trim().toLocaleLowerCase();
    return warranties
      .map((w) => this.withEffectiveStatus(w, Math.max(...config.alertDays)))
      .filter((w: any) => !q || [w.reference, w.productNameSnapshot, w.customerNameSnapshot, w.customerPhoneSnapshot, w.serialNumber, w.lotNumber].some((s) => String(s ?? '').toLocaleLowerCase().includes(q)));
  }

  async getById(tenantId: string, id: string) {
    const warranty = await this.db.run(tenantId, (tx) => tx.warranty.findFirst({ where: { id, tenantId } }));
    if (!warranty) throw new NotFoundException('Garantie introuvable');
    const config = await this.getConfiguration(tenantId);
    return this.withEffectiveStatus(warranty, Math.max(...config.alertDays));
  }

  async create(tenantId: string, actorUserId: string, dto: CreateWarrantyDto) {
    return this.db.run(tenantId, async (tx) => {
      const configRow = await tx.warrantyConfiguration.findUnique({ where: { tenantId } });
      const config = { ...DEFAULT_WARRANTY_CONFIGURATION, ...(configRow?.config as object ?? {}) };
      const product = await tx.product.findFirst({ where: { id: dto.productId, tenantId, deletedAt: null } });
      if (!product || product.type === 'SERVICE') throw new BadRequestException('Le produit de garantie doit exister dans le catalogue');
      const location = await tx.location.findFirst({ where: { id: dto.locationId, tenantId, deletedAt: null } });
      if (!location || location.type === 'QUARANTINE') throw new BadRequestException('Boutique introuvable ou non commerciale');
      const productPolicy = await tx.warrantyPolicy.findFirst({ where: { tenantId, productId: dto.productId } });
      const categoryPolicy = product.categoryId ? config.categoryPolicies[product.categoryId] : undefined;
      const enforcedDuration = productPolicy?.durationMonths || categoryPolicy?.durationMonths;
      if (enforcedDuration && dto.durationMonths !== enforcedDuration) throw new BadRequestException(`La durée définie pour ce produit/cette catégorie est de ${enforcedDuration} mois`);
      if (!config.allowedDurations.includes(dto.durationMonths) && !enforcedDuration) throw new BadRequestException('Cette durée ne figure pas parmi les durées autorisées');
      const type = dto.warrantyType || productPolicy?.warrantyType || categoryPolicy?.type || config.defaultType;
      if (!config.types.includes(type)) throw new BadRequestException('Le type de garantie n’est pas autorisé par la configuration');
      let customer = dto.customerId ? await tx.customer.findFirst({ where: { id: dto.customerId, tenantId, deletedAt: null } }) : null;
      if (dto.customerId && !customer) throw new BadRequestException('Client introuvable');
      if (!customer && !dto.customerName?.trim()) throw new BadRequestException('Sélectionnez un client ou indiquez son nom');
      if (!customer && dto.customerName?.trim()) customer = await tx.customer.create({ data: { id: newTransactionalId(), tenantId, name: dto.customerName.trim(), phone: dto.customerPhone?.trim() || null } });
      if (dto.saleId && !await tx.sale.findFirst({ where: { id: dto.saleId, tenantId } })) throw new BadRequestException('La vente référencée est introuvable');
      const normalizedSerialNumber = dto.serialNumber?.trim().toLocaleUpperCase('en-US').replace(/\s+/g, '') || null;
      if (normalizedSerialNumber) {
        const existing = await tx.warranty.findFirst({ where: { tenantId, normalizedSerialNumber } });
        if (existing) throw new BadRequestException('Ce numéro de série est déjà rattaché à une garantie dans cette organisation');
        const serial = await tx.serialNumber.findFirst({ where: { tenantId, productId: dto.productId, serial: { equals: normalizedSerialNumber, mode: 'insensitive' } } });
        if (serial && serial.status !== 'SOLD') throw new BadRequestException('Le numéro de série ne correspond pas à une unité vendue de ce produit');
      }
      const startDate = new Date();
      const expiresAt = addCalendarMonths(startDate, dto.durationMonths);
      const id = newTransactionalId();
      const warranty = await tx.warranty.create({ data: {
        id, tenantId, reference: `GAR-${id.replaceAll('-', '').slice(-12).toUpperCase()}`,
        saleId: dto.saleId || null, saleLineId: null, invoiceNumberSnapshot: dto.invoiceNumber?.trim() || null, productId: product.id, productNameSnapshot: product.name,
        locationId: location.id, customerId: customer?.id || null,
        customerNameSnapshot: customer?.name || dto.customerName?.trim() || null,
        customerPhoneSnapshot: customer?.phone || dto.customerPhone?.trim() || null,
        durationDaysSnapshot: Math.ceil((expiresAt.getTime() - startDate.getTime()) / 86400000), durationMonthsSnapshot: dto.durationMonths,
        termsSnapshot: dto.terms?.trim() || productPolicy?.terms || categoryPolicy?.terms || config.terms,
        exclusionsSnapshot: productPolicy?.exclusions || categoryPolicy?.exclusions || config.exclusions,
        warrantyTypeSnapshot: type, serialNumber: dto.serialNumber?.trim() || null, normalizedSerialNumber,
        lotNumber: dto.lotNumber?.trim() || null, identifiers: (dto.identifiers ?? []) as any,
        notes: dto.notes?.trim() || null, createdByUserId: actorUserId, startDate, expiresAt, status: 'ACTIVE',
      } });
      await tx.outboxEvent.create({ data: { id: newTransactionalId(), tenantId, eventType: 'warranties.warranty.created', payload: { actorUserId, entityType: 'Warranty', entityId: id, reference: warranty.reference } } });
      return this.withEffectiveStatus(warranty, Math.max(...config.alertDays));
    });
  }

  async claim(tenantId: string, actorUserId: string, id: string, dto: ClaimWarrantyDto) {
    return this.db.run(tenantId, async (tx) => {
      const warranty = await tx.warranty.findFirst({ where: { id, tenantId } });
      if (!warranty) throw new NotFoundException('Garantie introuvable');
      if (warranty.status === 'CLAIMED') {
        throw new BadRequestException('Cette garantie a déjà fait l\'objet d\'une réclamation');
      }
      if (warranty.status === 'VOID') {
        throw new BadRequestException('Cette garantie a été annulée');
      }
      if (warranty.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException(`Garantie expirée depuis le ${warranty.expiresAt.toLocaleDateString('fr-FR')}`);
      }

      const updated = await tx.warranty.update({
        where: { id },
        data: { status: 'CLAIMED', claimedAt: new Date(), claimNotes: dto.notes },
      });

      await tx.outboxEvent.create({
        data: {
          id: newTransactionalId(),
          tenantId,
          eventType: 'warranties.warranty.claimed',
          payload: { actorUserId, entityType: 'Warranty', entityId: id, saleId: warranty.saleId, notes: dto.notes ?? null },
        },
      });

      return this.withEffectiveStatus(updated);
    });
  }

  async setClaimStatus(tenantId: string, actorUserId: string, id: string, status: 'IN_REPAIR' | 'CLOSED', dto: ClaimWarrantyDto) {
    return this.db.run(tenantId, async (tx) => {
      const warranty = await tx.warranty.findFirst({ where: { id, tenantId } });
      if (!warranty) throw new NotFoundException('Garantie introuvable');
      if (!['CLAIMED', 'IN_REPAIR'].includes(warranty.status)) throw new BadRequestException('Le statut nécessite une réclamation active');
      const updated = await tx.warranty.update({ where: { id }, data: { status, claimNotes: dto.notes ?? warranty.claimNotes } });
      await tx.outboxEvent.create({ data: { id: newTransactionalId(), tenantId, eventType: `warranties.warranty.${status.toLowerCase()}`, payload: { actorUserId, entityType: 'Warranty', entityId: id, notes: dto.notes ?? null } } });
      return this.withEffectiveStatus(updated);
    });
  }
}

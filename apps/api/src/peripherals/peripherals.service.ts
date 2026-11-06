import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';

export interface PrinterProfileInput {
  name: string; type: 'OFFICE_PRINTER' | 'THERMAL_PRINTER' | 'BARCODE_SCANNER'; brand?: string; model?: string;
  connectionMode: 'USB' | 'NETWORK' | 'WIFI' | 'BLUETOOTH' | 'SYSTEM_BROWSER' | 'LOCAL_AGENT' | 'CAMERA';
  terminalId: string; paperFormat: string; locationId?: string; cashRegisterId?: string; config?: Record<string, unknown>;
}

@Injectable()
export class PeripheralsService {
  constructor(private readonly db: PrismaTenantService) {}
  list(tenantId: string, terminalId?: string) {
    return this.db.run(tenantId, (tx) => tx.printerProfile.findMany({ where: { tenantId, ...(terminalId ? { terminalId } : {}) }, orderBy: [{ terminalId: 'asc' }, { name: 'asc' }] }));
  }
  private async validateAssociations(tenantId: string, input: PrinterProfileInput) {
    await this.db.run(tenantId, async (tx) => {
      if (input.locationId && !await tx.location.findFirst({ where: { tenantId, id: input.locationId, deletedAt: null }, select: { id: true } })) throw new BadRequestException('Boutique ou dépôt introuvable dans cette organisation.');
      if (input.cashRegisterId && !await tx.cashSession.findFirst({ where: { tenantId, id: input.cashRegisterId }, select: { id: true } })) throw new BadRequestException('Caisse introuvable dans cette organisation.');
    });
  }
  async create(tenantId: string, input: PrinterProfileInput) {
    if (input.type === 'THERMAL_PRINTER' && !['58mm', '80mm', 'CUSTOM'].includes(input.paperFormat)) throw new BadRequestException('Choisissez 58mm, 80mm ou un format personnalisé pour le ticket.');
    await this.validateAssociations(tenantId, input);
    return this.db.run(tenantId, (tx) => tx.printerProfile.create({ data: {
      id: newId(), tenantId, name: input.name.trim(), type: input.type, brand: input.brand?.trim() || null, model: input.model?.trim() || null,
      connectionMode: input.connectionMode, terminalId: input.terminalId.trim(), paperFormat: input.paperFormat,
      locationId: input.locationId || null, cashRegisterId: input.cashRegisterId || null, config: (input.config ?? {}) as Prisma.InputJsonValue,
    } }));
  }
  async update(tenantId: string, id: string, input: PrinterProfileInput) {
    await this.validateAssociations(tenantId, input);
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.printerProfile.findFirst({ where: { tenantId, id } });
      if (!existing) throw new NotFoundException('Périphérique introuvable.');
      return tx.printerProfile.update({ where: { id }, data: {
        name: input.name.trim(), type: input.type, brand: input.brand?.trim() || null, model: input.model?.trim() || null,
        connectionMode: input.connectionMode, terminalId: input.terminalId.trim(), paperFormat: input.paperFormat,
        locationId: input.locationId || null, cashRegisterId: input.cashRegisterId || null, config: (input.config ?? {}) as Prisma.InputJsonValue,
      } });
    });
  }
  async remove(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.printerProfile.findFirst({ where: { tenantId, id } });
      if (!existing) throw new NotFoundException('Périphérique introuvable.');
      return tx.printerProfile.delete({ where: { id } });
    });
  }
}

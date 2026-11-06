import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  QueryAppointmentsDto,
} from './dto/appointment.dto.js';

@Injectable()
export class AppointmentsService {
  constructor(private readonly db: PrismaTenantService) {}

  async list(tenantId: string, query?: QueryAppointmentsDto) {
    return this.db.run(tenantId, async (tx) => {
      const where: Prisma.AppointmentWhereInput = { tenantId };

      if (query?.locationId) {
        where.locationId = query.locationId;
      }
      if (query?.customerId) {
        where.customerId = query.customerId;
      }
      if (query?.status) {
        where.status = query.status;
      }
      if (query?.startDate || query?.endDate) {
        where.scheduledAt = {};
        if (query.startDate) {
          where.scheduledAt.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          where.scheduledAt.lte = new Date(query.endDate);
        }
      }

      return tx.appointment.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
      });
    });
  }

  async getById(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const apt = await tx.appointment.findFirst({
        where: { id, tenantId },
      });
      if (!apt) {
        throw new NotFoundException('Rendez-vous / réservation introuvable');
      }
      return apt;
    });
  }

  async create(tenantId: string, dto: CreateAppointmentDto) {
    return this.db.run(tenantId, async (tx) => {
      // Vérification du client si spécifié
      let resolvedCustomerName = dto.customerName;
      let resolvedPhone = dto.customerPhone;
      let resolvedEmail = dto.customerEmail;

      if (dto.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, tenantId, deletedAt: null },
        });
        if (!customer) {
          throw new BadRequestException('Client spécifié introuvable');
        }
        if (!resolvedCustomerName) resolvedCustomerName = customer.name;
        if (!resolvedPhone) resolvedPhone = customer.phone ?? undefined;
        if (!resolvedEmail) resolvedEmail = customer.email ?? undefined;
      }

      const id = newId();
      const scheduledAt = new Date(dto.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        throw new BadRequestException('Date/heure de rendez-vous invalide');
      }

      const appointment = await tx.appointment.create({
        data: {
          id,
          tenantId,
          locationId: dto.locationId,
          customerId: dto.customerId,
          assignedUserId: dto.assignedUserId,
          title: dto.title.trim(),
          description: dto.description?.trim(),
          scheduledAt,
          durationMinutes: dto.durationMinutes ?? 30,
          status: 'CONFIRMED',
          customerName: resolvedCustomerName,
          customerPhone: resolvedPhone,
          customerEmail: resolvedEmail,
          serviceName: dto.serviceName?.trim(),
          notes: dto.notes?.trim(),
        },
      });

      return appointment;
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAppointmentDto) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.appointment.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException('Rendez-vous / réservation introuvable');
      }

      const data: Prisma.AppointmentUpdateInput = {};

      if (dto.title !== undefined) data.title = dto.title.trim();
      if (dto.description !== undefined) data.description = dto.description?.trim();
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;
      if (dto.locationId !== undefined) data.locationId = dto.locationId;
      if (dto.customerId !== undefined) data.customerId = dto.customerId;
      if (dto.assignedUserId !== undefined) data.assignedUserId = dto.assignedUserId;
      if (dto.customerName !== undefined) data.customerName = dto.customerName;
      if (dto.customerPhone !== undefined) data.customerPhone = dto.customerPhone;
      if (dto.customerEmail !== undefined) data.customerEmail = dto.customerEmail;
      if (dto.serviceName !== undefined) data.serviceName = dto.serviceName?.trim();
      if (dto.notes !== undefined) data.notes = dto.notes?.trim();

      if (dto.scheduledAt !== undefined) {
        const scheduledAt = new Date(dto.scheduledAt);
        if (isNaN(scheduledAt.getTime())) {
          throw new BadRequestException('Date/heure de rendez-vous invalide');
        }
        data.scheduledAt = scheduledAt;
      }

      return tx.appointment.update({
        where: { id },
        data,
      });
    });
  }

  async delete(tenantId: string, id: string) {
    return this.db.run(tenantId, async (tx) => {
      const existing = await tx.appointment.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException('Rendez-vous / réservation introuvable');
      }

      await tx.appointment.delete({
        where: { id },
      });

      return { success: true, message: 'Rendez-vous annulé et supprimé' };
    });
  }
}

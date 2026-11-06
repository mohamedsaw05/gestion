import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@gestionnaire/db';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { CommercialSettingsService } from '../platform/commercial-settings.service.js';

@Injectable()
export class SupportService {
  constructor(private readonly db: PrismaTenantService, private readonly platform: PlatformPrismaService, private readonly commercial: CommercialSettingsService) {}

  async create(tenantId: string, userId: string, subject: string, message: string) {
    if (subject.trim().length < 4 || subject.length > 180 || message.trim().length < 10 || message.length > 10000) {
      throw new BadRequestException('Le sujet doit contenir 4 à 180 caractères et le message 10 à 10 000 caractères.');
    }
    const createdAt = new Date();
    return this.db.run(tenantId, (tx) => tx.supportTicket.create({ data: { id: newId(), tenantId, userId, subject: subject.trim(), message: message.trim(), status: 'OPEN', createdAt } }));
  }

  async listMine(tenantId: string, userId: string) {
    return this.db.run(tenantId, (tx) => tx.supportTicket.findMany({ where: { tenantId, userId }, orderBy: { createdAt: 'desc' } }));
  }

  async getAvailability() {
    const { support } = await this.commercial.getPublicSettings();
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: support.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const current = Number(values.hour) * 60 + Number(values.minute);
    const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const available = current >= toMinutes(support.opensAt) && current < toMinutes(support.closesAt);
    return { ...support, isAvailable: available, message: available ? 'L’assistance est ouverte. Vous pouvez soumettre une demande.' : 'L’assistance est fermée pour le moment. Votre demande sera conservée et traitée pendant les horaires d’ouverture.' };
  }

  listAll() {
    return this.platform.client.supportTicket.findMany({ orderBy: { createdAt: 'asc' }, take: 500 });
  }

  async respond(id: string, response: string, actorEmail: string) {
    if (response.trim().length < 2 || response.length > 10000) throw new BadRequestException('La réponse doit contenir 2 à 10 000 caractères.');
    const current = await this.platform.client.supportTicket.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Demande d’assistance introuvable.');
    return this.platform.client.supportTicket.update({ where: { id }, data: { supportResponse: response.trim(), respondedBy: actorEmail, respondedAt: new Date(), status: 'ANSWERED' } });
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { COMMERCIAL_SUBSCRIPTION_MONTHS, DEFAULT_COMMERCIAL_MONTHLY_PRICE, newId } from '@gestionnaire/db';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';

const TARIFF_KEY = 'commercial.subscription-tariff';
const SUPPORT_KEY = 'commercial.support-hours';
const TERMS = COMMERCIAL_SUBSCRIPTION_MONTHS;

export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

@Injectable()
export class CommercialSettingsService {
  constructor(private readonly platform: PlatformPrismaService) {}

  private async readConfig<T>(key: string, fallback: T): Promise<T> {
    const row = await this.platform.client.platformConfig.findUnique({ where: { key } });
    return row ? row.value as T : fallback;
  }

  async getPublicSettings() {
    const [monthlyPrice, support] = await Promise.all([
      this.readConfig<number>(TARIFF_KEY, DEFAULT_COMMERCIAL_MONTHLY_PRICE),
      this.readConfig(SUPPORT_KEY, { days: [0, 1, 2, 3, 4, 5, 6], opensAt: '09:00', closesAt: '21:00', timeZone: 'Africa/Ouagadougou' }),
    ]);
    return {
      currency: 'XOF',
      monthlyReferencePrice: monthlyPrice,
      plans: TERMS.map((months) => ({ months, label: months === 3 ? 'Trimestriel' : months === 6 ? 'Semestriel' : months === 12 ? 'Annuel' : 'Biennal', totalPrice: monthlyPrice * months })),
      trialDays: 14,
      support,
    };
  }

  async getAdminSettings() {
    const [publicSettings, history] = await Promise.all([
      this.getPublicSettings(),
      this.platform.client.platformTariffHistory.findMany({ orderBy: { changedAt: 'desc' }, take: 250 }),
    ]);
    return { ...publicSettings, history };
  }

  async updateMonthlyPrice(monthlyPrice: number, actor: { id: string; email: string }, reason?: string) {
    if (!Number.isSafeInteger(monthlyPrice) || monthlyPrice <= 0) {
      throw new BadRequestException('Le tarif de référence doit être un nombre entier positif en FCFA.');
    }
    const now = new Date();
    await this.platform.client.$transaction(async (db) => {
      const currentRow = await db.platformConfig.findUnique({ where: { key: TARIFF_KEY } });
      const previousMonthlyPrice = currentRow ? Number(currentRow.value) : DEFAULT_COMMERCIAL_MONTHLY_PRICE;
      if (previousMonthlyPrice === monthlyPrice) return;
      await db.platformTariffHistory.create({ data: {
        id: newId(), previousMonthlyPrice, monthlyPrice, actorId: actor.id, actorEmail: actor.email,
        changedAt: now, effectiveAt: now, reason: reason?.trim() || null,
      } });
      await db.platformConfig.upsert({ where: { key: TARIFF_KEY }, create: { id: newId(), key: TARIFF_KEY, value: monthlyPrice }, update: { value: monthlyPrice } });
    });
    return this.getAdminSettings();
  }

  async updateSupportHours(input: { opensAt: string; closesAt: string; timeZone: string }, actor: { id: string; email: string }) {
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(input.opensAt) || !timePattern.test(input.closesAt) || !input.timeZone.trim()) {
      throw new BadRequestException('Horaires ou fuseau horaire invalides.');
    }
    try { new Intl.DateTimeFormat('fr-FR', { timeZone: input.timeZone }); } catch { throw new BadRequestException('Fuseau horaire non reconnu.'); }
    const value = { days: [0, 1, 2, 3, 4, 5, 6], opensAt: input.opensAt, closesAt: input.closesAt, timeZone: input.timeZone, updatedAt: new Date().toISOString(), updatedBy: actor.email };
    await this.platform.client.platformConfig.upsert({ where: { key: SUPPORT_KEY }, create: { id: newId(), key: SUPPORT_KEY, value }, update: { value } });
    return this.getAdminSettings();
  }

  async createCommercialInvoice(tenantId: string, months: number, requestedStart?: Date) {
    if (!(TERMS as readonly number[]).includes(months)) throw new BadRequestException('Les durées commercialisées sont 3, 6, 12 ou 24 mois.');
    const tariff = await this.readConfig<number>(TARIFF_KEY, DEFAULT_COMMERCIAL_MONTHLY_PRICE);
    const subscription = await this.platform.client.platformSubscription.findUnique({ where: { tenantId } });
    const now = new Date();
    const start = requestedStart ?? (subscription?.currentPeriodEnd && subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now);
    const periodEnd = addCalendarMonths(start, months);
    const invoiceNumber = `SAAS-${now.getUTCFullYear()}-${newId().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    return this.platform.client.platformInvoice.create({
      data: {
        id: newId(), tenantId, subscriptionId: subscription?.id, invoiceNumber,
        amount: tariff * months, currency: 'XOF', status: 'PENDING', paymentMethod: 'MANUAL_TRANSFER',
        periodStart: start, periodEnd,
        notes: `Abonnement ${months} mois — tarif mensuel de référence ${tariff} XOF au ${now.toISOString()}`,
      },
    });
  }
}


import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { newId } from '@gestionnaire/db';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';

export interface WheelOffer {
  id: string;
  label: string;
  sub: string;
  color: string;
  textColor: string;
  isWinning: boolean;
  weight: number;
  maxQuota: number; // Plafond strict (ex: 5 personnes max pour 1 mois gratuit)
  awardedCount: number; // Nombre de gagnants ayant déjà remporté ce lot
  enabled: boolean;
  rewardType: 'FREE_MONTH' | 'DISCOUNT' | 'SERVICE' | 'VOUCHER' | 'DELIVERY' | 'VIP' | 'NONE';
}

export interface WheelWinnerClaim {
  id: string;
  date: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  offerId: string;
  offerLabel: string;
  rewardType: string;
  appliedToSubscription: boolean;
  notes?: string;
}

export interface WheelAdminConfig {
  eventKey: string;
  eventTitle: string;
  enabled: boolean;
  startsAt?: string;
  endsAt?: string;
  timeZone?: string;
  maxSpinsPerUser: number;
  offers: WheelOffer[];
  claims: WheelWinnerClaim[];
  userSpins: Record<string, number>; // key: `${eventKey}_${userEmail}` -> count
}

const DEFAULT_OFFERS: WheelOffer[] = [
  {
    id: 'seg-1',
    label: '50% Réduction',
    sub: 'Sur le prochain abonnement',
    color: '#dc2626',
    textColor: '#ffffff',
    isWinning: true,
    weight: 20,
    maxQuota: 10,
    awardedCount: 0,
    enabled: true,
    rewardType: 'DISCOUNT',
  },
  {
    id: 'seg-2',
    label: '1 Mois Gratuit',
    sub: 'Mois offert sur tout le gestionnaire',
    color: '#15803d',
    textColor: '#ffffff',
    isWinning: true,
    weight: 15,
    maxQuota: 5, // Strictement 5 personnes max
    awardedCount: 0,
    enabled: true,
    rewardType: 'FREE_MONTH',
  },
  {
    id: 'seg-3',
    label: '0 (Perdu)',
    sub: 'Retentez votre chance à la prochaine fête',
    color: '#475569',
    textColor: '#ffffff',
    isWinning: false,
    weight: 25,
    maxQuota: 999999,
    awardedCount: 0,
    enabled: true,
    rewardType: 'NONE',
  },
  {
    id: 'seg-4',
    label: '-20% Services',
    sub: 'Valable sur toutes les réparations',
    color: '#2563eb',
    textColor: '#ffffff',
    isWinning: true,
    weight: 20,
    maxQuota: 20,
    awardedCount: 0,
    enabled: true,
    rewardType: 'SERVICE',
  },
  {
    id: 'seg-5',
    label: '10 000 FCFA',
    sub: 'Bon d’achat déduit au comptoir',
    color: '#d97706',
    textColor: '#ffffff',
    isWinning: true,
    weight: 10,
    maxQuota: 5,
    awardedCount: 0,
    enabled: true,
    rewardType: 'VOUCHER',
  },
  {
    id: 'seg-6',
    label: 'Livraison Offerte',
    sub: 'Sur vos 5 prochaines commandes',
    color: '#7c3aed',
    textColor: '#ffffff',
    isWinning: true,
    weight: 15,
    maxQuota: 15,
    awardedCount: 0,
    enabled: true,
    rewardType: 'DELIVERY',
  },
  {
    id: 'seg-7',
    label: 'Surprise VIP VTM',
    sub: 'Accès exclusif aux fonctions d’IA',
    color: '#db2777',
    textColor: '#ffffff',
    isWinning: true,
    weight: 10,
    maxQuota: 10,
    awardedCount: 0,
    enabled: true,
    rewardType: 'VIP',
  },
];

@Injectable()
export class PlatformFestiveWheelService implements OnModuleInit {
  private readonly logger = new Logger(PlatformFestiveWheelService.name);
  private config: WheelAdminConfig;

  constructor(private readonly platform: PlatformPrismaService) {
    this.config = this.defaultConfig();
  }

  private async refreshConfig() {
    const rows = await this.platform.client.$queryRaw<{ value: unknown }[]>`SELECT "value" FROM "PlatformConfig" WHERE "key" = 'festive-wheel' LIMIT 1`;
    const savedValue = rows[0]?.value;
    if (savedValue && typeof savedValue === 'object' && !Array.isArray(savedValue)) {
      this.config = { ...this.defaultConfig(), ...(savedValue as Partial<WheelAdminConfig>) };
      return true;
    }
    return false;
  }

  async onModuleInit() {
    try {
      if (await this.refreshConfig()) return;
      await this.saveConfigInternal(this.config);
    } catch (error) {
      // Une panne temporaire de la base ne doit pas empêcher Nest de démarrer
      // et de servir sa sonde de santé. Les routes de la roue reliront la base
      // lorsqu'elle sera disponible ; la configuration par défaut reste en mémoire.
      this.logger.warn(`Configuration de la roue festive indisponible au démarrage : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
    }
  }

  private defaultConfig(): WheelAdminConfig {
    return {
      eventKey: 'NOEL_2026',
      eventTitle: 'Noël 2026 & Féerie Festive',
      enabled: false,
      startsAt: '',
      endsAt: '',
      timeZone: 'Africa/Ouagadougou',
      maxSpinsPerUser: 1, // Déterminé par l'Admin
      offers: DEFAULT_OFFERS,
      claims: [],
      userSpins: {},
    };
  }

  private async saveConfigInternal(cfg: WheelAdminConfig) {
    await this.platform.client.$executeRaw`
      INSERT INTO "PlatformConfig" ("id", "key", "value", "createdAt", "updatedAt")
      VALUES (${newId()}::uuid, 'festive-wheel', ${JSON.stringify(cfg)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP
    `;
  }

  private isEventActive(now = new Date()): boolean {
    if (!this.config.enabled || !this.config.startsAt || !this.config.endsAt) return false;
    const start = new Date(this.config.startsAt);
    const end = new Date(this.config.endsAt);
    return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start <= now && now <= end;
  }

  // ── SUPERADMIN (Console Éditeur) ──
  async getAdminConfig(): Promise<WheelAdminConfig> {
    await this.refreshConfig();
    return this.config;
  }

  async updateAdminConfig(partial: Partial<WheelAdminConfig>): Promise<WheelAdminConfig> {
    await this.refreshConfig();
    if (partial.enabled === true) {
      const start = new Date(partial.startsAt ?? this.config.startsAt ?? '');
      const end = new Date(partial.endsAt ?? this.config.endsAt ?? '');
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
        throw new BadRequestException('Configurez une période valide avec une date de début antérieure à la date de fin avant d’activer l’événement.');
      }
    }
    this.config = {
      ...this.config,
      ...partial,
      offers: partial.offers ?? this.config.offers,
    };
    await this.saveConfigInternal(this.config);
    return this.config;
  }

  async getClaims(): Promise<WheelWinnerClaim[]> {
    await this.refreshConfig();
    return this.config.claims;
  }

  async resetUserSpins(): Promise<{ success: boolean; message: string }> {
    this.config.userSpins = {};
    await this.saveConfigInternal(this.config);
    return { success: true, message: 'Tous les tours utilisateurs ont été réinitialisés.' };
  }

  // ── TENANT CLIENT (Gestionnaire Produit) ──
  // Le client ne connaît jamais les quotas secrets ni les poids de tirage
  async getPublicStatus(tenantId: string, userId: string) {
    await this.refreshConfig();
    if (!this.isEventActive()) {
      return { eventKey: this.config.eventKey, eventTitle: this.config.eventTitle, eventEnabled: false, maxSpinsPerUser: 0, userSpins: 0, remainingSpins: 0, alreadyPlayed: true, offers: [], existingPrize: null };
    }
    let userEmail = userId;
    try {
      const user = await this.platform.client.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) userEmail = user.email;
    } catch {
      // fallback
    }

    const key = `${this.config.eventKey}_${userEmail.toLowerCase().trim()}`;
    const userSpins = this.config.userSpins[key] ?? 0;
    const remainingSpins = Math.max(0, this.config.maxSpinsPerUser - userSpins);

    // Ne renvoie que les données visuelles indispensables, sans dévoiler quotas ni probabilités
    const publicOffers = this.config.offers.map((o) => ({
      id: o.id,
      label: o.label,
      sub: o.sub,
      color: o.color,
      textColor: o.textColor,
      isWinning: o.isWinning,
    }));

    // Vérifier si l'utilisateur a déjà un gain enregistré
    const existingClaim = this.config.claims.find(
      (c) => c.tenantId === tenantId && c.userEmail.toLowerCase() === userEmail.toLowerCase(),
    );

    return {
      eventKey: this.config.eventKey,
      eventTitle: this.config.eventTitle,
      eventEnabled: true,
      maxSpinsPerUser: this.config.maxSpinsPerUser,
      userSpins,
      remainingSpins,
      alreadyPlayed: remainingSpins <= 0,
      offers: publicOffers,
      existingPrize: existingClaim
        ? {
            label: existingClaim.offerLabel,
            date: existingClaim.date,
            applied: existingClaim.appliedToSubscription,
          }
        : null,
    };
  }

  async spinWheel(tenantId: string, userId: string) {
    await this.refreshConfig();
    if (!this.isEventActive()) {
      throw new BadRequestException('Aucun événement festif n’est actuellement activé par l’administration.');
    }
    let userEmail = userId;
    try {
      const user = await this.platform.client.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) userEmail = user.email;
    } catch {
      // fallback
    }

    const key = `${this.config.eventKey}_${userEmail.toLowerCase().trim()}`;
    const userSpins = this.config.userSpins[key] ?? 0;
    if (userSpins >= this.config.maxSpinsPerUser) {
      throw new BadRequestException('Vous avez déjà utilisé vos tours autorisés pour cette fête annuelle.');
    }

    // Récupérer le nom du tenant
    const tenant = await this.platform.client.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const tenantName = tenant?.name ?? 'Organisation';

    // Algorithme secret d'attribution avec règle d'équité discrète ("Nul n'est informé") :
    // Si un lot a atteint son quota max strict (ex: 5 personnes max pour 1 mois gratuit),
    // son poids effectif est fixé à 0 sur le serveur.
    const eligibleOffers = this.config.offers.map((o) => {
      const isCapped = o.isWinning && o.awardedCount >= o.maxQuota;
      return {
        ...o,
        effectiveWeight: isCapped || !o.enabled ? 0 : o.weight,
      };
    });

    const totalWeight = eligibleOffers.reduce((sum, o) => sum + o.effectiveWeight, 0);
    let chosenOffer = eligibleOffers[0];

    if (totalWeight > 0) {
      let rand = Math.random() * totalWeight;
      for (const o of eligibleOffers) {
        if (rand < o.effectiveWeight) {
          chosenOffer = o;
          break;
        }
        rand -= o.effectiveWeight;
      }
    } else {
      // Si tous les quotas sont atteints, fallback vers le lot neutre "0 (Perdu)"
      chosenOffer =
        eligibleOffers.find((o) => !o.isWinning) ?? eligibleOffers[eligibleOffers.length - 1];
    }

    // Incrémenter le compteur de gains
    const originalOffer = this.config.offers.find((o) => o.id === chosenOffer.id);
    if (originalOffer && originalOffer.isWinning) {
      originalOffer.awardedCount += 1;
    }
    this.config.userSpins[key] = userSpins + 1;

    let appliedToSubscription = false;
    let applicationMessage = 'Félicitations pour votre participation festive !';

    // ── APPLICATION AUTOMATIQUE DES GAINS SANS CODE COUPON ──
    if (chosenOffer.isWinning) {
      if (chosenOffer.rewardType === 'FREE_MONTH' || chosenOffer.label.toLowerCase().includes('1 mois gratuit')) {
        // Prolongation automatique de 30 jours de l'abonnement
        try {
          const sub = await this.platform.client.platformSubscription.findUnique({
            where: { tenantId },
            include: { plan: true },
          });

          const now = new Date();
          let baseDate = now;
          if (sub && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now) {
            baseDate = new Date(sub.currentPeriodEnd);
          }
          const extendedDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

          if (sub) {
            await this.platform.client.platformSubscription.update({
              where: { tenantId },
              data: {
                status: 'ACTIVE',
                currentPeriodEnd: extendedDate,
                suspendedAt: null,
                cancelledAt: null,
              },
            });

            // Enregistrer une facture d'avoir/cadeau à 0 XOF pour traçabilité comptable
            await this.platform.client.platformInvoice.create({
              data: {
                id: newId(),
                tenantId,
                subscriptionId: sub.id,
                invoiceNumber: `CADEAU-NOEL-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
                amount: 0,
                currency: sub.plan?.currency ?? 'XOF',
                status: 'PAID',
                paymentMethod: 'OFFRE_FESTIVE_AUTO',
                paymentReference: '1_MOIS_OFFERT_ROUE',
                periodStart: baseDate,
                periodEnd: extendedDate,
                notes: '🎰 Gain Festif de Noël : 1 Mois d’abonnement offert appliqué automatiquement au compte.',
              },
            });
            appliedToSubscription = true;
            applicationMessage =
              '🎉 Félicitations ! Votre gain « 1 Mois d’Abonnement Gratuit » a été appliqué automatiquement à votre compte (+30 jours offerts).';
          }
        } catch {
          // Si pas d'abonnement rattaché, le claim est quand même enregistré pour régularisation
        }
      } else {
        appliedToSubscription = true;
        applicationMessage = `🎉 Félicitations ! Votre privilège « ${chosenOffer.label} » a été activé automatiquement sur votre espace client.`;
      }
    }

    // Enregistrer le gain dans l'historique centralisé Admin
    const nowStr = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const claim: WheelWinnerClaim = {
      id: newId(),
      date: nowStr,
      tenantId,
      tenantName,
      userEmail,
      offerId: chosenOffer.id,
      offerLabel: chosenOffer.label,
      rewardType: chosenOffer.rewardType,
      appliedToSubscription,
      notes: chosenOffer.isWinning ? applicationMessage : 'Non gagnant',
    };

    this.config.claims.unshift(claim);
    await this.saveConfigInternal(this.config);

    return {
      segmentId: chosenOffer.id,
      label: chosenOffer.label,
      sub: chosenOffer.sub,
      isWinning: chosenOffer.isWinning,
      appliedToSubscription,
      message: applicationMessage,
      remainingSpins: Math.max(0, this.config.maxSpinsPerUser - this.config.userSpins[key]),
    };
  }
}

import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SETTINGS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { UsersService } from '../users/users.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';
import { ConfigurationService } from '../config/config.service.js';
import { ChangePasswordDto } from '../users/dto/change-password.dto.js';

@Controller('me')
export class MeController {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly rbac: RbacService,
    private readonly users: UsersService,
    private readonly businessProfile: BusinessProfileService,
    private readonly config: ConfigurationService,
  ) {}

  @Get('onboarding-status')
  async onboardingStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.db.run(user.tenantId, async (tx) => {
      const [userRecord, productsCount, locationsCount, customersCount, salesCount, profile, dismissedSetting] =
        await Promise.all([
          tx.user.findUnique({ where: { id: user.userId }, select: { createdAt: true } }),
          tx.product.count({ where: { tenantId: user.tenantId, deletedAt: null } }),
          tx.location.count({ where: { tenantId: user.tenantId, deletedAt: null } }),
          tx.customer.count({ where: { tenantId: user.tenantId, deletedAt: null } }),
          tx.sale.count({ where: { tenantId: user.tenantId, deletedAt: null } }),
          this.businessProfile.getProfile(user.tenantId),
          this.config.getWithTx<boolean>(tx, user.tenantId, SETTINGS.ONBOARDING_DISMISSED),
        ]);

      const isNewOrganization = salesCount === 0 && productsCount === 0;
      const isNewUser = userRecord
        ? Date.now() - userRecord.createdAt.getTime() < 7 * 24 * 3600 * 1000
        : false;

      const steps = [
        {
          id: 'identity',
          title: "Identité de l'entreprise & Logo",
          description: 'Nom commercial, coordonnées, logo officiel et pied de page',
          done: Boolean(profile?.onboardedAt),
          path: '/settings',
        },
        {
          id: 'locations',
          title: 'Points de vente & Dépôts',
          description: 'Configurer les magasins physiques et entrepôts de stockage',
          done: locationsCount > 0,
          path: '/locations',
        },
        {
          id: 'catalog',
          title: 'Catalogue produits / Prestations',
          description: 'Créer les articles avec codes-barres, unités et prix',
          done: productsCount > 0,
          path: '/products',
        },
        {
          id: 'customers',
          title: 'Clients & Crédits',
          description: 'Enregistrer vos premiers clients et fixer les limites de crédit',
          done: customersCount > 0,
          path: '/customers',
        },
        {
          id: 'firstSale',
          title: 'Première vente & Facture',
          description: 'Encaisser une opération et générer un reçu/facture',
          done: salesCount > 0,
          path: '/sales/new',
        },
      ];

      const completedCount = steps.filter((s) => s.done).length;
      const progressPercent = Math.round((completedCount / steps.length) * 100);

      return {
        isNewOrganization,
        isNewUser,
        dismissed: Boolean(dismissedSetting),
        completedCount,
        totalSteps: steps.length,
        progressPercent,
        steps,
      };
    });
  }

  @Patch('onboarding-dismiss')
  async dismissOnboarding(@CurrentUser() user: AuthenticatedUser) {
    await this.config.set(user.tenantId, SETTINGS.ONBOARDING_DISMISSED, true);
    return { success: true };
  }


  /**
   * `enabledCapabilities` complète le menu (résolu à la granularité de la
   * page) pour les cas où une capability doit être vérifiée à l'intérieur
   * MÊME d'une page déjà visible (ex: afficher l'onglet "Variantes" dans le
   * catalogue) — même principe que le menu : résolu côté serveur une seule
   * fois, jamais une seconde logique de capability recopiée côté client.
   */
  @Get()
  async profile(@CurrentUser() user: AuthenticatedUser) {
    const [record, tenant, legalNameSetting, logoSetting, resolvedCapabilities, resolvedModules] = await Promise.all([
      this.db.run(user.tenantId, (tx) =>
        tx.user.findFirst({
          where: { id: user.userId, tenantId: user.tenantId },
          select: { id: true, email: true, fullName: true, tenantId: true },
        }),
      ),
      this.db.run(user.tenantId, (tx) =>
        tx.tenant.findUnique({
          where: { id: user.tenantId },
          select: { name: true },
        }),
      ),
      this.config.get<string>(user.tenantId, SETTINGS.ORGANIZATION_LEGAL_NAME),
      this.config.get<string>(user.tenantId, SETTINGS.ORGANIZATION_LOGO),
      this.businessProfile.getResolvedCapabilities(user.tenantId),
      this.businessProfile.getResolvedModules(user.tenantId),
    ]);
    const enabledCapabilities = Object.entries(resolvedCapabilities)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
    const enabledModules = resolvedModules
      .filter((m) => m.enabled)
      .map((m) => m.key);
    
    const organizationName = legalNameSetting && String(legalNameSetting).trim()
      ? String(legalNameSetting).trim()
      : (tenant?.name || "Informations de l'entreprise à compléter");
    const logoUrl = logoSetting && typeof logoSetting === 'string' && (
      logoSetting.startsWith('data:image/') ||
      logoSetting.startsWith('http://') ||
      logoSetting.startsWith('https://') ||
      logoSetting.startsWith('/uploads/') ||
      logoSetting.startsWith('/')
    )
      ? logoSetting
      : null;

    return {
      ...record,
      organizationName,
      logoUrl,
      enabledCapabilities,
      enabledModules,
    };
  }

  /**
   * Vue résolue consommée directement par le frontend pour construire le menu
   * — cf docs/architecture/04-architecture-web.md §5 : le frontend n'a jamais
   * à connaître la logique de permission, seulement son résultat.
   */
  @Get('menu')
  async menu(@CurrentUser() user: AuthenticatedUser) {
    return this.rbac.getVisibleMenu(user.tenantId, user.userId);
  }

  @Get('permissions')
  async permissions(@CurrentUser() user: AuthenticatedUser) {
    return this.rbac.getEffectiveGrants(user.tenantId, user.userId);
  }

  /**
   * Changement de mot de passe personnel — AUCUNE permission requise au-delà
   * d'être authentifié (distinct de la réinitialisation admin via
   * UsersController, qui exige USERS_MANAGE et ne s'applique jamais à
   * soi-même de cette façon).
   */
  @Patch('password')
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.users.changeOwnPassword(user.tenantId, user.userId, dto.currentPassword, dto.newPassword);
  }
}

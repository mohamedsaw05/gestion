import { Injectable } from '@nestjs/common';
import { isValidPermissionKey, type CapabilityKey, type PermissionKey, type ScopeType } from '@gestionnaire/db';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';
import { buildMenu } from './menu.config.js';

export interface EffectiveGrant {
  permissionKey: PermissionKey;
  scopeType: ScopeType;
  scopeLocationIds: string[];
}

/**
 * cf docs/architecture/08-roles-permissions.md — modèle
 * permission atomique -> rôle -> attribution avec scope -> évaluation.
 */
@Injectable()
export class RbacService {
  constructor(
    private readonly db: PrismaTenantService,
    private readonly businessProfile: BusinessProfileService,
  ) {}

  async getEffectiveGrants(tenantId: string, userId: string): Promise<EffectiveGrant[]> {
    return this.db.run(tenantId, async (tx) => {
      const userRoles = await tx.userRole.findMany({
        where: { tenantId, userId },
        include: { role: { include: { permissions: true } } },
      });

      const grants: EffectiveGrant[] = [];
      for (const userRole of userRoles) {
        for (const rolePermission of userRole.role.permissions) {
          if (!isValidPermissionKey(rolePermission.permissionKey)) {
            // Défense en profondeur : une clé en base qui ne serait plus dans le
            // catalogue codé (cf @gestionnaire/db) est ignorée plutôt que d'accorder
            // silencieusement un droit non défini.
            continue;
          }
          grants.push({
            permissionKey: rolePermission.permissionKey,
            scopeType: userRole.scopeType as ScopeType,
            scopeLocationIds: userRole.scopeLocationIds,
          });
        }
      }
      return grants;
    });
  }

  /**
   * cf docs/architecture/08-roles-permissions.md §1.4. Fail-closed : tout cas
   * non explicitement autorisé retourne false.
   */
  async can(
    tenantId: string,
    userId: string,
    permission: PermissionKey,
    context: { locationId?: string } = {},
  ): Promise<boolean> {
    const grants = await this.getEffectiveGrants(tenantId, userId);
    const matching = grants.filter((g) => g.permissionKey === permission);
    if (matching.length === 0) return false;

    if (!context.locationId) {
      // Action non rattachée à un emplacement précis : la permission seule suffit.
      return true;
    }

    return matching.some((g) => {
      if (g.scopeType === 'ALL_LOCATIONS') return true;
      if (g.scopeType === 'LOCATIONS') return g.scopeLocationIds.includes(context.locationId!);
      // TEAM porte une notion d'emplacement (les emplacements supervisés,
      // cf getRecordVisibility) : pour une action ponctuelle (ex: créer une
      // vente), même vérification que LOCATIONS.
      if (g.scopeType === 'TEAM') return g.scopeLocationIds.includes(context.locationId!);
      // OWN_RECORDS ne restreint JAMAIS la CRÉATION d'un enregistrement par
      // emplacement — un enregistrement qui n'existe pas encore appartient
      // par définition à celui qui le crée. Il restreint uniquement la
      // VISIBILITÉ ultérieure d'une liste (cf getRecordVisibility(), consommé
      // par SalesService.list/getById). Bloquer ici la création reviendrait à
      // empêcher un vendeur "OWN_RECORDS" de vendre du tout — contraire à
      // l'intention du scope.
      if (g.scopeType === 'OWN_RECORDS') return true;
      return false;
    });
  }

  /**
   * Résout, pour une permission donnée, la visibilité RÉELLE d'une liste
   * d'enregistrements pour cet utilisateur — union de tous ses rôles/scopes
   * (un utilisateur peut cumuler plusieurs rôles). `allLocations: true`
   * signifie "aucune restriction", les autres champs se combinent en OR.
   *
   * Décision de conception (scope TEAM) : en l'absence d'un modèle de
   * hiérarchie manager→subordonnés dans le schéma actuel, "mon équipe" est
   * défini comme "les utilisateurs dont un rôle a le scope LOCATIONS avec un
   * chevauchement sur les emplacements de CE grant TEAM" — réutilise le champ
   * `scopeLocationIds` déjà existant sur UserRole plutôt que d'inventer un
   * nouveau concept. Documenté ici et dans PROJECT_STATUS.md ; à revoir si un
   * vrai modèle hiérarchique (managerId) est introduit plus tard.
   */
  async getRecordVisibility(
    tenantId: string,
    userId: string,
    permission: PermissionKey,
  ): Promise<{
    allLocations: boolean;
    locationIds: string[];
    ownRecordsOnly: boolean;
    teamLocationIds: string[];
  }> {
    const grants = (await this.getEffectiveGrants(tenantId, userId)).filter(
      (g) => g.permissionKey === permission,
    );

    if (grants.some((g) => g.scopeType === 'ALL_LOCATIONS')) {
      return { allLocations: true, locationIds: [], ownRecordsOnly: false, teamLocationIds: [] };
    }

    const locationIds = Array.from(
      new Set(grants.filter((g) => g.scopeType === 'LOCATIONS').flatMap((g) => g.scopeLocationIds)),
    );
    const teamLocationIds = Array.from(
      new Set(grants.filter((g) => g.scopeType === 'TEAM').flatMap((g) => g.scopeLocationIds)),
    );
    const ownRecordsOnly = grants.some((g) => g.scopeType === 'OWN_RECORDS');

    return { allLocations: false, locationIds, ownRecordsOnly, teamLocationIds };
  }

  /**
   * Utilisateurs "membres de l'équipe" au sens du scope TEAM (cf
   * getRecordVisibility) : ceux dont au moins un rôle a le scope LOCATIONS
   * avec une intersection non vide sur `locationIds`. Appelé AVANT
   * d'ouvrir la transaction du service consommateur (jamais depuis
   * l'intérieur d'un `db.run` déjà ouvert, cf piège documenté dans
   * CashRegisterService/RolesService).
   */
  async resolveTeamMemberUserIds(tenantId: string, locationIds: string[]): Promise<string[]> {
    if (locationIds.length === 0) return [];
    return this.db.run(tenantId, async (tx) => {
      const rows = await tx.userRole.findMany({
        where: { tenantId, scopeType: 'LOCATIONS' },
        select: { userId: true, scopeLocationIds: true },
      });
      const memberIds = rows
        .filter((r) => r.scopeLocationIds.some((id) => locationIds.includes(id)))
        .map((r) => r.userId);
      return Array.from(new Set(memberIds));
    });
  }

  async getVisibleMenu(tenantId: string, userId: string) {
    const [grants, resolvedCapabilities, resolvedModules] = await Promise.all([
      this.getEffectiveGrants(tenantId, userId),
      this.businessProfile.getResolvedCapabilities(tenantId),
      this.businessProfile.getResolvedModules(tenantId),
    ]);
    const enabledCapabilities = new Set<CapabilityKey>(
      Object.entries(resolvedCapabilities)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key as CapabilityKey),
    );
    const enabledModules = new Set(resolvedModules.filter((m) => m.enabled).map((m) => m.key));
    return buildMenu(new Set(grants.map((g) => g.permissionKey)), enabledCapabilities, enabledModules);
  }
}

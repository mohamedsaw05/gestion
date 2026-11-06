import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query } from '@nestjs/common';
import { CAPABILITIES, PERMISSIONS, newId } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { CreateLocationDto } from './dto/create-location.dto.js';

function normalizeLocationName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}

/**
 * Liste des emplacements du tenant, SANS permission spécifique requise : la
 * liste des magasins/dépôts n'est pas une donnée sensible au sein d'un tenant
 * (contrairement au niveau de stock, protégé par inventory.stock.read) — un
 * vendeur doit pouvoir choisir un emplacement pour vendre sans avoir accès à
 * la gestion de stock. Isolation tenant toujours garantie par la RLS.
 */
@Controller('locations')
export class LocationsController {
  constructor(private readonly db: PrismaTenantService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeQuarantine') includeQuarantine?: string,
  ) {
    const shouldIncludeQuarantine = includeQuarantine === 'true';
    return this.db.run(user.tenantId, (tx) =>
      tx.location.findMany({
        where: {
          tenantId: user.tenantId,
          deletedAt: null,
          ...(shouldIncludeQuarantine ? {} : { type: { not: 'QUARANTINE' } }),
        },
        orderBy: { name: 'asc' },
      }),
    );
  }

  /**
   * Créer un emplacement supplémentaire nécessite la capability
   * multiple_locations (CapabilityGuard, fail-closed : refusée pour TOUTE
   * création tant qu'elle est désactivée, pas seulement à partir de la 2e) —
   * un commerce mono-site n'a besoin que de son emplacement initial (créé au
   * provisioning du tenant, hors de cette route).
   */
  @Post()
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @RequireCapability(CAPABILITIES.MULTIPLE_LOCATIONS)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLocationDto) {
    try {
      return await this.db.run(user.tenantId, async (tx) => {
      const name = dto.name.trim().replace(/\s+/g, ' ');
      const normalizedName = normalizeLocationName(name);
      if (dto.type === 'STORE') {
        const duplicate = await tx.location.findFirst({
          where: { type: 'STORE', deletedAt: null, normalizedName },
          select: { id: true, name: true },
        });
        if (duplicate) {
          throw new BadRequestException(`Le nom de boutique « ${name} » est déjà utilisé par une autre boutique. Choisissez un nom unique.`);
        }
      }
      const sub = await tx.platformSubscription.findUnique({
        where: { tenantId: user.tenantId },
        include: { plan: true },
      });
      if (sub) {
        if (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED') {
          throw new ForbiddenException(`Espace de travail suspendu (${sub.status}). Action impossible.`);
        }
        const locationsCount = await tx.location.count({
          where: { tenantId: user.tenantId, deletedAt: null },
        });
        if (locationsCount >= sub.plan.maxLocations) {
          throw new BadRequestException(
            `Quota d'emplacements atteint (${locationsCount}/${sub.plan.maxLocations}). Veuillez passer à une offre supérieure.`,
          );
        }
      }

      return tx.location.create({
        data: { id: newId(), tenantId: user.tenantId, name, normalizedName, type: dto.type },
      });
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002' && dto.type === 'STORE') {
        throw new BadRequestException(`Le nom de boutique « ${dto.name.trim()} » est déjà utilisé. Choisissez un nom unique.`);
      }
      throw error;
    }
  }
}

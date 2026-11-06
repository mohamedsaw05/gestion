import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Se connecte avec le rôle Postgres dédié `platform_runtime` (créé par la
 * migration least_privilege_roles), qui n'a accès qu'en lecture seule aux
 * tenants ACTIFS via une policy RLS explicite — jamais BYPASSRLS. N'expose
 * volontairement qu'une opération unique et non sensible : lister les tenants
 * actifs pour permettre à l'écran de connexion de démonstration de proposer
 * un sélecteur d'organisation.
 *
 * Ce n'est PAS le futur Platform Engine (docs/architecture/02-moteurs.md §1) —
 * seulement un raccourci pour ce sprint. Avant toute mise en production, ceci
 * doit être remplacé par une vraie résolution de tenant à la connexion
 * (sous-domaine, ou table d'index email→tenant dédiée), pas une liste
 * publique de tenants — cf docs/PROJECT_STATUS.md.
 *
 * Ne JAMAIS ajouter d'autre méthode à ce service sans repasser par cette
 * discussion — c'est délibérément une surface minimale.
 */
@Injectable()
export class PlatformPrismaService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL;
    this.prisma = new PrismaClient({ datasourceUrl: url });
  }

  async listActiveTenantsForLoginScreen(): Promise<{ id: string; name: string }[]> {
    return this.prisma.tenant.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  async run<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return fn(this.prisma);
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Connexion applicative utilisée par TOUT le code métier tenant-scopé.
 *
 * Se connecte avec le rôle Postgres `app_runtime`, qui n'a PAS le privilège
 * BYPASSRLS (cf docs/architecture/03-modele-donnees.md §5 et
 * docs/architecture/07-securite.md §3). L'isolation multi-tenant est donc
 * garantie par PostgreSQL lui-même, pas seulement par la discipline du code :
 * même une requête Prisma qui "oublierait" de filtrer par tenant ne peut pas
 * faire fuiter les données d'un autre tenant.
 */
@Injectable()
export class PrismaTenantService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL_RUNTIME ?? process.env.DATABASE_URL;
    this.prisma = new PrismaClient({ datasourceUrl: url });
  }

  /**
   * Exécute `fn` dans une transaction Postgres avec `app.current_tenant_id`
   * positionné via `set_config(..., true)` (portée transaction, paramétré donc
   * sans risque d'injection — jamais de concaténation de chaîne dans du SQL).
   *
   * Toute opération multi-étapes qui doit être atomique (ex: une vente qui
   * décrémente le stock ET encaisse ET journalise) s'exécute entièrement à
   * l'intérieur d'un seul appel à `run()` (cf
   * docs/architecture/01-analyse-risques.md §4.1).
   */
  async run<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}

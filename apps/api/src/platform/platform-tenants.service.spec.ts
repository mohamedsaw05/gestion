import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
vi.mock('argon2', () => ({
  hash: vi.fn(async (password: string) => `test-hash:${password}`),
  verify: vi.fn(async (hash: string, password: string) => hash === `test-hash:${password}`),
}));
import * as argon2 from 'argon2';
import { PlatformTenantsService } from './platform-tenants.service.js';

describe('PlatformTenantsService (S0-01 Security & Reset Protection)', () => {
  let service: PlatformTenantsService;
  let mockPlatformPrisma: any;
  let mockTx: any;
  const originalEnv = process.env;

  const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const REAL_TENANT_ID = '00000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockTx = new Proxy(
      {
        stockLevel: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        documentSequence: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        category: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        product: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        auditLog: { create: vi.fn().mockResolvedValue({ id: 'mock-id' }), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        tenant: { findUnique: vi.fn().mockResolvedValue({ id: DEMO_TENANT_ID, name: 'Boutique Test', status: 'ACTIVE' }) },
        $queryRaw: vi.fn().mockResolvedValue([]),
        $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      },
      {
        get(target: any, prop: string) {
          if (!(prop in target)) {
            target[prop] = {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
              updateMany: vi.fn().mockResolvedValue({ count: 0 }),
              create: vi.fn().mockResolvedValue({ id: 'mock-id' }),
              findMany: vi.fn().mockResolvedValue([]),
              findUnique: vi.fn().mockResolvedValue(null),
              findFirst: vi.fn().mockResolvedValue(null),
            };
          }
          return target[prop];
        },
      },
    );

    const client = {
      platformAdminUser: { findUnique: vi.fn() },
      tenant: { findUnique: vi.fn() },
      userRole: { findMany: vi.fn().mockResolvedValue([{ userId: 'principal-user', roleId: 'owner-role' }]) },
      auditLog: { findFirst: vi.fn().mockResolvedValue({ id: 'existing-backup' }), create: vi.fn().mockResolvedValue({ id: 'audit-log-id' }) },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
    };
    mockPlatformPrisma = {
      client: new Proxy(client, {
        get(target: any, prop: string) {
          if (prop in target) return target[prop];
          return {
            count: vi.fn().mockResolvedValue(0),
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'mock-id' }),
          };
        },
      }),
    };
    service = new PlatformTenantsService(mockPlatformPrisma);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('refuses to provision an organization without an explicitly selected owner password', async () => {
    mockPlatformPrisma.client.platformPlan = {
      findUnique: vi.fn().mockResolvedValue({ id: 'trial-plan', isActive: true, trialDays: 14 }),
    };

    await expect(service.createTenant({
      name: 'Commerce de test',
      ownerEmail: 'directeur@example.com',
      ownerName: 'Directeur',
      initialStoreName: 'Boutique Démo',
    } as any)).rejects.toThrow('Un mot de passe initial de 6 caractères minimum');

    expect(mockPlatformPrisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('1. NODE_ENV=production : refus catégorique et zéro suppression', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PLATFORM_RESET = 'true';

    await expect(
      service.resetAllPlatform('admin-1', {
        password: 'Password123!',
        confirmationPhrase: 'REINITIALISER TOUTE LA PLATEFORME',
        targetDemoTenantId: DEMO_TENANT_ID,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockPlatformPrisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('2. QA sans configuration explicite : refus', async () => {
    process.env.NODE_ENV = 'qa';
    delete process.env.ALLOW_PLATFORM_RESET;

    await expect(
      service.resetAllPlatform('admin-1', {
        password: 'Password123!',
        confirmationPhrase: 'REINITIALISER TOUTE LA PLATEFORME',
        targetDemoTenantId: DEMO_TENANT_ID,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockPlatformPrisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('3. QA avec configuration, mais sans identifiant de tenant de démonstration : refus', async () => {
    process.env.NODE_ENV = 'qa';
    process.env.ALLOW_PLATFORM_RESET = 'true';

    await expect(
      service.resetAllPlatform('admin-1', {
        password: 'Password123!',
        confirmationPhrase: 'REINITIALISER TOUTE LA PLATEFORME',
        // Pas de targetDemoTenantId
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPlatformPrisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('4. Refus si le tenant ciblé est une entreprise réelle et non un tenant demo/test', async () => {
    process.env.NODE_ENV = 'qa';
    process.env.ALLOW_PLATFORM_RESET = 'true';

    const hash = await argon2.hash('BonMotDePasse!');
    mockPlatformPrisma.client.platformAdminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      status: 'ACTIVE',
      passwordHash: hash,
    });
    mockPlatformPrisma.client.tenant.findUnique.mockResolvedValue({
      id: REAL_TENANT_ID,
      name: 'SARL Commerce Réel Production',
    });

    await expect(
      service.resetAllPlatform('admin-1', {
        password: 'BonMotDePasse!',
        confirmationPhrase: 'REINITIALISER TOUTE LA PLATEFORME',
        targetDemoTenantId: REAL_TENANT_ID,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockPlatformPrisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('5. QA avec tenant de démonstration autorisé : seules les fixtures de ce périmètre sont touchées, voisin intact', async () => {
    process.env.NODE_ENV = 'qa';
    process.env.ALLOW_PLATFORM_RESET = 'true';

    const hash = await argon2.hash('BonMotDePasse!');
    mockPlatformPrisma.client.platformAdminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      status: 'ACTIVE',
      passwordHash: hash,
    });
    mockPlatformPrisma.client.tenant.findUnique.mockResolvedValue({
      id: DEMO_TENANT_ID,
      name: 'Boutique Démo Fixtures Test',
    });

    const res = await service.resetAllPlatform('admin-1', {
      password: 'BonMotDePasse!',
      confirmationPhrase: 'REINITIALISER TOUTE LA PLATEFORME',
      targetDemoTenantId: DEMO_TENANT_ID,
    });

    expect(res.success).toBe(true);
    expect(res.scope).toBe('DEMO_TENANT_FIXTURES_ONLY');
    expect(res.targetTenantId).toBe(DEMO_TENANT_ID);

    // Contrôle strict des appels Prisma : AUCUN deleteMany({}) non borné !
    expect(mockTx.payment.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: DEMO_TENANT_ID },
    });
    expect(mockTx.sale.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: DEMO_TENANT_ID },
    });
    expect(mockTx.stockMovement.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: DEMO_TENANT_ID },
    });
    expect(mockTx.customer.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: DEMO_TENANT_ID },
    });
  });

  it('6. S0-01 : doit refuser si mot de passe administrateur incorrect', async () => {
    process.env.NODE_ENV = 'qa';
    process.env.ALLOW_PLATFORM_RESET = 'true';

    const hash = await argon2.hash('BonMotDePasse!');
    mockPlatformPrisma.client.platformAdminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      status: 'ACTIVE',
      passwordHash: hash,
    });

    await expect(
      service.resetAllPlatform('admin-1', {
        password: 'MauvaisMotDePasse',
        confirmationPhrase: 'REINITIALISER TOUTE LA PLATEFORME',
        targetDemoTenantId: DEMO_TENANT_ID,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPlatformPrisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('7. Reset individuel : refus strict si backupConfirmed est manquant ou faux', async () => {
    const hash = await argon2.hash('BonMotDePasse!');
    mockPlatformPrisma.client.platformAdminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      status: 'ACTIVE',
      passwordHash: hash,
    });
    mockPlatformPrisma.client.tenant.findUnique.mockResolvedValue({
      id: DEMO_TENANT_ID,
      name: 'Boutique Test',
    });

    await expect(
      service.resetSingleTenantOperationalData('admin-1', DEMO_TENANT_ID, {
        password: 'BonMotDePasse!',
        confirmationPhrase: 'CONFIRMER REINITIALISATION Boutique Test',
        backupConfirmed: false,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPlatformPrisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('8. Reset individuel valide : exécute la réinitialisation transactionnelle et consigne l audit log', async () => {
    const hash = await argon2.hash('BonMotDePasse!');
    mockPlatformPrisma.client.platformAdminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      status: 'ACTIVE',
      passwordHash: hash,
    });
    mockPlatformPrisma.client.tenant.findUnique.mockResolvedValue({
      id: DEMO_TENANT_ID,
      name: 'Boutique Test',
    });
    mockPlatformPrisma.client.auditLog = {
      findFirst: vi.fn().mockResolvedValue({ id: 'existing-backup' }),
      create: vi.fn().mockResolvedValue({ id: 'audit-log-id' }),
    };

    const res = await service.resetSingleTenantOperationalData('admin-1', DEMO_TENANT_ID, {
      password: 'BonMotDePasse!',
      confirmationPhrase: 'CONFIRMER REINITIALISATION Boutique Test',
      backupConfirmed: true,
    });

    expect(res.success).toBe(true);
    expect(res.tenantName).toBe('Boutique Test');
    expect(mockTx.user.deleteMany).toHaveBeenCalledWith({ where: { tenantId: DEMO_TENANT_ID, id: { not: 'principal-user' } } });
    expect(mockTx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tenantId: DEMO_TENANT_ID, userId: 'principal-user' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockPlatformPrisma.client.$transaction).toHaveBeenCalled();
  });
});

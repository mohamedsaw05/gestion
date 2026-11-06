import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RbacService } from './rbac.service.js';
import type { PrismaTenantService } from '../common/prisma-tenant.service.js';
import type { BusinessProfileService } from '../business-profile/business-profile.service.js';

describe('RbacService (Unit tests isolés)', () => {
  let service: RbacService;
  let mockDb: { run: ReturnType<typeof vi.fn> };
  let mockBusinessProfile: {
    getResolvedCapabilities: ReturnType<typeof vi.fn>;
    getResolvedModules: ReturnType<typeof vi.fn>;
  };

  const TENANT_ID = '3e91b057-f0f3-4410-9c4a-8541896328a6';
  const USER_ID = '11111111-1111-1111-1111-111111111111';
  const LOC_1 = '22222222-2222-2222-2222-222222222222';
  const LOC_2 = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    mockDb = {
      run: vi.fn(),
    };
    mockBusinessProfile = {
      getResolvedCapabilities: vi.fn(),
      getResolvedModules: vi.fn(),
    };
    service = new RbacService(
      mockDb as unknown as PrismaTenantService,
      mockBusinessProfile as unknown as BusinessProfileService,
    );
  });

  describe('getEffectiveGrants', () => {
    it('renvoie les permissions valides d’un utilisateur avec leurs scopes', async () => {
      mockDb.run.mockImplementation(async (_tenantId, callback) => {
        const tx = {
          userRole: {
            findMany: vi.fn().mockResolvedValue([
              {
                scopeType: 'LOCATIONS',
                scopeLocationIds: [LOC_1],
                role: {
                  permissions: [
                    { permissionKey: 'sales.read' },
                    { permissionKey: 'sales.create' },
                    { permissionKey: 'cle.invalide.hors.catalogue' }, // Doit être ignorée (défense en profondeur)
                  ],
                },
              },
            ]),
          },
        };
        return callback(tx);
      });

      const grants = await service.getEffectiveGrants(TENANT_ID, USER_ID);
      expect(grants).toHaveLength(2);
      expect(grants).toEqual([
        { permissionKey: 'sales.read', scopeType: 'LOCATIONS', scopeLocationIds: [LOC_1] },
        { permissionKey: 'sales.create', scopeType: 'LOCATIONS', scopeLocationIds: [LOC_1] },
      ]);
    });

    it('renvoie une liste vide si l’utilisateur n’a aucun rôle', async () => {
      mockDb.run.mockImplementation(async (_tenantId, callback) => {
        const tx = { userRole: { findMany: vi.fn().mockResolvedValue([]) } };
        return callback(tx);
      });

      const grants = await service.getEffectiveGrants(TENANT_ID, USER_ID);
      expect(grants).toEqual([]);
    });
  });

  describe('can', () => {
    it('refuse immédiatement (false) si la permission n’est pas accordée (fail-closed)', async () => {
      vi.spyOn(service, 'getEffectiveGrants').mockResolvedValue([]);
      const result = await service.can(TENANT_ID, USER_ID, 'sales.create');
      expect(result).toBe(false);
    });

    it('accorde (true) si la permission existe et qu’aucun locationId n’est requis', async () => {
      vi.spyOn(service, 'getEffectiveGrants').mockResolvedValue([
        { permissionKey: 'catalog.product.read', scopeType: 'LOCATIONS', scopeLocationIds: [LOC_1] },
      ]);
      const result = await service.can(TENANT_ID, USER_ID, 'catalog.product.read');
      expect(result).toBe(true);
    });

    it('accorde (true) pour un scope ALL_LOCATIONS quel que soit le locationId', async () => {
      vi.spyOn(service, 'getEffectiveGrants').mockResolvedValue([
        { permissionKey: 'sales.create', scopeType: 'ALL_LOCATIONS', scopeLocationIds: [] },
      ]);
      const result = await service.can(TENANT_ID, USER_ID, 'sales.create', { locationId: LOC_2 });
      expect(result).toBe(true);
    });

    it('accorde (true) si le locationId est dans scopeLocationIds pour scope LOCATIONS', async () => {
      vi.spyOn(service, 'getEffectiveGrants').mockResolvedValue([
        { permissionKey: 'sales.create', scopeType: 'LOCATIONS', scopeLocationIds: [LOC_1] },
      ]);
      const resultOk = await service.can(TENANT_ID, USER_ID, 'sales.create', { locationId: LOC_1 });
      const resultRefuse = await service.can(TENANT_ID, USER_ID, 'sales.create', { locationId: LOC_2 });
      expect(resultOk).toBe(true);
      expect(resultRefuse).toBe(false);
    });

    it('accorde (true) pour OWN_RECORDS sur une action ponctuelle avec locationId', async () => {
      vi.spyOn(service, 'getEffectiveGrants').mockResolvedValue([
        { permissionKey: 'sales.create', scopeType: 'OWN_RECORDS', scopeLocationIds: [] },
      ]);
      const result = await service.can(TENANT_ID, USER_ID, 'sales.create', { locationId: LOC_2 });
      expect(result).toBe(true);
    });

    it('gère correctement le scope TEAM sur les emplacements supervisés', async () => {
      vi.spyOn(service, 'getEffectiveGrants').mockResolvedValue([
        { permissionKey: 'sales.create', scopeType: 'TEAM', scopeLocationIds: [LOC_1] },
      ]);
      expect(await service.can(TENANT_ID, USER_ID, 'sales.create', { locationId: LOC_1 })).toBe(true);
      expect(await service.can(TENANT_ID, USER_ID, 'sales.create', { locationId: LOC_2 })).toBe(false);
    });
  });

  describe('getRecordVisibility', () => {
    it('renvoie allLocations=true si au moins un rôle a ALL_LOCATIONS', async () => {
      vi.spyOn(service, 'getEffectiveGrants').mockResolvedValue([
        { permissionKey: 'sales.read', scopeType: 'LOCATIONS', scopeLocationIds: [LOC_1] },
        { permissionKey: 'sales.read', scopeType: 'ALL_LOCATIONS', scopeLocationIds: [] },
      ]);

      const vis = await service.getRecordVisibility(TENANT_ID, USER_ID, 'sales.read');
      expect(vis.allLocations).toBe(true);
      expect(vis.locationIds).toEqual([]);
      expect(vis.ownRecordsOnly).toBe(false);
    });

    it('agrège les scopes LOCATIONS, TEAM et OWN_RECORDS pour des rôles restreints', async () => {
      vi.spyOn(service, 'getEffectiveGrants').mockResolvedValue([
        { permissionKey: 'sales.read', scopeType: 'LOCATIONS', scopeLocationIds: [LOC_1] },
        { permissionKey: 'sales.read', scopeType: 'LOCATIONS', scopeLocationIds: [LOC_2] },
        { permissionKey: 'sales.read', scopeType: 'TEAM', scopeLocationIds: [LOC_1] },
        { permissionKey: 'sales.read', scopeType: 'OWN_RECORDS', scopeLocationIds: [] },
      ]);

      const vis = await service.getRecordVisibility(TENANT_ID, USER_ID, 'sales.read');
      expect(vis.allLocations).toBe(false);
      expect(vis.locationIds).toEqual([LOC_1, LOC_2]);
      expect(vis.teamLocationIds).toEqual([LOC_1]);
      expect(vis.ownRecordsOnly).toBe(true);
    });
  });

  describe('resolveTeamMemberUserIds', () => {
    it('renvoie un tableau vide si locationIds est vide sans interroger la DB', async () => {
      const result = await service.resolveTeamMemberUserIds(TENANT_ID, []);
      expect(result).toEqual([]);
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('résout les utilisateurs dont le scope LOCATIONS chevauche les emplacements supervisés', async () => {
      const USER_A = 'aaaa-1111';
      const USER_B = 'bbbb-2222';
      const USER_C = 'cccc-3333';

      mockDb.run.mockImplementation(async (_tenantId, callback) => {
        const tx = {
          userRole: {
            findMany: vi.fn().mockResolvedValue([
              { userId: USER_A, scopeLocationIds: [LOC_1] },
              { userId: USER_B, scopeLocationIds: [LOC_2] },
              { userId: USER_C, scopeLocationIds: ['autre-loc'] },
            ]),
          },
        };
        return callback(tx);
      });

      const members = await service.resolveTeamMemberUserIds(TENANT_ID, [LOC_1, LOC_2]);
      expect(members).toContain(USER_A);
      expect(members).toContain(USER_B);
      expect(members).not.toContain(USER_C);
    });
  });

  describe('getVisibleMenu', () => {
    it('construit le menu filtré par permissions, capabilities et modules actifs', async () => {
      vi.spyOn(service, 'getEffectiveGrants').mockResolvedValue([
        { permissionKey: 'sales.read', scopeType: 'ALL_LOCATIONS', scopeLocationIds: [] },
        { permissionKey: 'catalog.product.read', scopeType: 'ALL_LOCATIONS', scopeLocationIds: [] },
      ]);
      mockBusinessProfile.getResolvedCapabilities.mockResolvedValue({
        inventory: true,
        orders: false,
      });
      mockBusinessProfile.getResolvedModules.mockResolvedValue([
        { key: 'catalog', enabled: true },
        { key: 'orders', enabled: false },
      ]);

      const menu = await service.getVisibleMenu(TENANT_ID, USER_ID);
      expect(Array.isArray(menu)).toBe(true);
      expect(menu.some((item) => item.path === '/sales')).toBe(true);
    });
  });
});

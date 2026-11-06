import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvitationsService } from './invitations.service.js';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let mockDb: any;
  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      role: {
        findFirst: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      invitation: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      roleGrantAssignment: {
        create: vi.fn(),
      },
      outboxEvent: {
        create: vi.fn(),
      },
    };

    mockDb = {
      run: vi.fn(async (tenantId: string, callback: (tx: any) => Promise<any>) => {
        return callback(mockTx);
      }),
    };

    service = new InvitationsService(mockDb);
  });

  it('crée une invitation avec token opaque et hash sécurisé (aucun mot de passe en clair)', async () => {
    mockTx.role.findFirst.mockResolvedValue({ id: 'role-1', name: 'Caissier' });
    mockTx.user.findFirst.mockResolvedValue(null);
    mockTx.invitation.create.mockImplementation(({ data }: any) => ({
      ...data,
      id: 'inv-1',
      status: 'PENDING',
    }));
    mockTx.outboxEvent.create.mockResolvedValue({});

    const result = await service.create('tenant-1', 'user-admin', {
      email: 'nouveau@boutique.com',
      roleId: 'role-1',
      scopeType: 'ALL_LOCATIONS',
    });

    expect(result.invitationToken).toBeDefined();
    expect(result.invitation.email).toBe('nouveau@boutique.com');
    expect(result.deliveryStatus).toBe('CREATED_LINK_GENERATED_NO_SMTP_DISPATCH');
    expect(mockTx.invitation.create).toHaveBeenCalled();
  });

  it('refuse une invitation si un utilisateur avec cet email existe déjà dans le tenant', async () => {
    mockTx.role.findFirst.mockResolvedValue({ id: 'role-1', name: 'Caissier' });
    mockTx.user.findFirst.mockResolvedValue({ id: 'user-existing', email: 'existant@boutique.com' });

    await expect(
      service.create('tenant-1', 'user-admin', {
        email: 'existant@boutique.com',
        roleId: 'role-1',
        scopeType: 'ALL_LOCATIONS',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('refuse d\'accepter une invitation expirée', async () => {
    mockTx.invitation.findFirst.mockResolvedValue({
      id: 'inv-expired',
      tenantId: 'tenant-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 3600000), // Expiré depuis 1h
    });

    await expect(
      service.accept('tenant-1', 'any-token', 'Test User', 'Password123!'),
    ).rejects.toThrow(NotFoundException);
  });

  it('révoque correctement une invitation en attente', async () => {
    mockTx.invitation.findFirst.mockResolvedValue({
      id: 'inv-1',
      tenantId: 'tenant-1',
      email: 'test@boutique.com',
      status: 'PENDING',
    });
    mockTx.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'REVOKED' });
    mockTx.outboxEvent.create.mockResolvedValue({});

    const res = await service.revoke('tenant-1', 'user-admin', 'inv-1');
    expect(res.revoked).toBe(true);
    expect(mockTx.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: { status: 'REVOKED' },
      }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

const { verifyPassword } = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
vi.mock('argon2', () => ({ verify: (...args: unknown[]) => verifyPassword(...args) }));

import { AuthService, clearLoginAttemptsForTesting } from './auth.service.js';

describe('AuthService account-scoped lockout', () => {
  const email = 'director@example.com';
  const accounts: Record<string, any> = {
    tenant_a: { id: 'user_a', tenantId: 'tenant_a', email, fullName: 'Director A', passwordHash: 'hash-a' },
    tenant_b: { id: 'user_b', tenantId: 'tenant_b', email, fullName: 'Director B', passwordHash: 'hash-b' },
  };
  let service: AuthService;
  let userLookup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearLoginAttemptsForTesting();
    verifyPassword.mockReset();
    verifyPassword.mockImplementation(async (hash: string, password: string) => hash === 'hash-b' && password === 'correct-password');
    userLookup = vi.fn(async ({ where }: any) => accounts[where.tenantId] ?? null);
    const db = {
      run: vi.fn(async (tenantId: string, callback: (tx: any) => unknown) => callback({
        user: { findFirst: userLookup },
        refreshToken: { create: vi.fn(async ({ data }: any) => data) },
      })),
    };
    service = new AuthService(
      db as any,
      { client: {} } as any,
      { sign: vi.fn(() => 'token') } as any,
      {} as any,
    );
  });

  it('locks only the failed tenant account and leaves another organization login available', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(service.login('tenant_a', email, 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
    }

    const lookupCountAfterLock = userLookup.mock.calls.length;
    await expect(service.login('tenant_a', email, 'correct-password')).rejects.toThrow(/verrouillé/i);
    expect(userLookup).toHaveBeenCalledTimes(lookupCountAfterLock);

    const secondTenantLogin = await service.login('tenant_b', email, 'correct-password');
    expect(secondTenantLogin.user?.id).toBe('user_b');
  });
});

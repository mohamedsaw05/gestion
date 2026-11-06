import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PlatformFestiveWheelService } from './platform-festive-wheel.service.js';

describe('PlatformFestiveWheelService', () => {
  it('persists configuration in PostgreSQL and starts disabled', async () => {
    let persisted: any = null;
    const platform = {
      client: {
        $queryRaw: vi.fn(async () => persisted ? [{ value: persisted.value }] : []),
        $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
          persisted = { key: 'festive-wheel', value: JSON.parse(String(values[1])) };
          return 1;
        }),
      },
    } as any;

    const service = new PlatformFestiveWheelService(platform);
    await service.onModuleInit();
    expect(persisted.key).toBe('festive-wheel');
    expect(persisted.value.enabled).toBe(false);

    await service.updateAdminConfig({ eventTitle: 'Campagne Noël' });
    const restartedService = new PlatformFestiveWheelService(platform);
    await restartedService.onModuleInit();
    expect(await restartedService.getAdminConfig()).toMatchObject({ eventTitle: 'Campagne Noël', enabled: false });
  });

  it('refuses reward operations unless Super Admin enabled the event and its configured dates include now', async () => {
    const platform = {
      client: {
        $queryRaw: vi.fn().mockResolvedValue([]),
        $executeRaw: vi.fn(),
      },
    } as any;
    const service = new PlatformFestiveWheelService(platform);
    await service.onModuleInit();

    await expect(service.spinWheel('tenant-id', 'user-id')).rejects.toThrow(BadRequestException);

    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    await service.updateAdminConfig({ startsAt: past, endsAt: future });
    expect((await service.getPublicStatus('tenant-id', 'user-id')).eventEnabled).toBe(false);
    await service.updateAdminConfig({ enabled: true });
    const config = await service.getAdminConfig();
    expect(config.enabled).toBe(true);
    expect(config.startsAt).toBe(past);
  });
});

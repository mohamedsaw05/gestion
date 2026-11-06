import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PlatformAdminContext } from '../guards/platform-admin.guard.js';

export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAdminContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.platformAdmin!;
  },
);

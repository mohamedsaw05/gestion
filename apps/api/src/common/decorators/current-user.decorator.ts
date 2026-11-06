import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../request-context.js';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.authUser) {
      // Ne devrait jamais arriver : JwtAuthGuard doit toujours s'exécuter avant.
      throw new InternalServerErrorException('@CurrentUser() utilisé sur une route sans authentification');
    }
    return req.authUser;
  },
);

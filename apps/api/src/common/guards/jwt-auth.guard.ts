import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthenticatedUser } from '../request-context.js';

interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  deviceId?: string;
}

/**
 * Vérifie systématiquement le token côté serveur (jamais de confiance dans un
 * état d'UI côté client) — cf docs/architecture/07-securite.md §2.
 * Guard global (voir app.module.ts), désactivable route par route via @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException("Token d'accès manquant");
    }
    const token = authHeader.slice('Bearer '.length);

    let payload: AccessTokenPayload;
    try {
      payload = this.jwt.verify<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Token d'accès invalide ou expiré");
    }

    if (!payload.tenantId) {
      throw new UnauthorizedException("Token d'accès sans contexte organisationnel");
    }

    const user: AuthenticatedUser = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      deviceId: payload.deviceId,
    };
    request.authUser = user;
    return true;
  }
}

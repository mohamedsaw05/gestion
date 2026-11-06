import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface PlatformAdminContext {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      platformAdmin?: PlatformAdminContext;
    }
  }
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token administrateur plateforme manquant');
    }

    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = this.jwt.verify<{
        sub: string;
        email: string;
        role: string;
        isPlatformAdmin?: boolean;
      }>(token);

      if (!payload.isPlatformAdmin) {
        throw new UnauthorizedException('Accès réservé aux administrateurs de la plateforme SaaS');
      }

      request.platformAdmin = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Session administrateur invalide ou expirée');
    }
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { PermissionKey } from '@gestionnaire/db';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import { RbacService } from '../../rbac/rbac.service.js';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Vérifie la permission ET le scope de localisation (cf
 * docs/architecture/08-roles-permissions.md §1.4). S'exécute après
 * JwtAuthGuard (ordre déclaré dans app.module.ts) : req.authUser est déjà
 * renseigné à ce stade.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<PermissionKey | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.authUser;
    if (!user) {
      throw new ForbiddenException('Contexte utilisateur manquant');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const locationId =
      (request.query?.locationId as string | undefined) ?? (body?.locationId as string | undefined);

    const allowed = await this.rbac.can(user.tenantId, user.userId, required, { locationId });
    if (!allowed) {
      throw new ForbiddenException(`Permission refusée : ${required}`);
    }
    return true;
  }
}

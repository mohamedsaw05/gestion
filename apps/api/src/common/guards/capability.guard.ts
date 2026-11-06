import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { CapabilityKey } from '@gestionnaire/db';
import { CAPABILITY_KEY } from '../decorators/require-capability.decorator.js';
import { BusinessProfileService } from '../../business-profile/business-profile.service.js';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Vérifie que CE commerce a activé la capability requise — cf
 * docs de continuation §6/§19 (fail-closed : capability non activée = refus,
 * jamais une supposition à `true`). S'exécute après JwtAuthGuard et AVANT
 * PermissionGuard (ordre déclaré dans app.module.ts) : un commerce qui n'a
 * pas activé le crédit bloque la route même pour un propriétaire ayant tous
 * les droits — la capability est un prérequis du commerce, pas un droit
 * utilisateur.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly businessProfile: BusinessProfileService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<CapabilityKey | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.authUser;
    if (!user) {
      throw new ForbiddenException('Contexte utilisateur manquant');
    }

    const enabled = await this.businessProfile.isCapabilityEnabled(user.tenantId, required);
    if (!enabled) {
      throw new ForbiddenException(
        `Fonctionnalité non activée pour ce commerce : ${required} (cf Profil du commerce)`,
      );
    }
    return true;
  }
}

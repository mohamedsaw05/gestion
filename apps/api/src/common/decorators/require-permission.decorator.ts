import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@gestionnaire/db';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Déclare la permission atomique requise pour cette route (cf
 * docs/architecture/08-roles-permissions.md). Vérifiée par PermissionGuard,
 * qui déduit aussi le scope de localisation depuis `body.locationId` ou
 * `query.locationId` s'il est présent.
 */
export const RequirePermission = (permission: PermissionKey) => SetMetadata(PERMISSION_KEY, permission);

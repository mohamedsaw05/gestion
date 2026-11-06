import { SetMetadata } from '@nestjs/common';
import type { CapabilityKey } from '@gestionnaire/db';

export const CAPABILITY_KEY = 'requiredCapability';

/**
 * Déclare la capability requise pour cette route — DISTINCTE d'une permission
 * (cf docs de continuation §6/§12) : une capability est un prérequis du
 * COMMERCE (le module a-t-il été activé pour ce tenant ?), une permission est
 * un droit de CET utilisateur. Les deux sont vérifiées indépendamment
 * (CapabilityGuard puis PermissionGuard) — un utilisateur avec toutes les
 * permissions reste bloqué si le commerce n'a pas activé la capability.
 */
export const RequireCapability = (capability: CapabilityKey) =>
  SetMetadata(CAPABILITY_KEY, capability);

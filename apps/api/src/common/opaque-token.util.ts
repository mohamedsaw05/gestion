import { createHash, randomBytes } from 'node:crypto';

/** Génère un secret opaque à haute entropie (32 octets) — refresh tokens, invitations. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Un token opaque est déjà une valeur aléatoire à haute entropie : un hash
 * rapide (sha256) suffit pour le stocker de façon irréversible, contrairement
 * au mot de passe utilisateur qui, lui, utilise argon2 (cf
 * docs/architecture/07-securite.md §1). Partagé entre refresh tokens
 * (AuthService) et invitations (InvitationsService) — même garantie, même
 * implémentation, pas de duplication.
 */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

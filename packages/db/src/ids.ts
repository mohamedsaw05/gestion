import { randomUUID } from 'node:crypto';
import { uuidv7 } from 'uuidv7';

/**
 * Identifiant pour les entités "racine" non concernées par l'offline
 * (Tenant, User, Role, Product, Category, Customer, Location...).
 */
export function newId(): string {
  return randomUUID();
}

/**
 * UUID v7 (ordonnable temporellement) pour les entités transactionnelles qui devront,
 * plus tard, pouvoir être créées côté client desktop avant toute synchronisation
 * (Sale, SaleLine, Payment, StockMovement, OutboxEvent, AuditLog) — cf
 * docs/architecture/03-modele-donnees.md §3.7.
 */
export function newTransactionalId(): string {
  return uuidv7();
}

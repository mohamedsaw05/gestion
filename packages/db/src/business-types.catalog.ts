/**
 * Types de commerce — INDICATIF UNIQUEMENT (cf demande §4) : sert à
 * pré-cocher des capabilities suggérées dans l'assistant de configuration.
 * Ne doit JAMAIS être utilisé comme condition dans le code métier
 * (pas de `if businessType === 'RESTAURANT'` dans un moteur) — c'est le
 * système de capabilities qui pilote le comportement réel, pas ce champ.
 */
import { CAPABILITIES, type CapabilityKey } from './capabilities.catalog';

export interface BusinessTypeDefinition {
  value: string;
  label: string;
  suggestedCapabilities: CapabilityKey[];
}

export const BUSINESS_TYPES: BusinessTypeDefinition[] = [
  {
    value: 'BOUTIQUE',
    label: 'Boutique / commerce général',
    suggestedCapabilities: [CAPABILITIES.INVENTORY, CAPABILITIES.RECEIPTS],
  },
  {
    value: 'ELECTRONICS',
    label: 'Électronique / informatique',
    suggestedCapabilities: [
      CAPABILITIES.INVENTORY,
      CAPABILITIES.SERVICES,
      CAPABILITIES.SERIAL_NUMBERS,
      CAPABILITIES.CUSTOM_PRICING,
      CAPABILITIES.RECEIPTS,
    ],
  },
  {
    value: 'CLOTHING',
    label: 'Vêtements',
    suggestedCapabilities: [CAPABILITIES.INVENTORY, CAPABILITIES.VARIANTS, CAPABILITIES.RECEIPTS],
  },
  {
    value: 'RESTAURANT',
    label: 'Restaurant',
    suggestedCapabilities: [CAPABILITIES.INVENTORY, CAPABILITIES.RECEIPTS],
  },
  {
    value: 'PHARMACY',
    label: 'Pharmacie',
    suggestedCapabilities: [CAPABILITIES.INVENTORY, CAPABILITIES.RECEIPTS],
  },
  {
    value: 'SPARE_PARTS',
    label: 'Pièces détachées',
    suggestedCapabilities: [CAPABILITIES.INVENTORY, CAPABILITIES.CUSTOM_PRICING, CAPABILITIES.RECEIPTS],
  },
  {
    value: 'WHOLESALE',
    label: 'Grossiste',
    suggestedCapabilities: [
      CAPABILITIES.INVENTORY,
      CAPABILITIES.MULTIPLE_LOCATIONS,
      CAPABILITIES.CUSTOM_PRICING,
      CAPABILITIES.CUSTOMER_CREDIT,
      CAPABILITIES.RECEIPTS,
    ],
  },
  {
    value: 'SERVICES',
    label: 'Prestataire de services',
    suggestedCapabilities: [CAPABILITIES.SERVICES, CAPABILITIES.RECEIPTS],
  },
  {
    value: 'ECOMMERCE',
    label: 'Commerce en ligne',
    suggestedCapabilities: [CAPABILITIES.INVENTORY, CAPABILITIES.RECEIPTS, CAPABILITIES.DELIVERY],
  },
  {
    value: 'OTHER',
    label: 'Autre',
    suggestedCapabilities: [CAPABILITIES.RECEIPTS],
  },
];

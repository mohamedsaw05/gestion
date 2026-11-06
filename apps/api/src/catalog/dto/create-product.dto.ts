import { IsBoolean, IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export const PRODUCT_TYPES = ['PHYSICAL', 'SERVICE', 'BUNDLE'] as const;

export class CreateProductDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsString()
  unit!: string;

  // Chaîne plutôt que number : évite toute perte de précision flottante avant
  // conversion en Prisma.Decimal (cf docs/architecture/03-modele-donnees.md §3.8).
  @IsNumberString()
  basePrice!: string;

  @IsOptional()
  @IsNumberString()
  costPrice?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  // PHYSICAL (défaut) | SERVICE | BUNDLE — cf docs/architecture/02-moteurs.md §6.
  // SERVICE et BUNDLE forcent isStocked=false (cf CatalogService.create).
  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: (typeof PRODUCT_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isStocked?: boolean;

  // Phase 12, capability "serial_numbers" — n'a de sens que pour un PHYSICAL
  // stocké ; modifiable seulement à la création pour cette phase (changer
  // d'avis après coup sur un produit déjà vendu poserait la question du
  // stock existant non identifié, laissée PLANNED).
  @IsOptional()
  @IsBoolean()
  tracksSerialNumbers?: boolean;

  // Phase 13, capability "batch_tracking" — mutuellement exclusif avec
  // tracksSerialNumbers (un produit suit soit des unités individuelles,
  // soit des lots groupés, jamais les deux à la fois).
  @IsOptional()
  @IsBoolean()
  tracksBatches?: boolean;
}

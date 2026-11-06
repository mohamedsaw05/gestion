import { IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  locationId!: string;

  @IsUUID()
  productId!: string;

  // Signé : positif = entrée, négatif = sortie. Chaîne pour préserver la précision
  // décimale exacte (cf docs/architecture/03-modele-donnees.md §3.8).
  @IsNumberString()
  quantityDelta!: string;

  @IsIn(['adjustment', 'purchase_receipt', 'return'])
  movementType!: 'adjustment' | 'purchase_receipt' | 'return';

  @IsOptional()
  @IsString()
  reason?: string;
}

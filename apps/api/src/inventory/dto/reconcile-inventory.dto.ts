import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumberString, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class ReconcileInventoryItemDto {
  @IsUUID()
  productId!: string;

  // Quantité physique réellement constatée (>= 0)
  @IsNumberString()
  countedQuantity!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReconcileInventoryDto {
  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReconcileInventoryItemDto)
  items!: ReconcileInventoryItemDto[];
}

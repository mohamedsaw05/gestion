import { Type } from 'class-transformer';
import { ArrayMinSize, IsNumberString, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class CreatePurchaseOrderLineDto {
  @IsUUID()
  productId!: string;

  @IsNumberString()
  quantity!: string;

  // Coût unitaire d'achat — saisi manuellement (le Product n'a pas encore de
  // "prix de revient" par défaut, cf commentaire du modèle PurchaseOrderLine).
  @IsNumberString()
  unitCost!: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsUUID()
  operationId!: string;

  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  @ArrayMinSize(1)
  lines!: CreatePurchaseOrderLineDto[];
}

import { Type } from 'class-transformer';
import { ArrayMinSize, IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { PAYMENT_METHODS } from '../../sales/dto/create-sale.dto.js';

export class CreateReturnLineDto {
  @IsUUID()
  saleLineId!: string;

  @IsNumberString()
  quantity!: string;

  @IsIn(['GOOD', 'DEFECTIVE'])
  condition!: 'GOOD' | 'DEFECTIVE';

  // Requis exactement au nombre de `quantity` si le produit de cette ligne
  // suit les numéros de série (Phase 12) — doit correspondre à des numéros
  // réellement vendus SUR CETTE ligne de vente précise (traçabilité).
  @IsOptional()
  @IsString({ each: true })
  serialNumbers?: string[];
}

export class CreateReturnDto {
  @IsUUID()
  saleId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  // Absent = aucun remboursement traité par ce retour (échange en magasin
  // géré hors système pour cette phase — PLANNED).
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  refundMethod?: (typeof PAYMENT_METHODS)[number];

  @IsUUID()
  operationId!: string;

  @ValidateNested({ each: true })
  @Type(() => CreateReturnLineDto)
  @ArrayMinSize(1)
  lines!: CreateReturnLineDto[];
}

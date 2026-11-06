import { Type } from 'class-transformer';
import { ArrayMinSize, IsNumberString, IsUUID, ValidateNested } from 'class-validator';

export class CreateStockTransferLineDto {
  @IsUUID()
  productId!: string;

  @IsNumberString()
  quantity!: string;
}

export class CreateStockTransferDto {
  @IsUUID()
  fromLocationId!: string;

  @IsUUID()
  toLocationId!: string;

  @IsUUID()
  operationId!: string;

  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferLineDto)
  @ArrayMinSize(1)
  lines!: CreateStockTransferLineDto[];
}

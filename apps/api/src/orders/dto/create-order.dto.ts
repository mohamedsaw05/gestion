import { Type } from 'class-transformer';
import { ArrayMinSize, IsNumberString, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class CreateOrderLineDto {
  @IsUUID()
  productId!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateOrderDto {
  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsUUID()
  operationId!: string;

  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  @ArrayMinSize(1)
  lines!: CreateOrderLineDto[];
}

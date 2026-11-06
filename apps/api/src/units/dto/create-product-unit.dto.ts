import { IsNumberString, IsString, IsUUID } from 'class-validator';

export class CreateProductUnitDto {
  @IsUUID()
  productId!: string;

  @IsString()
  unit!: string;

  @IsNumberString()
  factor!: string;
}

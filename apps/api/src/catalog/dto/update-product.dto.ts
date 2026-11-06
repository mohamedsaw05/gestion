import { IsBoolean, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumberString()
  basePrice?: string;

  @IsOptional()
  @IsNumberString()
  costPrice?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isStocked?: boolean;
}

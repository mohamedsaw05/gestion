import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

class WarrantyIdentifierDto {
  @IsString() @MaxLength(80) type!: string;
  @IsString() @MaxLength(200) value!: string;
}

export class CreateWarrantyDto {
  @IsUUID() productId!: string;
  @IsUUID() locationId!: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsString() @MaxLength(200) customerName?: string;
  @IsOptional() @IsString() @MaxLength(60) customerPhone?: string;
  @IsOptional() @IsUUID() saleId?: string;
  @IsOptional() @IsString() @MaxLength(100) invoiceNumber?: string;
  @IsInt() @Min(1) durationMonths!: number;
  @IsOptional() @IsString() @MaxLength(80) warrantyType?: string;
  @IsOptional() @IsString() @MaxLength(4000) terms?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsString() @MaxLength(120) serialNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) lotNumber?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => WarrantyIdentifierDto) identifiers?: WarrantyIdentifierDto[];
}

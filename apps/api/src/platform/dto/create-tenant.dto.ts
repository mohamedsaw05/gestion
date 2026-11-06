import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsString()
  @MinLength(6)
  ownerPassword!: string;

  @IsOptional()
  @IsString()
  planKey?: string; // TRIAL | STARTER | PRO | ENTERPRISE

  @IsOptional()
  @IsString()
  businessType?: string; // BOUTIQUE | SERVICES | RESTAURANT | etc.

  @IsOptional()
  @IsString()
  initialStoreName?: string;
}

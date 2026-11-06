import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'GRACE_PERIOD'])
  status?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResetTenantPlatformDto {
  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  confirmationPhrase!: string;

  @IsOptional()
  backupConfirmed?: boolean;

  @IsOptional()
  confirmedScope?: string[];
}

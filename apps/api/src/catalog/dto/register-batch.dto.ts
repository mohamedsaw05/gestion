import { IsISO8601, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class RegisterBatchDto {
  @IsUUID()
  locationId!: string;

  @IsString()
  lotNumber!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

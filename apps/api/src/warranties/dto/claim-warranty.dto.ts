import { IsOptional, IsString } from 'class-validator';

export class ClaimWarrantyDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

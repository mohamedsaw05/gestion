import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSaasInvoiceDto {
  @IsInt()
  @IsIn([3, 6, 12, 24])
  durationMonths!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string; // MANUAL_TRANSFER | CASH | CARD | MOBILE_MONEY

  @IsOptional()
  @IsString()
  notes?: string;
}

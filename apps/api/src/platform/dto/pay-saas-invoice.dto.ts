import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PaySaasInvoiceDto {
  @IsString()
  @IsNotEmpty()
  paymentMethod!: string; // MANUAL_TRANSFER | CASH | CARD | MOBILE_MONEY

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

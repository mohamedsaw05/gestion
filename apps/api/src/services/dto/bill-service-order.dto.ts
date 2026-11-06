import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class BillServiceOrderDto {
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsNumberString()
  amountPaid?: string;
}

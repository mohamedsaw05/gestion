import { IsIn, IsNumberString } from 'class-validator';
import { PAYMENT_METHODS } from '../../sales/dto/create-sale.dto.js';

export class RecordRepaymentDto {
  @IsNumberString()
  amount!: string;

  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];
}

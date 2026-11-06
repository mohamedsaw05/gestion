import { IsIn, IsNumberString } from 'class-validator';

const PAYMENT_METHODS = ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK'] as const;

export class DepositOrderDto {
  @IsNumberString()
  amount!: string;

  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];
}

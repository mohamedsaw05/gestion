import { IsIn, IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RefundProgressiveDto {
  @IsUUID() operationId!: string;
  @IsNumberString() amount!: string;
  @IsIn(['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK']) method!: string;
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
}

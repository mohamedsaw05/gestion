import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class OpenCashSessionDto {
  @IsUUID()
  locationId!: string;

  @IsNumberString()
  openingFloat!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseCashSessionDto {
  @IsNumberString()
  countedAmount!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordCashMovementDto {
  @IsIn(['CASH_IN', 'CASH_OUT'])
  type!: 'CASH_IN' | 'CASH_OUT';

  @IsNumberString()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

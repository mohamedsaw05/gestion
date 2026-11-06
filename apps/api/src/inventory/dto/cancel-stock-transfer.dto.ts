import { IsOptional, IsString } from 'class-validator';

export class CancelStockTransferDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

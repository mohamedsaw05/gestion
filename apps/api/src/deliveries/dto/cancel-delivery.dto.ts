import { IsOptional, IsString } from 'class-validator';

export class CancelDeliveryDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

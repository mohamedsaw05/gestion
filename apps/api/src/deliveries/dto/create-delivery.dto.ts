import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDeliveryDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsISO8601()
  scheduledDate?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsUUID()
  operationId!: string;
}

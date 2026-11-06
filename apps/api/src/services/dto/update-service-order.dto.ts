import { IsDateString, IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { SERVICE_PRIORITIES, SERVICE_STATUSES } from './create-service-order.dto.js';

export class UpdateServiceOrderDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  diagnosisNotes?: string;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @IsOptional()
  @IsIn(SERVICE_STATUSES)
  status?: (typeof SERVICE_STATUSES)[number];

  @IsOptional()
  @IsIn(SERVICE_PRIORITIES)
  priority?: (typeof SERVICE_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualDurationMinutes?: number;

  @IsOptional()
  @IsNumberString()
  hourlyLaborRate?: string;

  @IsOptional()
  @IsNumberString()
  quotedPrice?: string;

  @IsOptional()
  @IsNumberString()
  finalPrice?: string;
}

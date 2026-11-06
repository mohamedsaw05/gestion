import { IsDateString, IsIn, IsInt, IsNumberString, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export const SERVICE_STATUSES = [
  'DRAFT',
  'QUALIFIED',
  'SCHEDULED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'BILLED',
  'CANCELLED',
] as const;

export const SERVICE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export class CreateServiceOrderDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  diagnosisNotes?: string;

  @IsOptional()
  @IsIn(SERVICE_PRIORITIES)
  priority?: (typeof SERVICE_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsUUID()
  locationId!: string;

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
  @IsNumberString()
  hourlyLaborRate?: string;

  @IsOptional()
  @IsNumberString()
  quotedPrice?: string;
}

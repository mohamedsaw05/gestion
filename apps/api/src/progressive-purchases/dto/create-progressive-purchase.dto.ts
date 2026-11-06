import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProgressivePurchaseDto {
  @IsUUID() locationId!: string;
  @IsUUID() customerId!: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

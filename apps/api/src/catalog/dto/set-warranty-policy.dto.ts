import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SetWarrantyPolicyDto {
  @IsInt()
  @Min(1)
  durationDays!: number;

  @IsOptional()
  @IsString()
  terms?: string;
}

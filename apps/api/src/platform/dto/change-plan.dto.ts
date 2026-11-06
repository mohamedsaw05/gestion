import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChangePlanDto {
  @IsString()
  @IsNotEmpty()
  planKey!: string; // TRIAL | STARTER | PRO | ENTERPRISE

  @IsOptional()
  @IsInt()
  @IsIn([3, 6, 12, 24])
  durationMonths?: number;
}

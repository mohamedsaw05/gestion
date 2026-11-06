import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class SimulateScheduleDto {
  @IsNumber()
  @Min(1)
  principal!: number;

  @IsNumber()
  @Min(0)
  rate!: number;

  @IsNumber()
  @Min(1)
  periods!: number;

  @IsOptional()
  @IsIn(['CONSTANT_ANNUITY', 'CONSTANT_CAPITAL', 'FREE_SCHEDULE'])
  method?: 'CONSTANT_ANNUITY' | 'CONSTANT_CAPITAL' | 'FREE_SCHEDULE';
}

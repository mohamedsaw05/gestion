import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ImportCustomersDto {
  @IsString()
  csvContent!: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

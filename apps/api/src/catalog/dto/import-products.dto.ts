import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ImportProductsDto {
  @IsString()
  csvContent!: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateWarrantyConfigurationDto {
  @IsOptional() @IsInt() @Min(1) defaultDurationMonths?: number;
  @IsOptional() @IsArray() @IsInt({ each: true }) allowedDurations?: number[];
  @IsOptional() @IsString() @MaxLength(80) defaultType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(80, { each: true }) types?: string[];
  @IsOptional() @IsString() @MaxLength(4000) terms?: string;
  @IsOptional() @IsString() @MaxLength(4000) exclusions?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) alertDays?: number[];
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) requiredDocuments?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true }) handlingModes?: string[];
  @IsOptional() @IsString() @MaxLength(40) timeZone?: string;
}

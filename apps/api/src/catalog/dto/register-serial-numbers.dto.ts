import { ArrayMinSize, IsString, IsUUID } from 'class-validator';

export class RegisterSerialNumbersDto {
  @IsUUID()
  locationId!: string;

  @IsString({ each: true })
  @ArrayMinSize(1)
  serials!: string[];
}

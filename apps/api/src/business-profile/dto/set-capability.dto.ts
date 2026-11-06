import { IsBoolean } from 'class-validator';

export class SetCapabilityDto {
  @IsBoolean()
  enabled!: boolean;
}

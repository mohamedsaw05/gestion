import { IsString } from 'class-validator';

export class FailDeliveryDto {
  @IsString()
  reason!: string;
}

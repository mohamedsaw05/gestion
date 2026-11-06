import { IsUUID } from 'class-validator';

export class SelectProgressiveProductDto {
  @IsUUID() productId!: string;
}

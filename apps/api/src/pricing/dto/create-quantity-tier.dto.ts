import { IsNumberString, IsUUID } from 'class-validator';

export class CreateQuantityTierDto {
  @IsUUID()
  productId!: string;

  @IsNumberString()
  minQuantity!: string;

  @IsNumberString()
  price!: string;
}

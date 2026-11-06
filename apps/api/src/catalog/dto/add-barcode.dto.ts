import { IsString, IsUUID } from 'class-validator';

export class AddBarcodeDto {
  @IsUUID()
  productId!: string;

  @IsString()
  code!: string;
}

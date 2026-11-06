import { IsNumberString, IsUUID } from 'class-validator';

export class UpsertCustomerOverrideDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  productId!: string;

  @IsNumberString()
  price!: string;
}

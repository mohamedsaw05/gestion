import { Type } from 'class-transformer';
import { ArrayMinSize, IsNumberString, IsUUID, ValidateNested } from 'class-validator';

export class ReceivePurchaseOrderLineDto {
  @IsUUID()
  purchaseOrderLineId!: string;

  @IsNumberString()
  quantity!: string;
}

export class ReceivePurchaseOrderDto {
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderLineDto)
  @ArrayMinSize(1)
  lines!: ReceivePurchaseOrderLineDto[];
}

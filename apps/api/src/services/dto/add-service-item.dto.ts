import { IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export const SERVICE_ITEM_TYPES = ['LABOR', 'PART', 'OTHER'] as const;

export class AddServiceItemDto {
  @IsIn(SERVICE_ITEM_TYPES)
  itemType!: (typeof SERVICE_ITEM_TYPES)[number];

  @IsString()
  name!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsNumberString()
  unitCost?: string;

  @IsNumberString()
  unitPrice!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}

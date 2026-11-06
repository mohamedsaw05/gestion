import { IsNumberString, IsUUID } from 'class-validator';

export class AddBundleComponentDto {
  @IsUUID()
  bundleProductId!: string;

  @IsUUID()
  componentProductId!: string;

  @IsNumberString()
  quantity!: string;
}

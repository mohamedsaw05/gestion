import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddProductAliasDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  alias!: string;
}

import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(['STORE', 'WAREHOUSE', 'PICKUP_POINT'])
  type!: string;
}

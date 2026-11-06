import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CloneRoleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

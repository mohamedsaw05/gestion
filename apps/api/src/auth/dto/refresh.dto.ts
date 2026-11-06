import { IsString, IsUUID } from 'class-validator';

export class RefreshDto {
  @IsUUID()
  tenantId!: string;

  @IsString()
  refreshToken!: string;
}

import { IsArray, IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';

const SCOPE_TYPES = ['ALL_LOCATIONS', 'LOCATIONS', 'OWN_RECORDS', 'TEAM'] as const;

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsUUID()
  roleId!: string;

  @IsIn(SCOPE_TYPES)
  scopeType!: (typeof SCOPE_TYPES)[number];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  scopeLocationIds?: string[];
}

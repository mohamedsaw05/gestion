import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ResetPlatformDto {
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe administrateur principal est obligatoire' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'La phrase de confirmation est obligatoire' })
  confirmationPhrase!: string;

  @IsOptional()
  @IsUUID('4', { message: 'L\'identifiant de tenant de démonstration doit être un UUID valide' })
  targetDemoTenantId?: string;
}

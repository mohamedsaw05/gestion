import { IsNotEmpty, IsString } from 'class-validator';

export class ResetTenantDto {
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe de confirmation est obligatoire' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'La phrase de confirmation est obligatoire' })
  confirmationPhrase!: string;
}

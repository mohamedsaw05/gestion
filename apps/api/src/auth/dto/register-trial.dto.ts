import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterTrialDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de votre commerce ou organisation est requis' })
  name!: string;

  @IsEmail({}, { message: 'Une adresse email valide est requise' })
  ownerEmail!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom du gérant ou responsable est requis' })
  ownerName!: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  ownerPassword!: string;

  @IsOptional()
  @IsString()
  businessType?: string; // BOUTIQUE, SERVICES, RESTAURANT, etc.
}

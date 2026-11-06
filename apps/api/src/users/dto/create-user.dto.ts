import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  /**
   * Optionnel : si omis, un mot de passe temporaire fort est généré côté
   * serveur et renvoyé UNE SEULE FOIS dans la réponse (jamais stocké en
   * clair, jamais journalisé) — pas de système d'invitation par email
   * fonctionnel dans cette phase (Notification Engine = PLANNED).
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

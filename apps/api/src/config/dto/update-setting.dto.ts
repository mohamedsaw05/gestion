import { IsDefined } from 'class-validator';

export class UpdateSettingDto {
  // Le type réel (string / boolean / string[]) dépend de la clé — validé au
  // runtime par ConfigurationService contre le catalogue, pas ici : @IsDefined()
  // sert uniquement à éviter que le ValidationPipe (whitelist: true) ne
  // supprime silencieusement ce champ faute de décorateur de type fixe.
  @IsDefined()
  value!: unknown;
}

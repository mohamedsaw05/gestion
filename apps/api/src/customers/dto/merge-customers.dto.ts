import { IsUUID } from 'class-validator';

export class MergeCustomersDto {
  // L'identifiant du contact doublon à absorber et archiver
  @IsUUID()
  sourceCustomerId!: string;

  // L'identifiant du contact principal cible qui conserve l'historique
  @IsUUID()
  targetCustomerId!: string;
}

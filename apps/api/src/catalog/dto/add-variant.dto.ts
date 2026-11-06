import { IsNumberString, IsObject, IsOptional, IsString } from 'class-validator';

export class AddVariantDto {
  @IsString()
  sku!: string;

  // ex: {"couleur":"Rouge","taille":"XL"} — figé sur la variante à la création.
  @IsObject()
  attributes!: Record<string, string>;

  @IsOptional()
  @IsString()
  name?: string;

  // Chaîne plutôt que number, cf CreateProductDto — si omis, hérite du prix du parent.
  @IsOptional()
  @IsNumberString()
  basePrice?: string;
}

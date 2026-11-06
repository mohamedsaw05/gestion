import { Type } from 'class-transformer';
import { IsIn, IsNumberString, IsOptional, ValidateNested } from 'class-validator';

const PAYMENT_METHODS = ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK'] as const;

export class CompleteOrderPaymentDto {
  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @IsNumberString()
  amount!: string;
}

export class CompleteOrderDto {
  // Paiements complémentaires au solde de l'acompte déjà enregistré (cf
  // Order.depositPaid) — jamais un montant total, seulement ce qui reste dû
  // au moment de la finalisation. Optionnel : une commande sans solde restant
  // (acompte = total) se complète sans rien fournir ici.
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CompleteOrderPaymentDto)
  payments?: CompleteOrderPaymentDto[];
}

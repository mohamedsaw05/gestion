import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateSaleLineDto {
  @IsUUID()
  productId!: string;

  @IsNumberString()
  quantity!: string;

  // Optionnel : unité dans laquelle `quantity` est exprimée (ex: "carton").
  // Si omise, l'unité de référence du produit est utilisée (comportement
  // historique). Doit être déclarée pour ce produit via ProductUnit sinon
  // rejetée — cf Unit/Conversion Engine.
  @IsOptional()
  @IsString()
  unit?: string;

  // Requis exactement au nombre de `quantity` unités si le produit suit les
  // numéros de série (Phase 12, capability "serial_numbers") — identifie
  // QUELLE unité physique précise est vendue, pas seulement combien.
  @IsOptional()
  @IsString({ each: true })
  serialNumbers?: string[];

  // Optionnel : prix unitaire convenu (ex: conversion d'un devis/commande négocié).
  // Permet de figer le prix négocié initial sans subir les hausses ultérieures du catalogue.
  @IsOptional()
  @IsNumberString()
  unitPriceOverride?: string;

  // Optionnel : remise commerciale sur la ligne en pourcentage (ex: "5" pour 5%)
  @IsOptional()
  @IsNumberString()
  discountPercent?: string;
}

export const PAYMENT_METHODS = ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK'] as const;

export class CreateSalePaymentDto {
  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @IsNumberString()
  amount!: string;

  // Optionnel : référence de transaction (obligatoire pour MOBILE_MONEY, CARD, CHECK, BANK_TRANSFER)
  @IsOptional()
  @IsString()
  reference?: string;

  // Optionnel : statut (COMPLETED par défaut, ou PENDING pour Mobile Money asynchrone)
  @IsOptional()
  @IsIn(['COMPLETED', 'PENDING', 'FAILED'])
  status?: 'COMPLETED' | 'PENDING' | 'FAILED';
}

export class ImmediateRestockLineDto {
  @IsUUID()
  productId!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsNumberString()
  costPrice?: string;
}

export class CreateSaleDto {
  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  // Optionnel depuis le Configuration Engine : si omis, résolu depuis
  // commerce.defaultCurrency (cf docs/architecture/02-moteurs.md §7).
  @IsOptional()
  @IsString()
  currency?: string;

  // Clé d'idempotence générée côté client — cf
  // docs/architecture/01-analyse-risques.md §4.4. Un renvoi (retry réseau) de la
  // même valeur ne crée jamais deux ventes.
  @IsUUID()
  operationId!: string;

  @ValidateNested({ each: true })
  @Type(() => CreateSaleLineDto)
  @ArrayMinSize(1)
  lines!: CreateSaleLineDto[];

  // Optionnel : si omis, la vente est considérée comme intégralement encaissée
  // en espèces (comportement historique, compatible avec les clients existants).
  // Paiement électronique asynchrone (webhook PSP) = PLANNED — un paiement fourni
  // ici est toujours considéré COMPLETED immédiatement.
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments?: CreateSalePaymentDto[];

  // Optionnel : approvisionnement immédiat tracé et contrôlé (Section 9 du CDC)
  // lorsque la marchandise physique est présente mais que le stock système est insuffisant.
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ImmediateRestockLineDto)
  immediateRestocks?: ImmediateRestockLineDto[];

  // Optionnel : montant remis par le client au comptoir (Décision 1 — Rendu de monnaie)
  // Permet de distinguer montant remis, montant affecté et monnaie rendue sans double comptage
  @IsOptional()
  @IsNumberString()
  tenderedAmount?: string;

  // Optionnel : remise globale en pourcentage sur le panier (Décision 5 — Remises contrôlées)
  @IsOptional()
  @IsNumberString()
  discountPercent?: string;

  @IsOptional()
  @IsString()
  discountReason?: string;

  // Optionnel : dérogation pour autoriser une vente sous le coût de revient (avec audit obligatoire)
  @IsOptional()
  overrideBelowCost?: boolean;

  @IsOptional()
  @IsString()
  belowCostReason?: string;
}


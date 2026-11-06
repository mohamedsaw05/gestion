import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class QuarantineOperationDto {
  @IsIn(['DIAGNOSTIC', 'REPAIR', 'RESTOCK', 'SUPPLIER_RETURN', 'EXCHANGE', 'SCRAP'], {
    message: 'Opération invalide : DIAGNOSTIC, REPAIR, RESTOCK, SUPPLIER_RETURN, EXCHANGE ou SCRAP',
  })
  operation: 'DIAGNOSTIC' | 'REPAIR' | 'RESTOCK' | 'SUPPLIER_RETURN' | 'EXCHANGE' | 'SCRAP';

  @IsUUID('4', { message: 'productId doit être un UUID valide' })
  productId: string;

  @IsUUID('4', { message: 'quarantineLocationId doit être un UUID valide' })
  quarantineLocationId: string;

  @IsNumberString({}, { message: 'quantity doit être une chaîne numérique décimale valide' })
  quantity: string;

  @IsOptional()
  @IsUUID('4', { message: 'targetLocationId doit être un UUID valide' })
  targetLocationId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'supplierId doit être un UUID valide' })
  supplierId?: string;

  @IsString({ message: 'notes / justification obligatoire' })
  @IsNotEmpty({ message: 'La justification ou le rapport technique est obligatoire' })
  notes: string;

  @IsOptional()
  @IsNumberString({}, { message: 'cost doit être un montant numérique valide' })
  cost?: string;
}

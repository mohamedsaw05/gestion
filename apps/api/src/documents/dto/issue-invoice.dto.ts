import { IsUUID } from 'class-validator';

export class IssueInvoiceDto {
  @IsUUID()
  saleId!: string;
}

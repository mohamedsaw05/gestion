import { IsUUID } from 'class-validator';

export class IssueQuoteDto {
  @IsUUID()
  orderId!: string;
}

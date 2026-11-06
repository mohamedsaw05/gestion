import { IsBoolean, IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateAutomationRuleDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsIn(['STOCK_LOW', 'EXPENSE_CREATED', 'PAYMENT_RECEIVED', 'ORDER_CONFIRMED', 'INVOICE_OVERDUE', 'CRON_DAILY'])
  trigger!: string;

  @IsNotEmpty()
  conditions!: Record<string, any>;

  @IsNotEmpty()
  actions!: Array<{ type: string; channel?: string; recipientRole?: string; message?: string }>;

  @IsOptional()
  @IsString()
  timeWindow?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TestAutomationRuleDto {
  @IsNotEmpty()
  mockPayload!: Record<string, any>;
}

export class AutomationFilterDto {
  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  @IsString()
  ruleId?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CAPABILITIES, PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { RequireCapability } from '../common/decorators/require-capability.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { CreditService } from './credit.service.js';
import { RecordRepaymentDto } from './dto/record-repayment.dto.js';
import { SimulateScheduleDto } from './dto/simulate-schedule.dto.js';

@Controller('credit')
@RequireCapability(CAPABILITIES.CUSTOMER_CREDIT)
export class CreditController {
  constructor(private readonly credit: CreditService) {}

  @Get('accounts')
  @RequirePermission(PERMISSIONS.CREDIT_READ)
  listAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.credit.listAccounts(user.tenantId);
  }

  @Get('accounts/:customerId')
  @RequirePermission(PERMISSIONS.CREDIT_READ)
  getAccount(@CurrentUser() user: AuthenticatedUser, @Param('customerId') customerId: string) {
    return this.credit.getAccount(user.tenantId, customerId);
  }

  @Get('accounts/:customerId/scoring')
  @RequirePermission(PERMISSIONS.CREDIT_READ)
  getCustomerScoring(@CurrentUser() user: AuthenticatedUser, @Param('customerId') customerId: string) {
    return this.credit.getCustomerScoring(user.tenantId, customerId);
  }

  @Post('simulation')
  @RequirePermission(PERMISSIONS.CREDIT_READ)
  simulateSchedule(@Body() dto: SimulateScheduleDto) {
    return this.credit.simulateSchedule(dto);
  }

  @Post('accounts/:customerId/payments')
  @RequirePermission(PERMISSIONS.CREDIT_MANAGE)
  recordRepayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() dto: RecordRepaymentDto,
  ) {
    return this.credit.recordRepayment(user.tenantId, customerId, new Prisma.Decimal(dto.amount), dto.method);
  }

  @Post('accounts/:customerId/reminder')
  @RequirePermission(PERMISSIONS.CREDIT_MANAGE)
  sendReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body('channel') channel?: 'INTERNAL' | 'EMAIL' | 'WHATSAPP',
  ) {
    return this.credit.sendReminder(user.tenantId, user.userId, customerId, channel ?? 'INTERNAL');
  }
}


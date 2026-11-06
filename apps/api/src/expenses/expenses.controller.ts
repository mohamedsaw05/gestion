import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { ExpensesService } from './expenses.service.js';
import { CreateExpenseDto, ExpenseFilterDto, RejectExpenseDto } from './dto/expense.dto.js';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.EXPENSES_READ)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ExpenseFilterDto) {
    return this.expenses.listExpenses(user.tenantId, query);
  }

  @Get('summary')
  @RequirePermission(PERMISSIONS.EXPENSES_READ)
  summary(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.expenses.getExpenseSummary(user.tenantId, { from, to });
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.EXPENSES_READ)
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.expenses.getExpenseDetail(user.tenantId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.EXPENSES_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.createExpense(user.tenantId, user.userId, dto);
  }

  @Patch(':id/approve')
  @RequirePermission(PERMISSIONS.EXPENSES_APPROVE)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.expenses.approveExpense(user.tenantId, user.userId, id);
  }

  @Patch(':id/reject')
  @RequirePermission(PERMISSIONS.EXPENSES_APPROVE)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RejectExpenseDto) {
    return this.expenses.rejectExpense(user.tenantId, user.userId, id, dto.reason);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.EXPENSES_DELETE)
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.expenses.deleteExpense(user.tenantId, id);
  }
}

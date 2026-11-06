import {
  Controller,
  Get,
  Header,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PERMISSIONS } from '@gestionnaire/db';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { ReportFilterDto } from './dto/report-filter.dto.js';
import { StockValuationFilterDto } from './dto/stock-valuation-filter.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermission(PERMISSIONS.REPORTS_SALES_READ)
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: ReportFilterDto,
  ) {
    return this.reports.getSummary(user.tenantId, user.userId, filter);
  }

  @Get('daily')
  @RequirePermission(PERMISSIONS.REPORTS_SALES_READ)
  getDaily(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: ReportFilterDto,
  ) {
    return this.reports.getDailySales(user.tenantId, user.userId, filter);
  }

  @Get('payment-methods')
  @RequirePermission(PERMISSIONS.REPORTS_FINANCIAL_READ)
  getByPaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: ReportFilterDto,
  ) {
    return this.reports.getByPaymentMethod(user.tenantId, user.userId, filter);
  }

  @Get('categories')
  @RequirePermission(PERMISSIONS.REPORTS_SALES_READ)
  getByCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: ReportFilterDto,
  ) {
    return this.reports.getByCategory(user.tenantId, user.userId, filter);
  }

  @Get('stock-valuation')
  @RequirePermission(PERMISSIONS.REPORTS_SALES_READ)
  getStockValuation(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: StockValuationFilterDto,
  ) {
    return this.reports.getStockValuation(user.tenantId, user.userId, filter);
  }

  @Get('export/stock-valuation.csv')
  @RequirePermission(PERMISSIONS.REPORTS_SALES_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="valorisation-stock.csv"')
  async exportStockValuationCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: StockValuationFilterDto,
    @Res() res: Response,
  ) {
    const csv = await this.reports.exportStockValuationCsv(user.tenantId, user.userId, filter);
    res.send(csv);
  }

  @Get('export/sales.csv')
  @RequirePermission(PERMISSIONS.REPORTS_SALES_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="rapport-ventes.csv"')
  async exportSalesCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: ReportFilterDto,
    @Res() res: Response,
  ) {
    const csv = await this.reports.exportSalesCsv(user.tenantId, user.userId, filter);
    res.send(csv);
  }
}

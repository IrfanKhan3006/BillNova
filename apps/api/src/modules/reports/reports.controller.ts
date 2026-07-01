import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/ jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Sales report (subtotal, tax, discount details) dekho' })
  async getSalesReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesReport(user.tenantId, startDate, endDate);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Customer outstanding aur pending invoice balances dekho' })
  async getCustomerReport(@CurrentUser() user: any) {
    return this.reportsService.getCustomerReport(user.tenantId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Payment history details aur summaries dekho' })
  async getPaymentReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPaymentReport(user.tenantId, startDate, endDate);
  }

  @Get('tax')
  @ApiOperation({ summary: 'Tax rates details breakdown (GSTR-1 data format) dekho' })
  async getTaxReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getTaxReport(user.tenantId, startDate, endDate);
  }
}

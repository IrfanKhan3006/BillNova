import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({
    summary: 'Get the sales report (subtotal, tax and discount)',
  })
  async getSalesReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesReport(
      user.tenantId,
      startDate,
      endDate,
    );
  }

  @Get('purchases')
  @ApiOperation({ summary: 'Get the purchase register (vendor bills)' })
  async getPurchaseReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPurchaseReport(
      user.tenantId,
      startDate,
      endDate,
    );
  }

  @Get('customers')
  @ApiOperation({
    summary: 'Get customer outstanding and pending invoice balances',
  })
  async getCustomerReport(@CurrentUser() user: any) {
    return this.reportsService.getCustomerReport(user.tenantId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get payment history and summaries' })
  async getPaymentReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPaymentReport(
      user.tenantId,
      startDate,
      endDate,
    );
  }

  @Get('revenue')
  @ApiOperation({
    summary:
      'Revenue dashboard: totals, growth, collections, outstanding, gross profit, top customers aur conversion',
  })
  async getRevenueReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('basis') basis?: string,
  ) {
    return this.reportsService.getRevenueReport(
      user.tenantId,
      startDate,
      endDate,
      basis === 'GROSS' ? 'GROSS' : 'NET',
    );
  }

  @Get('tax')
  @ApiOperation({
    summary: 'Get the tax-rate breakdown (GSTR-1 format)',
  })
  async getTaxReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getTaxReport(user.tenantId, startDate, endDate);
  }
}

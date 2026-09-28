import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Dashboard ke important metrics dekho' })
  async getMetrics(@CurrentUser() user: any) {
    return this.dashboardService.getMetrics(user.tenantId);
  }

  @Get('analytics')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({
    summary: 'Sales vs purchase analytics; mine=true limits it to bills created by the caller',
  })
  async getAnalytics(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('mine') mine?: string,
  ) {
    return this.dashboardService.getAnalytics(
      user.tenantId,
      mine === 'true' ? user.id : undefined,
      from,
      to,
    );
  }

  @Get('top-items')
  @ApiOperation({
    summary: 'Highest selling products aur high outstanding customers dekho',
  })
  async getTopItems(@CurrentUser() user: any) {
    return this.dashboardService.getTopItems(user.tenantId);
  }
}

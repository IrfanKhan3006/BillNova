import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Dashboard ke important metrics dekho' })
  async getMetrics(@CurrentUser() user: any) {
    return this.dashboardService.getMetrics(user.tenantId);
  }

  @Get('top-items')
  @ApiOperation({ summary: 'Highest selling products aur high outstanding customers dekho' })
  async getTopItems(@CurrentUser() user: any) {
    return this.dashboardService.getTopItems(user.tenantId);
  }
}

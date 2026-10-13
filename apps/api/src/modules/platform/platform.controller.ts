import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from '../admin/admin.service';
import { PlatformViewerGuard } from './platform-viewer.guard';

/**
 * Read-only mirror of the Super Admin's platform views, for the allowlisted
 * tenants in PlatformViewerGuard. Only GET routes live here on purpose: plans,
 * limits, feature access and deletions stay with the Super Admin under /admin.
 */
@ApiTags('Platform (read-only)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformViewerGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform-wide stats (read-only)' })
  async dashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Sabhi businesses ki list (read-only)' })
  async tenants() {
    return this.adminService.listTenants();
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Ek business ka detail (read-only)' })
  async tenant(@Param('id') id: string) {
    return this.adminService.getTenantDetail(id);
  }

  @Get('tenants/:id/invoices')
  @ApiOperation({ summary: 'Ek business ke invoices (read-only)' })
  async tenantInvoices(@Param('id') id: string) {
    return this.adminService.auditTenantInvoices(id);
  }
}

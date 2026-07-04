import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, TenantPlan } from '@prisma/client';
import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

export class UpdateTenantDto {
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @IsOptional()
  @IsBoolean()
  billingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  productsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  reportsEnabled?: boolean;
}

@ApiTags('Super Admin Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform statistics metrics dekho' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Sabhi businesses ki list dekho' })
  async listTenants() {
    return this.adminService.listTenants();
  }

  @Patch('tenants/:id')
  @ApiOperation({ summary: 'Kisi business ka plan ya features edit kro' })
  async updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.adminService.updateTenant(id, dto);
  }

  @Get('tenants/:id/invoices')
  @ApiOperation({ summary: 'Kisi specific business ke bills audit kro' })
  async auditInvoices(@Param('id') id: string) {
    return this.adminService.auditTenantInvoices(id);
  }

  @Delete('tenants/:id')
  @ApiOperation({ summary: 'Kisi business ko suspend/activate kro' })
  async suspendTenant(@Param('id') id: string) {
    return this.adminService.suspendTenant(id);
  }
}

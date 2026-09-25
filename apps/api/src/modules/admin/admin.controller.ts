import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, TenantPlan } from '@prisma/client';
import {
  IsEnum,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  IsNumber,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

export class UpdateTenantDto {
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @IsOptional()
  @IsString()
  subscriptionStatus?: string;

  @IsOptional()
  @IsString()
  planExpiresAt?: string;

  @IsOptional()
  @IsNumber()
  maxFreeInvoices?: number;

  @IsOptional()
  @IsNumber()
  planPrice?: number;

  @IsOptional()
  @IsBoolean()
  upgradeRequested?: boolean;

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

  @IsOptional()
  @IsBoolean()
  purchasesEnabled?: boolean;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsString()
  theme?: string;
}

export class ActivatePlanDto {
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @IsOptional()
  @IsNumber()
  price?: number;
}

export class ResetTrialDto {
  @IsOptional()
  @IsNumber()
  maxFreeInvoices?: number;
}

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
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

  @Get('requests')
  @ApiOperation({ summary: 'Businesses jinhone plan activation request ki hai unki list dekho' })
  async listUpgradeRequests() {
    return this.adminService.listUpgradeRequests();
  }

  @Delete('requests/:id')
  @ApiOperation({ summary: 'Dismiss/reject an activation request' })
  async dismissUpgradeRequest(@Param('id') id: string) {
    return this.adminService.dismissUpgradeRequest(id);
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

  @Post('tenants/:id/activate-plan')
  @ApiOperation({ summary: 'Super Admin: Business ka plan instantly activate kro (e.g. Basic ₹3,000/yr)' })
  async activatePlan(
    @Param('id') id: string,
    @Body() dto: ActivatePlanDto,
  ) {
    return this.adminService.activateTenantPlan(id, dto);
  }

  @Post('tenants/:id/reset-trial')
  @ApiOperation({ summary: 'Super Admin: Business ka trial reset ya custom free bills grant kro' })
  async resetTrial(
    @Param('id') id: string,
    @Body() dto: ResetTrialDto,
  ) {
    return this.adminService.resetTenantTrial(id, dto);
  }

  @Delete('tenants/:id')
  @ApiOperation({ summary: 'Kisi business ko suspend/activate kro' })
  async suspendTenant(@Param('id') id: string) {
    return this.adminService.suspendTenant(id);
  }

  @Patch('users/:id/password')
  @ApiOperation({ summary: 'Kisi user ka password change/reset kro' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return this.adminService.changeUserPassword(id, dto.password);
  }
}

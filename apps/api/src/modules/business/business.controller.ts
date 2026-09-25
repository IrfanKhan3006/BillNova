import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BusinessService } from './business.service';

import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  customHeaderUrl?: string;

  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @IsOptional()
  @IsNumber()
  dueDays?: number;

  @IsOptional()
  @IsString()
  invoiceTemplate?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankIfsc?: string;

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  theme?: string;
}

import { SubscriptionService } from '../subscription/subscription.service';

class RequestUpgradeDto {
  @IsOptional()
  @IsString()
  note?: string;
}

@ApiTags('Business')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('business')
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Apne business ka profile dekho' })
  async getProfile(@CurrentUser() user: any) {
    return this.businessService.getProfile(user.tenantId);
  }

  @Get('plan')
  @ApiOperation({ summary: 'Current business plan and bill usage metrics dekho' })
  async getPlanStatus(@CurrentUser() user: any) {
    return this.subscriptionService.getTenantPlanStatus(user.tenantId);
  }

  @Post('request-upgrade')
  @ApiOperation({ summary: 'Basic Plan (₹3,000/year) ke liye activation request send kro' })
  async requestUpgrade(
    @CurrentUser() user: any,
    @Body() dto: RequestUpgradeDto,
  ) {
    return this.subscriptionService.requestUpgrade(user.tenantId, dto.note);
  }

  @Get('gst-fetch/:gstin')
  @ApiOperation({ summary: 'Auto-fetch business details from GSTIN' })
  async gstFetch(@Param('gstin') gstin: string) {
    return this.businessService.gstFetch(gstin);
  }

  @Patch()
  @ApiOperation({ summary: 'Update business profile details' })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessService.updateProfile(user.tenantId, dto);
  }
}

import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BusinessService } from './business.service';

import { IsString, IsOptional, IsNumber } from 'class-validator';

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
  invoicePrefix?: string;

  @IsOptional()
  @IsNumber()
  dueDays?: number;

  @IsOptional()
  @IsString()
  invoiceTemplate?: string;
}

@ApiTags('Business')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  @ApiOperation({ summary: 'Apne business ka profile dekho' })
  async getProfile(@CurrentUser() user: any) {
    return this.businessService.getProfile(user.tenantId);
  }

  @Get('gst-fetch/:gstin')
  @ApiOperation({ summary: 'Auto-fetch business details from GSTIN' })
  async gstFetch(@Param('gstin') gstin: string) {
    return this.businessService.gstFetch(gstin);
  }

  @Patch()
  @ApiOperation({ summary: 'Apne business profile ko update karo' })
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateBusinessDto) {
    return this.businessService.updateProfile(user.tenantId, dto);
  }
}

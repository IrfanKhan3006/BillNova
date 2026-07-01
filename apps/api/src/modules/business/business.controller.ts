import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/ jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BusinessService } from './business.service';

class UpdateBusinessDto {
  name?: string;
  gstin?: string;
  stateCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  invoicePrefix?: string;
  dueDays?: number;
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

  @Patch()
  @ApiOperation({ summary: 'Apne business profile ko update karo' })
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateBusinessDto) {
    return this.businessService.updateProfile(user.tenantId, dto);
  }
}

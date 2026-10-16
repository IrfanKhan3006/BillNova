import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, QuotationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QuotationsService } from './quotations.service';

class QuotationItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  qty: number;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  discountRate?: number;

  @IsOptional()
  @IsString()
  hsnCode?: string;
}

class CreateQuotationDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  deliveryTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items: QuotationItemDto[];
}

class UpdateQuotationDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  deliveryTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items?: QuotationItemDto[];
}

@ApiTags('Quotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all quotations' })
  async list(
    @CurrentUser() user: any,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.quotationsService.list(
      user.tenantId,
      customerId,
      status,
      search,
    );
  }

  @Get(':id/share')
  @ApiOperation({
    summary: 'Quotation ka public share token (WhatsApp link ke liye) lo',
  })
  async share(@CurrentUser() user: any, @Param('id') id: string) {
    return this.quotationsService.ensureShareToken(user.tenantId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single quotation by ID' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.quotationsService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new quotation' })
  async create(@CurrentUser() user: any, @Body() dto: CreateQuotationDto) {
    return this.quotationsService.create(user.tenantId, dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a quotation or change its status' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.quotationsService.update(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a quotation' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.quotationsService.remove(user.tenantId, id);
  }
}

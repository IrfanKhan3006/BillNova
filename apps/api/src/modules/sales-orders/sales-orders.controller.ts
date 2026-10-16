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
import { Role, SalesOrderStatus, InvoiceStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SalesOrdersService } from './sales-orders.service';

class SalesOrderItemDto {
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

class CreateSalesOrderDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

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
  @IsString()
  shipToName?: string;

  @IsOptional()
  @IsString()
  shipToAddress?: string;

  @IsOptional()
  @IsString()
  shipToGstin?: string;

  @IsOptional()
  @IsString()
  shipToState?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items: SalesOrderItemDto[];
}

class UpdateSalesOrderDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

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
  @IsString()
  shipToName?: string;

  @IsOptional()
  @IsString()
  shipToAddress?: string;

  @IsOptional()
  @IsString()
  shipToGstin?: string;

  @IsOptional()
  @IsString()
  shipToState?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items?: SalesOrderItemDto[];
}

class ConvertQuotationDto {
  @IsString()
  quotationId: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

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
  @IsString()
  shipToName?: string;

  @IsOptional()
  @IsString()
  shipToAddress?: string;

  @IsOptional()
  @IsString()
  shipToGstin?: string;

  @IsOptional()
  @IsString()
  shipToState?: string;
}

class ConvertToInvoiceDto {
  @IsOptional()
  @IsString()
  date?: string;

  /** Status for the invoice being created, not for the sales order. */
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Sales Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all sales orders' })
  async list(
    @CurrentUser() user: any,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.salesOrdersService.list(
      user.tenantId,
      customerId,
      status,
      search,
    );
  }

  @Post('from-quotation')
  @ApiOperation({ summary: 'Create a sales order from an accepted quotation' })
  async createFromQuotation(
    @CurrentUser() user: any,
    @Body() dto: ConvertQuotationDto,
  ) {
    const { quotationId, ...overrides } = dto;
    return this.salesOrdersService.createFromQuotation(
      user.tenantId,
      quotationId,
      overrides,
      user.id,
    );
  }

  @Get(':id/share')
  @ApiOperation({
    summary: 'Sales order ka public share token (WhatsApp link ke liye) lo',
  })
  async share(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesOrdersService.ensureShareToken(user.tenantId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single sales order by ID' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesOrdersService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new sales order' })
  async create(@CurrentUser() user: any, @Body() dto: CreateSalesOrderDto) {
    return this.salesOrdersService.create(user.tenantId, dto, user.id);
  }

  @Post(':id/invoice')
  @ApiOperation({ summary: 'Bill a sales order; creates the invoice' })
  async convertToInvoice(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ConvertToInvoiceDto,
  ) {
    return this.salesOrdersService.convertToInvoice(
      user.tenantId,
      id,
      dto,
      user.id,
    );
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a sales order or change its status' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto,
  ) {
    return this.salesOrdersService.update(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sales order' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesOrdersService.remove(user.tenantId, id);
  }
}

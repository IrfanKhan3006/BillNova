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
  IsBoolean,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, PurchaseOrderStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PurchaseOrdersService } from './purchase-orders.service';

class PurchaseOrderItemDto {
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

class CreatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  vendorGstin?: string;

  @IsOptional()
  @IsString()
  vendorEmail?: string;

  @IsOptional()
  @IsString()
  vendorPhone?: string;

  @IsOptional()
  @IsString()
  vendorAddress?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}

class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];
}

class ApprovePurchaseOrderDto {
  @IsOptional()
  @IsString()
  approvedByName?: string;
}

class ReceivePurchaseOrderDto {
  @IsOptional()
  @IsString()
  billNumber?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  autoRestock?: boolean;

  @IsOptional()
  @IsNumber()
  amountPaid?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;
}

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all purchase orders' })
  async list(
    @CurrentUser() user: any,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.purchaseOrdersService.list(
      user.tenantId,
      vendorId,
      status,
      search,
    );
  }

  @Get(':id/share')
  @ApiOperation({
    summary: 'Purchase order ka public share token (WhatsApp link ke liye) lo',
  })
  async share(@CurrentUser() user: any, @Param('id') id: string) {
    return this.purchaseOrdersService.ensureShareToken(user.tenantId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single purchase order by ID' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.purchaseOrdersService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new purchase order' })
  async create(@CurrentUser() user: any, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(user.tenantId, dto, user.id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a purchase order before sending it out' })
  async approve(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ApprovePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.approve(
      user.tenantId,
      id,
      dto.approvedByName || user.email,
    );
  }

  @Post(':id/receive')
  @ApiOperation({
    summary: 'Receive a purchase order; records the supplier bill',
  })
  async receive(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.convertToPurchaseInvoice(
      user.tenantId,
      id,
      dto,
      user.id,
    );
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a purchase order or change its status' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a purchase order' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.purchaseOrdersService.remove(user.tenantId, id);
  }
}

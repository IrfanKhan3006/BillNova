import {
  Controller,
  Get,
  Post,
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
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PurchasesService } from './purchases.service';

class CreatePurchaseItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  name?: string;

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

class CreatePurchaseInvoiceDto {
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
  vendorPhone?: string;

  @IsOptional()
  @IsString()
  vendorAddress?: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsString()
  status?: string;

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

class CreateVendorDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;
}

class RecordPurchasePaymentDto {
  @IsString()
  vendorId: string;

  @IsOptional()
  @IsString()
  purchaseInvoiceId?: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  // ─── Purchase Invoices ──────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all purchase invoices' })
  async list(
    @CurrentUser() user: any,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.purchasesService.list(user.tenantId, vendorId, status, search);
  }

  @Get('vendors')
  @ApiOperation({ summary: 'List all vendors with outstanding balance' })
  async listVendors(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.purchasesService.listVendors(user.tenantId, search);
  }

  @Post('vendors')
  @ApiOperation({ summary: 'Create a new vendor' })
  async createVendor(@CurrentUser() user: any, @Body() dto: CreateVendorDto) {
    return this.purchasesService.createVendor(user.tenantId, dto);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record a payment made to a vendor' })
  async recordPayment(@CurrentUser() user: any, @Body() dto: RecordPurchasePaymentDto) {
    return this.purchasesService.recordPayment(user.tenantId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single purchase invoice by ID' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.purchasesService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Record a new purchase invoice/bill' })
  async create(@CurrentUser() user: any, @Body() dto: CreatePurchaseInvoiceDto) {
    return this.purchasesService.create(user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or void a purchase invoice' })
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.purchasesService.delete(user.tenantId, id);
  }
}

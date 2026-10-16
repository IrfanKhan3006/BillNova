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
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, ChallanStatus, InvoiceStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChallansService } from './challans.service';

const CHALLAN_TYPES = ['DELIVERY', 'JOB_WORK', 'SAMPLE', 'RETURNABLE'];

class ChallanItemDto {
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

class CreateChallanDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  salesOrderId?: string;

  @IsOptional()
  @IsString()
  date?: string;

  /** DISPATCHED or DELIVERED moves the stock out as the challan is saved. */
  @IsOptional()
  @IsEnum(ChallanStatus)
  status?: ChallanStatus;

  @IsOptional()
  @IsIn(CHALLAN_TYPES)
  challanType?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  despatchedThrough?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  termsOfDelivery?: string;

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
  @Type(() => ChallanItemDto)
  items: ChallanItemDto[];
}

class UpdateChallanDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(ChallanStatus)
  status?: ChallanStatus;

  @IsOptional()
  @IsIn(CHALLAN_TYPES)
  challanType?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  despatchedThrough?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  termsOfDelivery?: string;

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
  @Type(() => ChallanItemDto)
  items?: ChallanItemDto[];
}

class FromSalesOrderDto {
  @IsString()
  salesOrderId: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(ChallanStatus)
  status?: ChallanStatus;

  @IsOptional()
  @IsIn(CHALLAN_TYPES)
  challanType?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  despatchedThrough?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  termsOfDelivery?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  shipToName?: string;

  @IsOptional()
  @IsString()
  shipToAddress?: string;

  /** Only the lines being sent, for a part dispatch. Omit to send all. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChallanItemDto)
  items?: ChallanItemDto[];
}

class DispatchChallanDto {
  /** DISPATCHED (default) or DELIVERED. */
  @IsOptional()
  @IsEnum(ChallanStatus)
  status?: ChallanStatus;
}

class ConvertToInvoiceDto {
  @IsOptional()
  @IsString()
  date?: string;

  /** Status for the invoice being created, not for the challan. */
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Delivery Challans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('challans')
export class ChallansController {
  constructor(private readonly challansService: ChallansService) {}

  @Get()
  @ApiOperation({ summary: 'List all delivery challans' })
  async list(
    @CurrentUser() user: any,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.challansService.list(user.tenantId, customerId, status, search);
  }

  @Post('from-sales-order')
  @ApiOperation({ summary: 'Raise a delivery challan from a sales order' })
  async createFromSalesOrder(
    @CurrentUser() user: any,
    @Body() dto: FromSalesOrderDto,
  ) {
    const { salesOrderId, ...overrides } = dto;
    return this.challansService.createFromSalesOrder(
      user.tenantId,
      salesOrderId,
      overrides,
      user.id,
    );
  }

  @Get(':id/share')
  @ApiOperation({
    summary: 'Challan ka public share token (WhatsApp link ke liye) lo',
  })
  async share(@CurrentUser() user: any, @Param('id') id: string) {
    return this.challansService.ensureShareToken(user.tenantId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single delivery challan by ID' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.challansService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new delivery challan' })
  async create(@CurrentUser() user: any, @Body() dto: CreateChallanDto) {
    return this.challansService.create(user.tenantId, dto, user.id);
  }

  @Post(':id/dispatch')
  @ApiOperation({
    summary: 'Mark the goods as gone; this is when stock leaves',
  })
  async dispatch(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: DispatchChallanDto,
  ) {
    return this.challansService.dispatch(
      user.tenantId,
      id,
      dto.status || 'DISPATCHED',
    );
  }

  @Post(':id/invoice')
  @ApiOperation({ summary: 'Bill a delivery challan; creates the invoice' })
  async convertToInvoice(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ConvertToInvoiceDto,
  ) {
    return this.challansService.convertToInvoice(
      user.tenantId,
      id,
      dto,
      user.id,
    );
  }

  @Roles(Role.ADMIN)
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a delivery challan, returning any dispatched stock',
  })
  async cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.challansService.cancel(user.tenantId, id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a delivery challan' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateChallanDto,
  ) {
    return this.challansService.update(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a delivery challan' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.challansService.remove(user.tenantId, id);
  }
}

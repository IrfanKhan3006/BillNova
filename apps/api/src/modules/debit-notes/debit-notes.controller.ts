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
import { Role, DebitNoteStatus, NoteReason } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DebitNotesService } from './debit-notes.service';

class DebitNoteItemDto {
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

class CreateDebitNoteDto {
  @IsString()
  vendorId: string;

  /** The purchase bill being debited. Optional: may be raised standalone. */
  @IsOptional()
  @IsString()
  purchaseInvoiceId?: string;

  @IsOptional()
  @IsString()
  date?: string;

  /** Pass ISSUED to reduce the payable immediately on save. */
  @IsOptional()
  @IsEnum(DebitNoteStatus)
  status?: DebitNoteStatus;

  @IsOptional()
  @IsEnum(NoteReason)
  reason?: NoteReason;

  @IsOptional()
  @IsString()
  reasonNote?: string;

  @IsOptional()
  @IsBoolean()
  restock?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DebitNoteItemDto)
  items: DebitNoteItemDto[];
}

class UpdateDebitNoteDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(NoteReason)
  reason?: NoteReason;

  @IsOptional()
  @IsString()
  reasonNote?: string;

  @IsOptional()
  @IsBoolean()
  restock?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DebitNoteItemDto)
  items?: DebitNoteItemDto[];
}

class FromPurchaseInvoiceDto {
  @IsString()
  purchaseInvoiceId: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(DebitNoteStatus)
  status?: DebitNoteStatus;

  @IsOptional()
  @IsEnum(NoteReason)
  reason?: NoteReason;

  @IsOptional()
  @IsString()
  reasonNote?: string;

  @IsOptional()
  @IsBoolean()
  restock?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Only the lines going back, for a partial return. Omit for a full one. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DebitNoteItemDto)
  items?: DebitNoteItemDto[];
}

@ApiTags('Debit Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('debit-notes')
export class DebitNotesController {
  constructor(private readonly debitNotesService: DebitNotesService) {}

  @Get()
  @ApiOperation({ summary: 'List all debit notes' })
  async list(
    @CurrentUser() user: any,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.debitNotesService.list(user.tenantId, vendorId, status, search);
  }

  @Post('from-purchase-invoice')
  @ApiOperation({
    summary: 'Raise a debit note against a purchase bill (purchase return)',
  })
  async createFromPurchaseInvoice(
    @CurrentUser() user: any,
    @Body() dto: FromPurchaseInvoiceDto,
  ) {
    const { purchaseInvoiceId, ...overrides } = dto;
    return this.debitNotesService.createFromPurchaseInvoice(
      user.tenantId,
      purchaseInvoiceId,
      overrides,
      user.id,
    );
  }

  @Get(':id/share')
  @ApiOperation({
    summary: 'Debit note ka public share token (WhatsApp link ke liye) lo',
  })
  async share(@CurrentUser() user: any, @Param('id') id: string) {
    return this.debitNotesService.ensureShareToken(user.tenantId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single debit note by ID' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.debitNotesService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new debit note' })
  async create(@CurrentUser() user: any, @Body() dto: CreateDebitNoteDto) {
    return this.debitNotesService.create(user.tenantId, dto, user.id);
  }

  @Post(':id/issue')
  @ApiOperation({
    summary: 'Issue a debit note; reduces the vendor payable and stock',
  })
  async issue(@CurrentUser() user: any, @Param('id') id: string) {
    return this.debitNotesService.issue(user.tenantId, id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a debit note, reversing the debit' })
  async cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.debitNotesService.cancel(user.tenantId, id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft debit note' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDebitNoteDto,
  ) {
    return this.debitNotesService.update(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a draft debit note' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.debitNotesService.remove(user.tenantId, id);
  }
}

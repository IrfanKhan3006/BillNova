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
import { Role, CreditNoteStatus, NoteReason } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreditNotesService } from './credit-notes.service';

class CreditNoteItemDto {
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

class CreateCreditNoteDto {
  @IsString()
  customerId: string;

  /** The bill being credited. Optional: a note may be raised standalone. */
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  date?: string;

  /** Pass ISSUED to credit the customer immediately on save. */
  @IsOptional()
  @IsEnum(CreditNoteStatus)
  status?: CreditNoteStatus;

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
  @Type(() => CreditNoteItemDto)
  items: CreditNoteItemDto[];
}

class UpdateCreditNoteDto {
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
  @Type(() => CreditNoteItemDto)
  items?: CreditNoteItemDto[];
}

class FromInvoiceDto {
  @IsString()
  invoiceId: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(CreditNoteStatus)
  status?: CreditNoteStatus;

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

  /** Only the lines coming back, for a partial return. Omit for a full one. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditNoteItemDto)
  items?: CreditNoteItemDto[];
}

@ApiTags('Credit Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('credit-notes')
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Get()
  @ApiOperation({ summary: 'List all credit notes' })
  async list(
    @CurrentUser() user: any,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.creditNotesService.list(
      user.tenantId,
      customerId,
      status,
      search,
    );
  }

  @Post('from-invoice')
  @ApiOperation({
    summary: 'Raise a credit note against a bill (sales return)',
  })
  async createFromInvoice(
    @CurrentUser() user: any,
    @Body() dto: FromInvoiceDto,
  ) {
    const { invoiceId, ...overrides } = dto;
    return this.creditNotesService.createFromInvoice(
      user.tenantId,
      invoiceId,
      overrides,
      user.id,
    );
  }

  @Get(':id/share')
  @ApiOperation({
    summary: 'Credit note ka public share token (WhatsApp link ke liye) lo',
  })
  async share(@CurrentUser() user: any, @Param('id') id: string) {
    return this.creditNotesService.ensureShareToken(user.tenantId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single credit note by ID' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.creditNotesService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new credit note' })
  async create(@CurrentUser() user: any, @Body() dto: CreateCreditNoteDto) {
    return this.creditNotesService.create(user.tenantId, dto, user.id);
  }

  @Post(':id/issue')
  @ApiOperation({
    summary:
      'Issue a credit note; credits the customer and restocks the return',
  })
  async issue(@CurrentUser() user: any, @Param('id') id: string) {
    return this.creditNotesService.issue(user.tenantId, id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a credit note, reversing the credit' })
  async cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.creditNotesService.cancel(user.tenantId, id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft credit note' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCreditNoteDto,
  ) {
    return this.creditNotesService.update(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a draft credit note' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.creditNotesService.remove(user.tenantId, id);
  }
}

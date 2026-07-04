import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
  UPI = 'UPI',
  OTHER = 'OTHER',
}

class RecordPaymentDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Sabhi payments ki history dekho' })
  async list(@CurrentUser() user: any, @Query('customerId') customerId?: string) {
    return this.paymentsService.list(user.tenantId, customerId);
  }

  @Get('invoice/:invoiceId')
  @ApiOperation({ summary: 'Ek invoice ke saare payments dekho' })
  async findByInvoice(
    @CurrentUser() user: any,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.paymentsService.findByInvoice(user.tenantId, invoiceId);
  }

  @Post()
  @ApiOperation({ summary: 'Naya payment record karo' })
  async create(@CurrentUser() user: any, @Body() dto: RecordPaymentDto) {
    return this.paymentsService.create(user.tenantId, dto);
  }
}

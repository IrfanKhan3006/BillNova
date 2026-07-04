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
import { IsString, IsEmail, IsOptional, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CustomersService } from './customers.service';

class CreateCustomerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
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
  @IsNumber()
  outstandingBalance?: number;
}

class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
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
  @IsNumber()
  outstandingBalance?: number;
}

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Sabhi customers ki list dekho' })
  async list(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.customersService.list(user.tenantId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ek customer ka details dekho' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Naya customer add karo' })
  async create(@CurrentUser() user: any, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Customer details update karo' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Customer ko delete karo' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.remove(user.tenantId, id);
  }

  @Get(':id/ledger')
  @ApiOperation({ summary: 'Customer ka complete ledger (ledger transactions) dekho' })
  async getLedger(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.getLedger(user.tenantId, id);
  }
}

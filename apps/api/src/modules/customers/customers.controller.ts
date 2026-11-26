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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
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
  @IsString()
  notes?: string;

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
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  outstandingBalance?: number;
}

class CustomerCommentDto {
  @IsString()
  body: string;
}

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @ApiOperation({ summary: 'Add a new customer' })
  async create(@CurrentUser() user: any, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.tenantId, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update customer details' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a customer' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.remove(user.tenantId, id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Customer ke saare comments (newest pehle)' })
  async listComments(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.listComments(user.tenantId, id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Customer par ek naya comment add karo' })
  async addComment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CustomerCommentDto,
  ) {
    return this.customersService.addComment(
      user.tenantId,
      id,
      dto.body,
      user.id,
    );
  }

  @Delete(':id/comments/:commentId')
  @ApiOperation({ summary: 'Ek comment hatao' })
  async removeComment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.customersService.removeComment(user.tenantId, id, commentId);
  }

  @Get(':id/ledger')
  @ApiOperation({
    summary: 'Customer ka complete ledger (ledger transactions) dekho',
  })
  async getLedger(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.getLedger(user.tenantId, id);
  }
}

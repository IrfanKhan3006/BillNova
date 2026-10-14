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
import { IsString, IsOptional, IsIn } from 'class-validator';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppointmentsService } from './appointments.service';

const STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

class CreateAppointmentDto {
  @IsString()
  customerId: string;

  @IsString()
  service: string;

  @IsOptional()
  @IsString()
  staffName?: string;

  /** ISO date-time string for the appointment's start. */
  @IsString()
  startsAt: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: string;
}

class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsString()
  staffName?: string;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;
}

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.USER)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Appointments ki list dekho' })
  async list(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.appointmentsService.list(user.tenantId, { status, from, to, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ek appointment ka detail dekho' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.appointmentsService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Naya appointment book karo' })
  async create(@CurrentUser() user: any, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user.tenantId, dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Appointment update karo (reschedule / status)' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Appointment delete karo' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.appointmentsService.remove(user.tenantId, id);
  }
}

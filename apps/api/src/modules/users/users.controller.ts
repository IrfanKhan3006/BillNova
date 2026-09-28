import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';

export class CreateTeamUserDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(2)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class TeamUserPasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}

@ApiTags('Team Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Business ke team users (max 2) ki list' })
  async list(@CurrentUser() user: any) {
    return this.usersService.listTeam(user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Naya team user banao (username@business.com)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateTeamUserDto) {
    return this.usersService.createTeamUser(user.tenantId, dto);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Team user ka password badlo' })
  async changePassword(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: TeamUserPasswordDto,
  ) {
    return this.usersService.changeTeamUserPassword(user.tenantId, id, dto.password);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Team user hatao' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.usersService.removeTeamUser(user.tenantId, id);
  }
}

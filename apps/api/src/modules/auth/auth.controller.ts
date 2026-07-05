import {
  Controller, Post, Get, Body,
  HttpCode, HttpStatus, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';  // ye line hatao
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard, Public } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create a new business account' })
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.authService.register(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and login' })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh authentication access token' })
  async refresh(@Body() dto: RefreshDto, @Req() req: any) {
    return this.authService.refreshTokens(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out from this device' })
  async logout(@CurrentUser() user: any, @Body() dto: RefreshDto) {
    await this.authService.logout(user.id, dto.refreshToken);
    return { message: 'Logout ho gaye.' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out from all active devices' })
  async logoutAll(@CurrentUser() user: any) {
    await this.authService.logoutAll(user.id);
    return { message: 'Sabhi devices se logout ho gaye.' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve current user profile' })
  async getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.id);
  }
}
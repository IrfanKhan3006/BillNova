import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token jo login pe mila tha' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
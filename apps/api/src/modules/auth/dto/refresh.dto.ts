import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ description: 'The refresh token returned at login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

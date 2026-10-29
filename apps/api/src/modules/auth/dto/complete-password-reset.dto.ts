import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompletePasswordResetDto {
  @ApiProperty({ description: 'The token from the reset link' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPass@123' })
  @IsString()
  @MinLength(6, { message: 'Password kam se kam 6 characters ka hona chahiye' })
  password: string;
}

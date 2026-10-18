import { IsEmail, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailOtpDto {
  @ApiProperty({ example: 'rajesh@sharmatraders.com' })
  @IsEmail({}, { message: 'Valid email dalo' })
  email: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: '6-digit OTP code dalo' })
  code: string;
}

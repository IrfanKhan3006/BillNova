import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendEmailOtpDto {
  @ApiProperty({ example: 'rajesh@sharmatraders.com' })
  @IsEmail({}, { message: 'Valid email dalo' })
  email: string;
}

import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'rajesh@sharmatraders.com' })
  @IsEmail({}, { message: 'Valid email dalo' })
  email: string;

  @ApiProperty({ example: 'MyPass@123' })
  @IsString()
  @MinLength(1, { message: 'Password cannot be empty.' })
  password: string;
}
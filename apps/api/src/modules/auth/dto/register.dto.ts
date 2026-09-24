import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Sharma Traders' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessName: string;

  @ApiProperty({ example: 'Rajesh Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ownerName: string;

  @ApiProperty({ example: 'rajesh@sharmatraders.com' })
  @IsEmail({}, { message: 'Valid email dalo' })
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6, { message: 'Password kam se kam 6 characters ka hona chahiye' })
  @MaxLength(100)
  password: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{10,15}$/, {
    message: 'Valid 10-digit phone number dalo',
  })
  phone?: string;
}

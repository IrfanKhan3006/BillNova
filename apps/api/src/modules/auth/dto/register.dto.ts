import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
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

  @ApiProperty({ example: 'MyPass@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/[A-Z]/, { message: 'Kam se kam ek uppercase letter hona chahiye' })
  @Matches(/[0-9]/, { message: 'Kam se kam ek number hona chahiye' })
  password: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Valid Indian mobile number dalo' })
  phone?: string;
}
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Global module configuration
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
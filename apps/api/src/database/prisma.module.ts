import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Global rakho — har module mein import nahi karna padega
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
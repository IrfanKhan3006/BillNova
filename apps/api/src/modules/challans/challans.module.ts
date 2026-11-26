import { Module } from '@nestjs/common';
import { ChallansController } from './challans.controller';
import { ChallansService } from './challans.service';
import { PrismaModule } from '../../database/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [PrismaModule, InvoicesModule],
  controllers: [ChallansController],
  providers: [ChallansService],
  exports: [ChallansService],
})
export class ChallansModule {}

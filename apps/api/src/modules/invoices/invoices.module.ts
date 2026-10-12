import { Module } from '@nestjs/common';
import {
  InvoicesController,
  PublicBillsController,
} from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PrismaModule } from '../../database/prisma.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [PrismaModule, SubscriptionModule],
  controllers: [InvoicesController, PublicBillsController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}

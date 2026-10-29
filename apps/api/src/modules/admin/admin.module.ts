import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../../database/prisma.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [PrismaModule, SubscriptionModule, InvoicesModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

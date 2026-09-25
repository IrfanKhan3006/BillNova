import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { SubscriptionService } from './subscription.service';
import { PlanLimitGuard } from './guards/plan-limit.guard';

@Module({
  imports: [PrismaModule],
  providers: [SubscriptionService, PlanLimitGuard],
  exports: [SubscriptionService, PlanLimitGuard],
})
export class SubscriptionModule {}

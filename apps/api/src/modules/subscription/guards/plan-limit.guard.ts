import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionService } from '../subscription.service';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Super Admins bypass plan limit gating
    if (!user || user.role === 'SUPER_ADMIN') {
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required.');
    }

    // Asserts can create invoice/write CRUD - throws 402 if limit is exceeded
    await this.subscriptionService.assertCanCreateInvoice(user.tenantId);

    return true;
  }
}

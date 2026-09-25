import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantPlan } from '@prisma/client';

export interface PlanStatusResponse {
  tenantId: string;
  tenantName: string;
  plan: TenantPlan;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  invoicesCount: number;
  maxFreeInvoices: number;
  invoicesRemaining: number;
  isLimitReached: boolean;
  isExpired: boolean;
  planExpiresAt: Date | null;
  daysRemaining: number | null;
  planPrice: number;
  subscriptionPeriod: string;
  upgradeRequested: boolean;
  upgradeRequestedAt: Date | null;
}

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get detailed plan and subscription status for a tenant
   */
  async getTenantPlanStatus(tenantId: string): Promise<PlanStatusResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        planExpiresAt: true,
        maxFreeInvoices: true,
        planPrice: true,
        upgradeRequested: true,
        upgradeRequestedAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    const invoicesCount = await this.prisma.invoice.count({
      where: { tenantId, deletedAt: null },
    });

    const now = new Date();
    const isPaidPlan = tenant.plan !== TenantPlan.FREE;
    let isExpired = false;
    let daysRemaining: number | null = null;

    if (isPaidPlan && tenant.planExpiresAt) {
      const expiry = new Date(tenant.planExpiresAt);
      const diffMs = expiry.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      isExpired = diffMs <= 0;
    }

    let isLimitReached = false;
    let effectiveStatus: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' =
      (tenant.subscriptionStatus as any) || 'TRIAL';

    if (tenant.plan === TenantPlan.FREE) {
      isLimitReached = invoicesCount >= tenant.maxFreeInvoices;
      if (isLimitReached) {
        effectiveStatus = 'EXPIRED';
      } else {
        effectiveStatus = 'TRIAL';
      }
    } else {
      if (isExpired || tenant.subscriptionStatus === 'EXPIRED') {
        isLimitReached = true;
        effectiveStatus = 'EXPIRED';
      } else {
        effectiveStatus = 'ACTIVE';
        isLimitReached = false;
      }
    }

    const invoicesRemaining =
      tenant.plan === TenantPlan.FREE
        ? Math.max(0, tenant.maxFreeInvoices - invoicesCount)
        : 999999;

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      plan: tenant.plan,
      subscriptionStatus: effectiveStatus,
      invoicesCount,
      maxFreeInvoices: tenant.maxFreeInvoices,
      invoicesRemaining,
      isLimitReached,
      isExpired,
      planExpiresAt: tenant.planExpiresAt,
      daysRemaining,
      planPrice: tenant.planPrice || 3000,
      subscriptionPeriod: '1 Year',
      upgradeRequested: tenant.upgradeRequested || false,
      upgradeRequestedAt: tenant.upgradeRequestedAt,
    };
  }

  /**
   * Asserts that tenant is eligible to create an invoice or purchase bill.
   * Throws HTTP 402 with detailed payload if limit reached or plan expired.
   */
  async assertCanCreateInvoice(tenantId: string): Promise<PlanStatusResponse> {
    const status = await this.getTenantPlanStatus(tenantId);

    if (status.isLimitReached) {
      if (status.isExpired) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            error: 'PAYMENT_REQUIRED',
            code: 'PLAN_EXPIRED',
            message:
              'Your annual subscription has expired. Please renew your Basic Plan (₹3,000 / year) to continue.',
            details: status,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'PAYMENT_REQUIRED',
          code: 'PLAN_LIMIT_REACHED',
          message: `Free trial limit of ${status.maxFreeInvoices} bills reached. Please select our Basic Plan (₹3,000 / year) to continue.`,
          details: status,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return status;
  }

  /**
   * User requests plan activation from their account
   */
  async requestUpgrade(tenantId: string, note?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Business not found.');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        upgradeRequested: true,
        upgradeRequestedAt: new Date(),
      },
    });

    return {
      success: true,
      message:
        'Your upgrade request for Basic Plan (₹3,000 / year) has been submitted to Super Admin. You can also contact support for instant activation.',
      tenant: {
        id: updated.id,
        name: updated.name,
        upgradeRequested: updated.upgradeRequested,
        upgradeRequestedAt: updated.upgradeRequestedAt,
        planPrice: updated.planPrice || 3000,
      },
      paymentDetails: {
        planName: 'Basic Plan',
        price: 3000,
        period: '1 Year (365 Days)',
        upiId: 'billnova@upi',
        phone: '9876543210',
        instructions:
          'Transfer ₹3,000 via UPI and share the payment screenshot on WhatsApp to activate within 5 minutes.',
      },
    };
  }

  /**
   * Activate or renew a plan for a tenant (called by Super Admin or direct activation)
   */
  async activatePlan(
    tenantId: string,
    plan: TenantPlan = TenantPlan.BASIC,
    durationDays: number = 365,
    price: number = 3000,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        subscriptionStatus: 'ACTIVE',
        planExpiresAt: expiresAt,
        planPrice: price,
        upgradeRequested: false,
        upgradeRequestedAt: null,
        billingEnabled: true,
        purchasesEnabled: true,
      },
    });

    return {
      success: true,
      message: `${plan} Plan successfully activated for ${updated.name}! Valid for ${durationDays} days.`,
      tenant: updated,
    };
  }

  /**
   * Reset trial for a tenant
   */
  async resetTrial(tenantId: string, maxFreeInvoices: number = 7) {
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: TenantPlan.FREE,
        subscriptionStatus: 'TRIAL',
        planExpiresAt: null,
        maxFreeInvoices,
        upgradeRequested: false,
      },
    });

    return {
      success: true,
      message: `Trial reset to ${maxFreeInvoices} free bills for ${updated.name}.`,
      tenant: updated,
    };
  }
}

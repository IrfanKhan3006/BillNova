import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  UpdateTenantDto,
  ActivatePlanDto,
  ResetTrialDto,
} from './admin.controller';
import { SubscriptionService } from '../subscription/subscription.service';
import { TenantPlan } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
  ) {}

  // ─── Platform Analytics ───────────────────────────────────────────────────
  async getDashboardStats() {
    const totalTenants = await this.prisma.tenant.count({
      where: { deletedAt: null },
    });

    const totalUsers = await this.prisma.user.count({
      where: { isActive: true, deletedAt: null },
    });

    const upgradeRequestsPending = await this.prisma.tenant.count({
      where: { upgradeRequested: true, deletedAt: null },
    });

    const invoicesAggregate = await this.prisma.invoice.aggregate({
      _sum: {
        totalAmount: true,
      },
    });

    const totalRevenue = invoicesAggregate._sum.totalAmount || 0;

    const recentTenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Plan count aggregates
    const planGroups = await this.prisma.tenant.groupBy({
      by: ['plan'],
      _count: {
        id: true,
      },
      where: { deletedAt: null },
    });

    const planStats = planGroups.reduce(
      (acc, curr) => {
        acc[curr.plan] = curr._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalTenants,
      totalUsers,
      totalRevenue,
      upgradeRequestsPending,
      recentTenants,
      planStats: {
        FREE: planStats['FREE'] || 0,
        BASIC: planStats['BASIC'] || 0,
        STARTER: planStats['STARTER'] || 0,
        PRO: planStats['PRO'] || 0,
        ENTERPRISE: planStats['ENTERPRISE'] || 0,
      },
    };
  }

  // ─── Manage Tenants ───────────────────────────────────────────────────────
  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            users: true,
            invoices: true,
            customers: true,
            purchaseInvoices: true,
          },
        },
      },
    });

    const now = new Date();

    return tenants.map((t) => {
      const invoicesCount = t._count.invoices;
      const isPaidPlan = t.plan !== TenantPlan.FREE;
      let isExpired = false;
      let daysRemaining: number | null = null;

      if (isPaidPlan && t.planExpiresAt) {
        const expiry = new Date(t.planExpiresAt);
        const diffMs = expiry.getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        isExpired = diffMs <= 0;
      }

      let isLimitReached = false;
      let effectiveStatus = t.subscriptionStatus || 'TRIAL';

      if (t.plan === TenantPlan.FREE) {
        isLimitReached = invoicesCount >= t.maxFreeInvoices;
        effectiveStatus = isLimitReached ? 'EXPIRED' : 'TRIAL';
      } else {
        if (isExpired || t.subscriptionStatus === 'EXPIRED') {
          isLimitReached = true;
          effectiveStatus = 'EXPIRED';
        } else {
          isLimitReached = false;
          effectiveStatus = 'ACTIVE';
        }
      }

      return {
        ...t,
        subscriptionStatus: effectiveStatus,
        invoicesRemaining:
          t.plan === TenantPlan.FREE
            ? Math.max(0, t.maxFreeInvoices - invoicesCount)
            : 999999,
        isLimitReached,
        isExpired,
        daysRemaining,
      };
    });
  }

  async listUpgradeRequests() {
    const tenants = await this.prisma.tenant.findMany({
      where: { upgradeRequested: true, deletedAt: null },
      orderBy: { upgradeRequestedAt: 'desc' },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            users: true,
            invoices: true,
            customers: true,
            purchaseInvoices: true,
          },
        },
      },
    });

    return tenants.map((t) => {
      const invoicesCount = t._count.invoices;
      return {
        ...t,
        invoicesRemaining:
          t.plan === TenantPlan.FREE
            ? Math.max(0, t.maxFreeInvoices - invoicesCount)
            : 999999,
        isLimitReached:
          t.plan === TenantPlan.FREE
            ? invoicesCount >= t.maxFreeInvoices
            : false,
      };
    });
  }

  async dismissUpgradeRequest(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        upgradeRequested: false,
        upgradeRequestedAt: null,
      },
    });
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: dto.plan,
        subscriptionStatus: dto.subscriptionStatus,
        planExpiresAt: dto.planExpiresAt ? new Date(dto.planExpiresAt) : undefined,
        maxFreeInvoices: dto.maxFreeInvoices,
        planPrice: dto.planPrice,
        upgradeRequested: dto.upgradeRequested,
        billingEnabled: dto.billingEnabled,
        productsEnabled: dto.productsEnabled,
        paymentsEnabled: dto.paymentsEnabled,
        reportsEnabled: dto.reportsEnabled,
        purchasesEnabled: dto.purchasesEnabled,
        businessType: dto.businessType,
        trackInventory: dto.trackInventory,
        theme: dto.theme,
      },
    });
  }

  async activateTenantPlan(tenantId: string, dto: ActivatePlanDto) {
    const plan = dto.plan || TenantPlan.BASIC;
    const durationDays = dto.durationDays || 365;
    const price = dto.price || 3000;
    return this.subscriptionService.activatePlan(
      tenantId,
      plan,
      durationDays,
      price,
    );
  }

  async resetTenantTrial(tenantId: string, dto: ResetTrialDto) {
    const maxFree = dto.maxFreeInvoices || 7;
    return this.subscriptionService.resetTrial(tenantId, maxFree);
  }

  async auditTenantInvoices(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    return this.prisma.invoice.findMany({
      where: { tenantId },
      include: {
        customer: {
          select: { name: true, email: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async suspendTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    // Toggle suspension or mark deletedAt
    const now = tenant.deletedAt ? null : new Date();

    return this.prisma.$transaction(async (tx) => {
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { deletedAt: now },
      });

      // Also suspend/activate all users under this tenant
      await tx.user.updateMany({
        where: { tenantId },
        data: { isActive: !now },
      });

      return updatedTenant;
    });
  }

  async changeUserPassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}

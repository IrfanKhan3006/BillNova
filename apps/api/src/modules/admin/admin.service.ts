import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  UpdateTenantDto,
  ActivatePlanDto,
  ResetTrialDto,
} from './admin.controller';
import { SubscriptionService } from '../subscription/subscription.service';
import { InvoicesService } from '../invoices/invoices.service';
import { UpdateInvoiceDto } from '../invoices/invoices.controller';
import { TenantPlan } from '@prisma/client';
import { hashPassword } from '../../common/utils/password.util';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
    private invoicesService: InvoicesService,
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
      where: { deletedAt: null },
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
      where: { subscriptionStatus: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          where: { deletedAt: null },
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
            users: { where: { deletedAt: null } },
            invoices: { where: { deletedAt: null } },
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
            invoices: { where: { deletedAt: null } },
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

  async listEnquiries() {
    return this.prisma.enquiry.findMany({
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }], // NEW before DONE
      take: 200,
      include: { tenant: { select: { id: true, name: true, plan: true } } },
    });
  }

  async markEnquiryDone(id: string) {
    const enquiry = await this.prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) {
      throw new NotFoundException('Enquiry not found.');
    }
    return this.prisma.enquiry.update({ where: { id }, data: { status: 'DONE' } });
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
        planExpiresAt: dto.planExpiresAt
          ? new Date(dto.planExpiresAt)
          : undefined,
        maxFreeInvoices: dto.maxFreeInvoices,
        maxUsers:
          dto.maxUsers !== undefined
            ? Math.max(0, Math.floor(dto.maxUsers))
            : undefined,
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

  async getTenantDetail(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            invoices: { where: { deletedAt: null } },
            purchaseInvoices: true,
            customers: true,
            products: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    const totals = await this.prisma.invoice.aggregate({
      where: { tenantId, deletedAt: null },
      _sum: { totalAmount: true },
    });
    const deletedInvoices = await this.prisma.invoice.count({
      where: { tenantId, deletedAt: { not: null } },
    });

    return {
      ...tenant,
      totalBilled: totals._sum.totalAmount || 0,
      deletedInvoices,
    };
  }

  async auditTenantInvoices(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    return this.prisma.invoice.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        customer: {
          select: { name: true, email: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  // Reuse tenant-side invoice logic so totals, payments and customer
  // outstanding balances stay consistent with edits made by the business.
  async getTenantInvoice(tenantId: string, invoiceId: string) {
    return this.invoicesService.findOne(tenantId, invoiceId);
  }

  async updateTenantInvoice(
    tenantId: string,
    invoiceId: string,
    dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(tenantId, invoiceId, dto);
  }

  async deleteTenantInvoice(tenantId: string, invoiceId: string) {
    return this.invoicesService.remove(tenantId, invoiceId);
  }

  // ─── Recycle Bin ──────────────────────────────────────────────────────────
  async listDeletedInvoices() {
    const invoices = await this.prisma.invoice.findMany({
      where: { deletedAt: { not: null } },
      include: {
        customer: { select: { name: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });

    // Group by business for the recycle bin view
    const groups = new Map<string, { tenant: any; invoices: any[] }>();
    for (const { tenant, ...inv } of invoices) {
      if (!groups.has(tenant.id)) groups.set(tenant.id, { tenant, invoices: [] });
      groups.get(tenant.id)!.invoices.push(inv);
    }
    return [...groups.values()];
  }

  async restoreTenantInvoice(tenantId: string, invoiceId: string) {
    return this.invoicesService.restore(tenantId, invoiceId);
  }

  async suspendTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    if (tenant.subscriptionStatus === 'DELETED') {
      throw new BadRequestException('This business has been deleted.');
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

  // Soft delete: data stays in the DB, but the business and its users are
  // hidden everywhere. Users get deletedAt so their email can register again.
  async softDeleteTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || tenant.subscriptionStatus === 'DELETED') {
      throw new NotFoundException('Business profile not found.');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { tenantId },
        data: { isActive: false, deletedAt: now },
      });

      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          deletedAt: now,
          subscriptionStatus: 'DELETED',
          upgradeRequested: false,
        },
      });
    });
  }

  async listDeletedTenants() {
    return this.prisma.tenant.findMany({
      where: { subscriptionStatus: 'DELETED' },
      orderBy: { deletedAt: 'desc' },
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
        _count: {
          select: { invoices: { where: { deletedAt: null } }, customers: true },
        },
      },
    });
  }

  async restoreTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || tenant.subscriptionStatus !== 'DELETED') {
      throw new NotFoundException('Deleted business not found.');
    }

    // Only bring back users removed together with the business.
    const users = await this.prisma.user.findMany({
      where: { tenantId, deletedAt: tenant.deletedAt },
    });

    // Their email may have been reused for a new business in the meantime.
    const taken = await this.prisma.user.findMany({
      where: {
        email: { in: users.map((u) => u.email) },
        deletedAt: null,
      },
      select: { email: true },
    });
    if (taken.length) {
      throw new ConflictException(
        `Cannot restore: ${taken.map((u) => u.email).join(', ')} is already used by another active business. Delete that business first.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: users.map((u) => u.id) } },
        data: { isActive: true, deletedAt: null },
      });

      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          deletedAt: null,
          subscriptionStatus: tenant.plan === TenantPlan.FREE ? 'TRIAL' : 'ACTIVE',
        },
      });
    });
  }

  async changeUserPassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const passwordHash = await hashPassword(newPassword);

    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}

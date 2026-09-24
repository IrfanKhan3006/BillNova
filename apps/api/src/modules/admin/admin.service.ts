import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateTenantDto } from './admin.controller';
import * as argon2 from 'argon2';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ─── Platform Analytics ───────────────────────────────────────────────────
  async getDashboardStats() {
    const totalTenants = await this.prisma.tenant.count({
      where: { deletedAt: null },
    });

    const totalUsers = await this.prisma.user.count({
      where: { isActive: true, deletedAt: null },
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
      recentTenants,
      planStats: {
        FREE: planStats['FREE'] || 0,
        STARTER: planStats['STARTER'] || 0,
        PRO: planStats['PRO'] || 0,
        ENTERPRISE: planStats['ENTERPRISE'] || 0,
      },
    };
  }

  // ─── Manage Tenants ───────────────────────────────────────────────────────
  async listTenants() {
    return this.prisma.tenant.findMany({
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
          },
        },
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

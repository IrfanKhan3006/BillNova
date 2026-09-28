import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // Sales vs purchases between from..to (default: last 6 months), bucketed by
  // day for ranges up to ~2 months, otherwise by month. Also returns the bills
  // in the range. When createdById is given (USER role) only that user's bills count.
  async getAnalytics(
    tenantId: string,
    createdById?: string,
    fromStr?: string,
    toStr?: string,
  ) {
    const to = toStr ? new Date(`${toStr}T23:59:59.999`) : new Date();
    let from: Date;
    if (fromStr) {
      from = new Date(`${fromStr}T00:00:00`);
    } else {
      from = new Date(to);
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      from.setMonth(from.getMonth() - 5);
    }
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      throw new BadRequestException('Invalid date range.');
    }

    const salesWhere = {
      tenantId,
      deletedAt: null,
      status: { notIn: ['DRAFT', 'VOID'] as any },
      date: { gte: from, lte: to },
      ...(createdById ? { createdById } : {}),
    };
    const purchaseWhere = {
      tenantId,
      deletedAt: null,
      status: { notIn: ['DRAFT', 'CANCELLED'] as any },
      date: { gte: from, lte: to },
      ...(createdById ? { createdById } : {}),
    };

    const [sales, purchases] = await Promise.all([
      this.prisma.invoice.findMany({
        where: salesWhere,
        select: {
          id: true,
          invoiceNumber: true,
          date: true,
          status: true,
          totalAmount: true,
          customer: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.purchaseInvoice.findMany({
        where: purchaseWhere,
        select: { date: true, totalAmount: true },
      }),
    ]);

    const daily = to.getTime() - from.getTime() <= 62 * 86400000;
    const keyOf = (d: Date) =>
      daily
        ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        : `${d.getFullYear()}-${d.getMonth()}`;

    const buckets: {
      key: string;
      label: string;
      sales: number;
      salesCount: number;
      purchases: number;
      purchaseCount: number;
    }[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    if (!daily) cursor.setDate(1);
    while (cursor <= to) {
      buckets.push({
        key: keyOf(cursor),
        label: daily
          ? cursor.toLocaleString('en-IN', { day: 'numeric', month: 'short' })
          : cursor.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        sales: 0,
        salesCount: 0,
        purchases: 0,
        purchaseCount: 0,
      });
      if (daily) cursor.setDate(cursor.getDate() + 1);
      else cursor.setMonth(cursor.getMonth() + 1);
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const s of sales) {
      const b = byKey.get(keyOf(s.date));
      if (b) {
        b.sales += s.totalAmount;
        b.salesCount += 1;
      }
    }
    for (const p of purchases) {
      const b = byKey.get(keyOf(p.date));
      if (b) {
        b.purchases += p.totalAmount;
        b.purchaseCount += 1;
      }
    }

    return {
      scope: createdById ? 'USER' : 'BUSINESS',
      from: from.toISOString(),
      to: to.toISOString(),
      granularity: daily ? 'day' : 'month',
      totals: {
        salesCount: sales.length,
        salesAmount: sales.reduce((sum, s) => sum + s.totalAmount, 0),
        purchaseCount: purchases.length,
        purchaseAmount: purchases.reduce((sum, p) => sum + p.totalAmount, 0),
      },
      buckets: buckets.map(({ key, ...b }) => b),
      invoices: sales.slice(0, 100).map(({ customer, ...inv }) => ({
        ...inv,
        customerName: customer?.name || '',
      })),
    };
  }

  async getMetrics(tenantId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 1. Today's Sales
    const todaySales = await this.prisma.invoice.aggregate({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['DRAFT', 'VOID'] },
        date: { gte: startOfToday, lte: endOfToday },
      },
      _sum: { totalAmount: true },
    });

    // 2. Monthly Revenue
    const monthlyRevenue = await this.prisma.invoice.aggregate({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['DRAFT', 'VOID'] },
        date: { gte: startOfMonth },
      },
      _sum: { totalAmount: true },
    });

    // 3. Completed / Fully Paid Invoices
    const paidInvoicesCount = await this.prisma.invoice.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PAID',
      },
    });

    const paidInvoicesTotal = await this.prisma.invoice.aggregate({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PAID',
      },
      _sum: { totalAmount: true },
    });

    // 4. Advance / Partially Paid Invoices (Active, not yet converted to final bill)
    const advanceInvoicesCount = await this.prisma.invoice.count({
      where: {
        tenantId,
        deletedAt: null,
        advanceConverted: false,
        status: 'PARTIALLY_PAID',
      },
    });

    const advanceMetrics = await this.prisma.invoice.aggregate({
      where: {
        tenantId,
        deletedAt: null,
        advanceConverted: false,
        status: 'PARTIALLY_PAID',
      },
      _sum: {
        totalAmount: true,
        amountPaid: true,
        amountDue: true,
      },
    });

    // 5. Unpaid / Fully Pending Invoices (Zero advance received yet)
    const unpaidInvoicesCount = await this.prisma.invoice.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['SENT', 'OVERDUE'] },
        amountPaid: 0,
      },
    });

    // 6. Outstanding Invoices Count (any with remaining due)
    const outstandingInvoicesCount = await this.prisma.invoice.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        amountDue: { gt: 0 },
      },
    });

    // 7. Total Invoices Count
    const totalInvoicesCount = await this.prisma.invoice.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['DRAFT', 'VOID'] },
      },
    });

    // 8. Total Customer Outstanding Balance
    const totalCustomerOutstanding = await this.prisma.customer.aggregate({
      where: {
        tenantId,
        deletedAt: null,
      },
      _sum: { outstandingBalance: true },
    });

    // 9. Recent Invoices (limit 8)
    const recentInvoices = await this.prisma.invoice.findMany({
      where: { tenantId, deletedAt: null },
      include: { customer: true },
      orderBy: { date: 'desc' },
      take: 8,
    });

    // 10. Recent Advance Invoices (Active & Partially Paid)
    const recentAdvanceInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        advanceConverted: false,
        status: 'PARTIALLY_PAID',
      },
      include: { customer: true },
      orderBy: { date: 'desc' },
      take: 8,
    });

    // 11. Recent Pending / Unpaid Invoices (strictly excluding PAID, DRAFT, VOID, and PARTIALLY_PAID)
    const recentPendingInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['SENT', 'OVERDUE'] },
        amountPaid: 0,
      },
      include: { customer: true },
      orderBy: { date: 'desc' },
      take: 8,
    });

    const mapInvoice = (inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer?.name || 'Walk-in Customer',
      date: inv.date,
      totalAmount: inv.totalAmount,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      status: inv.status,
    });

    return {
      todaySales: todaySales._sum.totalAmount || 0,
      monthlyRevenue: monthlyRevenue._sum.totalAmount || 0,
      totalInvoicesCount,
      paidInvoicesCount,
      paidInvoicesTotal: paidInvoicesTotal._sum.totalAmount || 0,
      advanceInvoicesCount,
      advanceCollectedAmount: advanceMetrics._sum.amountPaid || 0,
      advancePendingAmount: advanceMetrics._sum.amountDue || 0,
      advanceTotalAmount: advanceMetrics._sum.totalAmount || 0,
      unpaidInvoicesCount,
      outstandingInvoicesCount,
      totalCustomerOutstanding:
        totalCustomerOutstanding._sum.outstandingBalance || 0,
      recentInvoices: recentInvoices.map(mapInvoice),
      recentAdvanceInvoices: recentAdvanceInvoices.map(mapInvoice),
      recentPendingInvoices: recentPendingInvoices.map(mapInvoice),
    };
  }

  async getTopItems(tenantId: string) {
    // 1. Top Customers by Outstanding Balance
    const topCustomers = await this.prisma.customer.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { outstandingBalance: 'desc' },
      take: 5,
    });

    // 2. Top Products by Quantity Sold (aggregation manually via Prisma groupby or prisma queries)
    const items = await this.prisma.invoiceItem.groupBy({
      by: ['productId', 'name'],
      where: {
        invoice: {
          tenantId,
          deletedAt: null,
          status: { notIn: ['DRAFT', 'VOID'] },
        },
      },
      _sum: {
        qty: true,
        total: true,
      },
      orderBy: {
        _sum: {
          qty: 'desc',
        },
      },
      take: 5,
    });

    return {
      topCustomers: topCustomers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        outstandingBalance: c.outstandingBalance,
      })),
      topProducts: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantitySold: i._sum.qty || 0,
        revenue: i._sum.total || 0,
      })),
    };
  }
}

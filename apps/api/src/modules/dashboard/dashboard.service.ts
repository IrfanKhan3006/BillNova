import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

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

    // 4. Advance / Partially Paid Invoices
    const advanceInvoicesCount = await this.prisma.invoice.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PARTIALLY_PAID',
      },
    });

    const advanceMetrics = await this.prisma.invoice.aggregate({
      where: {
        tenantId,
        deletedAt: null,
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

    // 10. Recent Advance Invoices (Partially Paid)
    const recentAdvanceInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
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

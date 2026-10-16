import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSalesReport(tenantId: string, startDate?: string, endDate?: string) {
    const where: any = {
      tenantId,
      deletedAt: null,
      status: { notIn: ['DRAFT', 'VOID'] },
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: { customer: true },
      orderBy: { date: 'desc' },
    });

    const summary = invoices.reduce(
      (acc, inv) => {
        acc.totalInvoices += 1;
        acc.subTotal += inv.subTotal;
        acc.taxAmount += inv.taxAmount;
        acc.discountAmount += inv.discountAmount;
        acc.totalAmount += inv.totalAmount;
        acc.amountPaid += inv.amountPaid;
        acc.amountDue += inv.amountDue;
        return acc;
      },
      {
        totalInvoices: 0,
        subTotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        amountPaid: 0,
        amountDue: 0,
      },
    );

    return {
      summary,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer.name,
        date: inv.date,
        subTotal: inv.subTotal,
        taxAmount: inv.taxAmount,
        discountAmount: inv.discountAmount,
        totalAmount: inv.totalAmount,
        amountPaid: inv.amountPaid,
        amountDue: inv.amountDue,
        status: inv.status,
      })),
    };
  }

  async getPurchaseReport(
    tenantId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = {
      tenantId,
      deletedAt: null,
      status: { notIn: ['DRAFT', 'CANCELLED'] },
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const purchases = await this.prisma.purchaseInvoice.findMany({
      where,
      include: { vendor: true },
      orderBy: { date: 'desc' },
    });

    const summary = purchases.reduce(
      (acc, p) => {
        acc.totalPurchases += 1;
        acc.subTotal += p.subTotal;
        acc.taxAmount += p.taxAmount;
        acc.discountAmount += p.discountAmount;
        acc.totalAmount += p.totalAmount;
        acc.amountPaid += p.amountPaid;
        acc.amountDue += p.amountDue;
        return acc;
      },
      {
        totalPurchases: 0,
        subTotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        amountPaid: 0,
        amountDue: 0,
      },
    );

    return {
      summary,
      purchases: purchases.map((p) => ({
        id: p.id,
        purchaseNumber: p.purchaseNumber,
        billNumber: p.billNumber,
        vendorName: p.vendor.name,
        date: p.date,
        subTotal: p.subTotal,
        taxAmount: p.taxAmount,
        discountAmount: p.discountAmount,
        totalAmount: p.totalAmount,
        amountPaid: p.amountPaid,
        amountDue: p.amountDue,
        status: p.status,
      })),
    };
  }

  async getCustomerReport(tenantId: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      include: {
        invoices: {
          where: { deletedAt: null, status: { notIn: ['DRAFT', 'VOID'] } },
        },
      },
      orderBy: { outstandingBalance: 'desc' },
    });

    return customers.map((c) => {
      const unpaidInvoices = c.invoices.filter((inv) => inv.amountDue > 0);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        gstin: c.gstin,
        outstandingBalance: c.outstandingBalance,
        totalInvoicesCount: c.invoices.length,
        unpaidInvoicesCount: unpaidInvoices.length,
      };
    });
  }

  async getPaymentReport(
    tenantId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: { customer: true, invoice: true },
      orderBy: { date: 'desc' },
    });

    const summary = payments.reduce(
      (acc, pmt) => {
        acc.totalPayments += 1;
        acc.totalAmount += pmt.amount;
        acc.byMethod[pmt.method] = (acc.byMethod[pmt.method] || 0) + pmt.amount;
        return acc;
      },
      {
        totalPayments: 0,
        totalAmount: 0,
        byMethod: {
          CASH: 0,
          BANK_TRANSFER: 0,
          CARD: 0,
          UPI: 0,
          OTHER: 0,
        },
      },
    );

    return {
      summary,
      payments: payments.map((p) => ({
        id: p.id,
        customerName: p.customer.name,
        invoiceNumber: p.invoice?.invoiceNumber || 'Direct Payment',
        amount: p.amount,
        date: p.date,
        method: p.method,
        referenceNo: p.referenceNo,
        notes: p.notes,
      })),
    };
  }

  async getTaxReport(tenantId: string, startDate?: string, endDate?: string) {
    const where: any = {
      invoice: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['DRAFT', 'VOID'] },
      },
    };

    if (startDate || endDate) {
      where.invoice.date = {};
      if (startDate) {
        where.invoice.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.invoice.date.lte = new Date(endDate);
      }
    }

    const items = await this.prisma.invoiceItem.findMany({
      where,
      orderBy: { taxRate: 'asc' },
    });

    // Group items by taxRate
    const groupMap = new Map<
      number,
      { taxableValue: number; taxAmount: number }
    >();

    for (const item of items) {
      const rate = item.taxRate;
      const current = groupMap.get(rate) || { taxableValue: 0, taxAmount: 0 };

      // item.total = taxableValue + item.taxAmount
      // taxableValue = item.total - item.taxAmount
      const taxable = item.total - item.taxAmount;

      groupMap.set(rate, {
        taxableValue: current.taxableValue + taxable,
        taxAmount: current.taxAmount + item.taxAmount,
      });
    }

    const report: any[] = [];
    groupMap.forEach((val, key) => {
      report.push({
        taxRate: key,
        taxableValue: val.taxableValue,
        taxAmount: val.taxAmount,
        cgst: val.taxAmount / 2, // Assuming standard CGST/SGST split
        sgst: val.taxAmount / 2,
        total: val.taxableValue + val.taxAmount,
      });
    });

    return report.sort((a, b) => a.taxRate - b.taxRate);
  }

  /**
   * Revenue dashboard.
   *
   * Follows the reporting rules agreed for this feature:
   *  - cancelled / draft documents are excluded (DRAFT and VOID invoices),
   *  - each invoice and each payment is counted exactly once,
   *  - `basis` fixes whether revenue is read before GST ('NET', the default,
   *    uses subTotal) or after it ('GROSS', uses totalAmount). Every revenue
   *    figure on the response — totals, growth, trend, categories, customers —
   *    uses the same basis, so the numbers always reconcile with each other.
   */
  async getRevenueReport(
    tenantId: string,
    startDate?: string,
    endDate?: string,
    basis: 'NET' | 'GROSS' = 'NET',
  ) {
    // A date-only filter like '2026-10-16' parses to midnight, which would
    // drop everything billed during that day, so widen it to the whole day.
    const dateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

    const end = endDate
      ? dateOnly(endDate)
        ? new Date(`${endDate}T23:59:59.999`)
        : new Date(endDate)
      : new Date();
    const start = startDate
      ? dateOnly(startDate)
        ? new Date(`${startDate}T00:00:00.000`)
        : new Date(startDate)
      : new Date(end.getFullYear(), end.getMonth() - 5, 1);

    // Previous window of equal length, for the growth comparison.
    const windowMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - windowMs);

    const revenueOf = (inv: { subTotal: number; totalAmount: number }) =>
      basis === 'GROSS' ? inv.totalAmount : inv.subTotal;

    const invoiceWhere = (from: Date, to: Date) => ({
      tenantId,
      deletedAt: null,
      status: { notIn: ['DRAFT', 'VOID'] as any },
      date: { gte: from, lte: to },
    });

    const [invoices, previousInvoices, payments, purchases, quotationCount, orderCount] =
      await Promise.all([
        this.prisma.invoice.findMany({
          where: invoiceWhere(start, end),
          include: {
            customer: { select: { id: true, name: true } },
            items: {
              select: {
                name: true,
                qty: true,
                total: true,
                taxAmount: true,
                product: {
                  select: {
                    isService: true,
                    purchasePrice: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { date: 'asc' },
        }),
        this.prisma.invoice.findMany({
          where: invoiceWhere(prevStart, prevEnd),
          select: { subTotal: true, totalAmount: true },
        }),
        this.prisma.payment.findMany({
          where: {
            tenantId,
            deletedAt: null,
            date: { gte: start, lte: end },
          },
          select: { amount: true, date: true },
        }),
        this.prisma.purchaseInvoice.findMany({
          where: {
            tenantId,
            deletedAt: null,
            status: { notIn: ['DRAFT', 'CANCELLED'] as any },
            date: { gte: start, lte: end },
          },
          select: { subTotal: true, totalAmount: true },
        }),
        this.prisma.quotation.count({
          where: {
            tenantId,
            deletedAt: null,
            status: { not: 'DRAFT' },
            date: { gte: start, lte: end },
          },
        }),
        this.prisma.salesOrder.count({
          where: {
            tenantId,
            deletedAt: null,
            status: { not: 'CANCELLED' },
            date: { gte: start, lte: end },
          },
        }),
      ]);

    const totalRevenue = invoices.reduce((sum, inv) => sum + revenueOf(inv), 0);
    const previousRevenue = previousInvoices.reduce(
      (sum, inv) => sum + revenueOf(inv),
      0,
    );
    const revenueGrowth =
      previousRevenue > 0
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
        : null;

    // Collections come from the payment ledger, never from invoice.amountPaid,
    // so a payment is never counted twice.
    const collected = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = invoices.reduce((sum, inv) => sum + inv.amountDue, 0);

    // Cost of goods sold: the recorded purchase price of each sold item.
    const costOfGoods = invoices.reduce(
      (sum, inv) =>
        sum +
        inv.items.reduce(
          (lineSum, item) =>
            lineSum + (item.product?.purchasePrice || 0) * item.qty,
          0,
        ),
      0,
    );
    const purchaseSpend = purchases.reduce(
      (sum, p) => sum + (basis === 'GROSS' ? p.totalAmount : p.subTotal),
      0,
    );

    // Monthly trend across the window.
    const monthly = new Map<string, { revenue: number; collected: number }>();
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      monthly.set(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        { revenue: 0, collected: 0 },
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    for (const inv of invoices) {
      const bucket = monthly.get(monthKey(inv.date));
      if (bucket) bucket.revenue += revenueOf(inv);
    }
    for (const payment of payments) {
      const bucket = monthly.get(monthKey(payment.date));
      if (bucket) bucket.collected += payment.amount;
    }

    // Revenue by product category, using the same basis as everything else.
    const categories = new Map<string, number>();
    for (const inv of invoices) {
      for (const item of inv.items) {
        const label = item.product?.category?.name
          ? item.product.category.name
          : item.product?.isService
            ? 'Services'
            : 'Other';
        const value =
          basis === 'GROSS' ? item.total : item.total - item.taxAmount;
        categories.set(label, (categories.get(label) || 0) + value);
      }
    }

    // Top customers by revenue.
    const customers = new Map<string, { name: string; revenue: number; invoices: number }>();
    for (const inv of invoices) {
      const current = customers.get(inv.customerId) || {
        name: inv.customer.name,
        revenue: 0,
        invoices: 0,
      };
      current.revenue += revenueOf(inv);
      current.invoices += 1;
      customers.set(inv.customerId, current);
    }

    return {
      basis,
      period: { startDate: start, endDate: end },
      previousPeriod: { startDate: prevStart, endDate: prevEnd },
      summary: {
        totalRevenue,
        previousRevenue,
        revenueGrowth,
        collected,
        outstanding,
        costOfGoods,
        grossProfit: totalRevenue - costOfGoods,
        grossMargin:
          totalRevenue > 0
            ? ((totalRevenue - costOfGoods) / totalRevenue) * 100
            : null,
        purchaseSpend,
        invoiceCount: invoices.length,
        averageInvoiceValue:
          invoices.length > 0 ? totalRevenue / invoices.length : 0,
        quotationCount,
        salesOrderCount: orderCount,
        // Sales conversion: orders ÷ quotations × 100.
        salesConversion:
          quotationCount > 0 ? (orderCount / quotationCount) * 100 : null,
      },
      monthly: Array.from(monthly.entries()).map(([month, val]) => ({
        month,
        revenue: val.revenue,
        collected: val.collected,
      })),
      byCategory: Array.from(categories.entries())
        .map(([category, revenue]) => ({ category, revenue }))
        .sort((a, b) => b.revenue - a.revenue),
      topCustomers: Array.from(customers.entries())
        .map(([id, val]) => ({ customerId: id, ...val }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    };
  }
}

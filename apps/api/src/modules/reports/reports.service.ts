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

  async getPaymentReport(tenantId: string, startDate?: string, endDate?: string) {
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
    const groupMap = new Map<number, { taxableValue: number; taxAmount: number }>();

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
}

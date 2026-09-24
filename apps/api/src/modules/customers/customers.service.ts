import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, search?: string) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return customer;
  }

  async create(tenantId: string, data: any) {
    return this.prisma.customer.create({
      data: {
        tenantId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        gstin: data.gstin,
        outstandingBalance: data.outstandingBalance ?? 0,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    await this.findOne(tenantId, id); // Ensure customer exists and belongs to tenant

    return this.prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        gstin: data.gstin,
        outstandingBalance: data.outstandingBalance,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getLedger(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    // Fetch invoices and payments for customer
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { customerId: id, tenantId, deletedAt: null },
        orderBy: { date: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { customerId: id, tenantId, deletedAt: null },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Format events
    const events = [
      ...invoices.map((inv) => ({
        id: inv.id,
        date: inv.date,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        amount: inv.totalAmount,
        status: inv.status,
        description: `Invoice ${inv.invoiceNumber} created`,
      })),
      ...payments.map((pmt) => ({
        id: pmt.id,
        date: pmt.date,
        type: 'PAYMENT',
        reference: pmt.referenceNo || 'PAYMENT',
        amount: pmt.amount,
        status: 'PAID',
        description: `Payment recorded via ${pmt.method}. Notes: ${pmt.notes || 'None'}`,
      })),
    ];

    // Sort by date ascending (using calendar date YYYY-MM-DD, ignoring time)
    events.sort((a, b) => {
      const dateStrA = new Date(a.date).toISOString().split('T')[0];
      const dateStrB = new Date(b.date).toISOString().split('T')[0];
      const diff = dateStrA.localeCompare(dateStrB);
      if (diff !== 0) return diff;
      return a.reference.localeCompare(b.reference);
    });

    // Calculate running balance
    let runningBalance = 0;
    const ledger = events.map((event) => {
      if (event.type === 'INVOICE') {
        runningBalance += event.amount;
      } else {
        runningBalance -= event.amount;
      }
      return {
        ...event,
        runningBalance,
      };
    });

    // Sort the final ledger list so that the latest transactions (strictly sequenced by Reference for invoices, and date/reference tiebreaker for payments) are on top
    ledger.sort((a, b) => {
      // If both are invoices, sort strictly by reference number descending (e.g. INV-00058 > INV-00057 > INV-00001)
      if (a.type === 'INVOICE' && b.type === 'INVOICE') {
        return b.reference.localeCompare(a.reference);
      }

      // Fallback for payment vs invoice / payment vs payment: compare dates descending
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return dateB - dateA;
      }

      return b.reference.localeCompare(a.reference);
    });

    return {
      customerId: id,
      ledger,
    };
  }
}

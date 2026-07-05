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

    // Sort by date ascending
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

    return {
      customerId: id,
      ledger,
    };
  }
}

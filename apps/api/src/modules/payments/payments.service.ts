import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, customerId?: string) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    return this.prisma.payment.findMany({
      where,
      include: { customer: true, invoice: true },
      orderBy: { date: 'desc' },
    });
  }

  async findByInvoice(tenantId: string, invoiceId: string) {
    return this.prisma.payment.findMany({
      where: { tenantId, invoiceId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
  }

  async create(tenantId: string, data: any) {
    const { customerId, invoiceId, amount, date, method, referenceNo, notes } = data;

    if (amount <= 0) {
      throw new BadRequestException('Payment amount 0 se zyada hona chahiye.');
    }

    // Verify customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Customer nahi mila.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. If invoiceId is provided, apply to invoice
      if (invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: { id: invoiceId, tenantId, deletedAt: null },
        });

        if (!invoice) {
          throw new NotFoundException('Invoice nahi mili.');
        }

        const newAmountPaid = invoice.amountPaid + amount;
        const newAmountDue = Math.max(0, invoice.totalAmount - newAmountPaid);
        let newStatus: any = invoice.status;

        if (newAmountDue <= 0) {
          newStatus = 'PAID';
        } else if (newAmountPaid > 0) {
          newStatus = 'PARTIALLY_PAID';
        }

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
          },
        });
      }

      // 2. Reduce Customer Outstanding Balance
      await tx.customer.update({
        where: { id: customerId },
        data: {
          outstandingBalance: { decrement: amount },
        },
      });

      // 3. Create Payment record
      const payment = await tx.payment.create({
        data: {
          tenantId,
          customerId,
          invoiceId: invoiceId || null,
          amount,
          date: date ? new Date(date) : new Date(),
          method: method || 'CASH',
          referenceNo: referenceNo || null,
          notes: notes || null,
        },
      });

      return payment;
    });
  }
}

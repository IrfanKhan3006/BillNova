import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, customerId?: string, status?: any) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.invoice.findMany({
      where,
      include: { customer: true },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice nahi mili.');
    }

    return invoice;
  }

  async create(tenantId: string, data: any) {
    const { customerId, items, date, notes, discountAmount: directDiscount, status } = data;

    // Verify customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Customer nahi mila.');
    }

    if (!items || items.length === 0) {
      throw new BadRequestException('Invoice items add karo.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Generate Invoice Number
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant nahi mila.');
      }

      const nextCounter = tenant.invoiceCounter + 1;
      const formattedCounter = String(nextCounter).padStart(5, '0');
      const invoiceNumber = `${tenant.invoicePrefix}-${formattedCounter}`;

      // Update tenant counter
      await tx.tenant.update({
        where: { id: tenantId },
        data: { invoiceCounter: nextCounter },
      });

      // 2. Calculations
      let subTotal = 0;
      let taxAmount = 0;
      let discountAmount = directDiscount || 0;

      const processedItems: any[] = [];

      for (const item of items) {
        const product = item.productId
          ? await tx.product.findFirst({ where: { id: item.productId, tenantId, deletedAt: null } })
          : null;

        const price = item.price ?? product?.salesPrice ?? 0;
        const taxRate = item.taxRate ?? product?.taxRate ?? 0;
        const discountRate = item.discountRate ?? 0; // percent
        const qty = item.qty ?? 1;

        const rateAfterDiscount = price * (1 - discountRate / 100);
        const itemSubTotal = rateAfterDiscount * qty;
        const itemTaxAmount = itemSubTotal * (taxRate / 100);
        const itemTotal = itemSubTotal + itemTaxAmount;
        const itemDiscountAmount = (price * (discountRate / 100)) * qty;

        subTotal += itemSubTotal;
        taxAmount += itemTaxAmount;
        discountAmount += itemDiscountAmount;

        processedItems.push({
          productId: item.productId || null,
          name: item.name || product?.name || 'Item',
          qty,
          price,
          taxRate,
          taxAmount: itemTaxAmount,
          discountRate,
          discountAmount: itemDiscountAmount,
          total: itemTotal,
        });

        // Deduct from stock if product exists
        if (product) {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: qty } },
          });
        }
      }

      const totalAmount = subTotal + taxAmount;
      const amountPaid = 0; // initial invoice payments happen separately or as recorded payment
      const amountDue = totalAmount - amountPaid;

      // Invoice status determines whether outstanding balance is adjusted
      const finalStatus = status || 'SENT';
      const isDraft = finalStatus === 'DRAFT';
      const isVoid = finalStatus === 'VOID';

      if (!isDraft && !isVoid) {
        await tx.customer.update({
          where: { id: customerId },
          data: { outstandingBalance: { increment: amountDue } },
        });
      }

      // Calculate dueDate based on tenant configuration
      const invoiceDate = date ? new Date(date) : new Date();
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + tenant.dueDays);

      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          customerId,
          invoiceNumber,
          date: invoiceDate,
          dueDate,
          status: finalStatus,
          discountAmount,
          taxAmount,
          subTotal,
          totalAmount,
          amountPaid,
          amountDue,
          notes,
          items: {
            create: processedItems,
          },
        },
        include: {
          items: true,
        },
      });

      return invoice;
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const { status, notes } = data;

    const oldInvoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!oldInvoice) {
      throw new NotFoundException('Invoice nahi mili.');
    }

    return this.prisma.$transaction(async (tx) => {
      let finalStatus = oldInvoice.status;
      if (status && status !== oldInvoice.status) {
        finalStatus = status;

        // Recalculate customer balance
        const wasOutstanding = oldInvoice.status !== 'DRAFT' && oldInvoice.status !== 'VOID';
        const isOutstanding = finalStatus !== 'DRAFT' && finalStatus !== 'VOID';

        let balanceChange = 0;

        if (wasOutstanding && !isOutstanding) {
          // If moving from outstanding to non-outstanding (e.g. void or draft)
          balanceChange = -oldInvoice.amountDue;
        } else if (!wasOutstanding && isOutstanding) {
          // If moving from non-outstanding to outstanding
          balanceChange = oldInvoice.amountDue;
        }

        if (balanceChange !== 0) {
          await tx.customer.update({
            where: { id: oldInvoice.customerId },
            data: { outstandingBalance: { increment: balanceChange } },
          });
        }
      }

      return tx.invoice.update({
        where: { id },
        data: {
          status: finalStatus,
          notes: notes !== undefined ? notes : undefined,
        },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice nahi mili.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Revert customer outstanding balance if deleted invoice was active
      const wasActive = invoice.status !== 'DRAFT' && invoice.status !== 'VOID';
      if (wasActive) {
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { outstandingBalance: { decrement: invoice.amountDue } },
        });
      }

      return tx.invoice.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }
}

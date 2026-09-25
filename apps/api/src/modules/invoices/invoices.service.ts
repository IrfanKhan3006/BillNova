import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
  ) {}

  async list(tenantId: string, customerId?: string, status?: any, isAdvance?: boolean) {
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

    if (isAdvance !== undefined) {
      if (isAdvance) {
        where.OR = [
          { isAdvance: true },
          { advanceConverted: true },
          { convertedFromAdvanceNumber: { not: null } },
        ];
      } else {
        where.isAdvance = false;
        where.convertedFromAdvanceNumber = null;
      }
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        payments: {
          orderBy: { date: 'asc' },
        },
        items: true,
      },
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
        payments: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    return invoice;
  }

  async create(tenantId: string, data: any) {
    // 0. Enforce Pro-Level Subscription / 7-Bill Limit Gate
    await this.subscriptionService.assertCanCreateInvoice(tenantId);

    const {
      customerId,
      items,
      date,
      notes,
      discountAmount: directDiscount,
      status,

      irn,
      ackNo,
      ackDate,

      consigneeName,
      consigneeAddress,
      consigneeGstin,
      consigneeState,

      deliveryNote,
      deliveryNoteDate,
      paymentTerms,
      supplierRef,
      otherReferences,
      buyersOrderNo,
      buyersOrderDate,
      despatchDocNo,
      despatchedThrough,
      destination,
      termsOfDelivery,
      vehicleNumber,
    } = data;

    // Verify customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    if (!items || items.length === 0) {
      throw new BadRequestException('Invoice items are required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant profile not found.');
      }

      // 1. Calculations
      let subTotal = 0;
      let taxAmount = 0;
      let discountAmount = directDiscount || 0;

      const processedItems: any[] = [];

      for (const item of items) {
        const product = item.productId
          ? await tx.product.findFirst({
              where: { id: item.productId, tenantId, deletedAt: null },
            })
          : null;

        const price = item.price ?? product?.salesPrice ?? 0;
        const taxRate = item.taxRate ?? product?.taxRate ?? 0;
        const discountRate = item.discountRate ?? 0; // percent
        const qty = item.qty ?? 1;

        const rateAfterDiscount = price * (1 - discountRate / 100);
        const itemSubTotal = rateAfterDiscount * qty;
        const itemTaxAmount = itemSubTotal * (taxRate / 100);
        const itemTotal = itemSubTotal + itemTaxAmount;
        const itemDiscountAmount = price * (discountRate / 100) * qty;

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
          hsnCode: item.hsnCode || product?.hsnCode || null,
        });

        // Deduct from stock only if inventory tracking is enabled for this business
        if (product && tenant.trackInventory && !product.isService) {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: qty } },
          });
        }
      }

      const totalAmount = subTotal + taxAmount;
      const initialPaid = Math.min(
        totalAmount,
        Math.max(0, Number(data.amountPaid ?? data.advanceAmount ?? 0)),
      );
      const amountPaid = initialPaid;
      const amountDue = Math.max(0, totalAmount - amountPaid);

      // Determine if advance bill
      const isAdvance = Boolean(
        data.isAdvance ||
        (Number(data.advanceAmount ?? 0) > 0 && amountDue > 0)
      );

      // 2. Generate Invoice Number (Dedicated advancePrefix sequence or standard invoicePrefix)
      let invoiceNumber: string;
      if (isAdvance) {
        const nextCounter = (tenant.advanceCounter || 0) + 1;
        const formattedCounter = String(nextCounter).padStart(5, '0');
        invoiceNumber = `${tenant.advancePrefix || 'ADV'}-${formattedCounter}`;
        await tx.tenant.update({
          where: { id: tenantId },
          data: { advanceCounter: nextCounter },
        });
      } else {
        const nextCounter = tenant.invoiceCounter + 1;
        const formattedCounter = String(nextCounter).padStart(5, '0');
        invoiceNumber = `${tenant.invoicePrefix || 'INV'}-${formattedCounter}`;
        await tx.tenant.update({
          where: { id: tenantId },
          data: { invoiceCounter: nextCounter },
        });
      }

      // Determine final invoice status
      let finalStatus = status || 'SENT';
      if (finalStatus !== 'DRAFT' && finalStatus !== 'VOID') {
        if (amountDue === 0 && totalAmount > 0) {
          finalStatus = 'PAID';
        } else if (amountPaid > 0) {
          finalStatus = 'PARTIALLY_PAID';
        } else {
          finalStatus = status || 'SENT';
        }
      }

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
          isAdvance,
          advanceConverted: false,
          discountAmount,
          taxAmount,
          subTotal,
          totalAmount,
          amountPaid,
          amountDue,
          notes,

          irn,
          ackNo,
          ackDate: ackDate ? new Date(ackDate) : null,

          consigneeName,
          consigneeAddress,
          consigneeGstin,
          consigneeState,

          deliveryNote,
          deliveryNoteDate: deliveryNoteDate
            ? new Date(deliveryNoteDate)
            : null,
          paymentTerms,
          supplierRef,
          otherReferences,
          buyersOrderNo,
          buyersOrderDate: buyersOrderDate ? new Date(buyersOrderDate) : null,
          despatchDocNo,
          despatchedThrough,
          destination,
          termsOfDelivery,
          vehicleNumber,

          items: {
            create: processedItems,
          },
        },
        include: {
          items: true,
        },
      });

      // If advance payment was made at invoice creation, record initial Payment
      if (amountPaid > 0 && !isDraft && !isVoid) {
        const validMethods = ['CASH', 'BANK_TRANSFER', 'CARD', 'UPI', 'OTHER'];
        const method = validMethods.includes(data.paymentMethod)
          ? data.paymentMethod
          : 'CASH';

        await tx.payment.create({
          data: {
            tenantId,
            customerId,
            invoiceId: invoice.id,
            amount: amountPaid,
            date: invoiceDate,
            method: method,
            referenceNo: data.paymentReference || 'Advance at Billing',
            notes:
              data.paymentNotes ||
              (amountDue === 0
                ? 'Full payment received at invoice creation'
                : `Advance payment of ₹${amountPaid} received at invoice creation`),
          },
        });
      }

      return invoice;
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const {
      status,
      notes,
      date,
      items,
      newAdvanceAmount,
      advanceDate,
      advanceMethod,
      advanceReference,
      advanceNotes,
    } = data;

    const oldInvoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true, payments: { orderBy: { date: 'asc' } } },
    });

    if (!oldInvoice) {
      throw new NotFoundException('Invoice not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      let subTotal = oldInvoice.subTotal;
      let taxAmount = oldInvoice.taxAmount;
      let totalAmount = oldInvoice.totalAmount;
      let amountPaid = oldInvoice.amountPaid;
      let finalStatus = oldInvoice.status;

      // 1. If items are being updated:
      if (items && Array.isArray(items) && items.length > 0) {
        subTotal = 0;
        taxAmount = 0;
        const processedItems: any[] = [];

        for (const item of items) {
          const product = item.productId
            ? await tx.product.findFirst({
                where: { id: item.productId, tenantId, deletedAt: null },
              })
            : null;

          const price = item.price ?? product?.salesPrice ?? 0;
          const taxRate = item.taxRate ?? product?.taxRate ?? 0;
          const discountRate = item.discountRate ?? 0;
          const qty = item.qty ?? 1;

          const rateAfterDiscount = price * (1 - discountRate / 100);
          const itemSubTotal = rateAfterDiscount * qty;
          const itemTaxAmount = itemSubTotal * (taxRate / 100);
          const itemTotal = itemSubTotal + itemTaxAmount;
          const itemDiscountAmount = price * (discountRate / 100) * qty;

          subTotal += itemSubTotal;
          taxAmount += itemTaxAmount;

          processedItems.push({
            invoiceId: id,
            productId: item.productId || null,
            name: item.name || product?.name || 'Item',
            qty,
            price,
            taxRate,
            taxAmount: itemTaxAmount,
            discountRate,
            discountAmount: itemDiscountAmount,
            total: itemTotal,
            hsnCode: item.hsnCode || product?.hsnCode || null,
          });
        }

        totalAmount = subTotal + taxAmount;
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({ data: processedItems });
      }

      // 2. If new advance installment is being added:
      if (newAdvanceAmount && Number(newAdvanceAmount) > 0) {
        const addedAmount = Number(newAdvanceAmount);
        amountPaid += addedAmount;

        const pCount = (oldInvoice.payments?.length || 0) + 1;
        const ordinal =
          pCount === 1
            ? '1st Advance'
            : pCount === 2
            ? '2nd Advance'
            : pCount === 3
            ? '3rd Advance'
            : `${pCount}th Advance`;

        await tx.payment.create({
          data: {
            tenantId,
            customerId: oldInvoice.customerId,
            invoiceId: id,
            amount: addedAmount,
            date: advanceDate ? new Date(advanceDate) : new Date(),
            method: (advanceMethod as any) || 'CASH',
            referenceNo: advanceReference || null,
            notes: advanceNotes || `${ordinal} payment received`,
          },
        });
      }

      const amountDue = Math.max(0, totalAmount - amountPaid);

      // 3. Status determination
      if (status && status !== oldInvoice.status) {
        finalStatus = status;
      } else {
        if (amountDue <= 0 && totalAmount > 0) {
          finalStatus = 'PAID';
        } else if (amountPaid > 0) {
          finalStatus = 'PARTIALLY_PAID';
        }
      }

      // 4. Update customer outstanding balance for the net difference
      const oldDue = oldInvoice.amountDue;
      const netDueDifference = amountDue - oldDue;
      if (netDueDifference !== 0 && finalStatus !== 'DRAFT' && finalStatus !== 'VOID') {
        await tx.customer.update({
          where: { id: oldInvoice.customerId },
          data: { outstandingBalance: { increment: netDueDifference } },
        });
      }

      // 5. Update invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          subTotal,
          taxAmount,
          totalAmount,
          amountPaid,
          amountDue,
          status: finalStatus,
          notes: notes !== undefined ? notes : undefined,
          date: date ? new Date(date) : undefined,
        },
        include: {
          items: true,
          payments: { orderBy: { date: 'asc' } },
          customer: true,
        },
      });

      // 6. If this was an advance bill and it is now 100% settled, auto-generate Final Tax Bill!
      let convertedInvoice: any = null;
      if (amountDue <= 0 && oldInvoice.isAdvance && !oldInvoice.advanceConverted) {
        convertedInvoice = await this.convertAdvanceInvoiceToFinalBill(
          tx,
          tenantId,
          id,
        );
      }

      if (convertedInvoice) {
        return convertedInvoice;
      }

      return updatedInvoice;
    });
  }

  async remove(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
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

  /**
   * Automatically generates a new regular final Tax Invoice when an Advance Bill is fully settled.
   * This ensures users don't have to audit provisional advance bill numbers.
   */
  async convertAdvanceInvoiceToFinalBill(
    tx: any,
    tenantId: string,
    advanceInvoiceId: string,
  ) {
    const advanceInvoice = await tx.invoice.findFirst({
      where: { id: advanceInvoiceId, tenantId, deletedAt: null },
      include: {
        items: true,
        customer: true,
        payments: { orderBy: { date: 'asc' } },
      },
    });

    if (!advanceInvoice || !advanceInvoice.isAdvance || advanceInvoice.advanceConverted) {
      return null;
    }

    // 1. Fetch tenant profile to get regular invoice prefix & next counter
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) return null;

    const nextCounter = tenant.invoiceCounter + 1;
    const formattedCounter = String(nextCounter).padStart(5, '0');
    const finalInvoiceNumber = `${tenant.invoicePrefix || 'INV'}-${formattedCounter}`;

    await tx.tenant.update({
      where: { id: tenantId },
      data: { invoiceCounter: nextCounter },
    });

    const previousAdvanceNumber = advanceInvoice.invoiceNumber;
    const finalNotes = advanceInvoice.notes
      ? `${advanceInvoice.notes} | Converted from Advance Bill #${previousAdvanceNumber}`
      : `Converted from Advance Bill #${previousAdvanceNumber}`;

    // 2. In-place upgrade of the advance bill into the regular Tax Invoice:
    // - Converts the bill number to the next regular sequential invoice number (e.g. INV-00064)
    // - Sets isAdvance to false so it is now a standard regular bill
    // - Keeps all payment history intact on this bill so everyone can see each advance installment
    // - Sets amountDue to 0 and status to PAID
    const updatedFinalInvoice = await tx.invoice.update({
      where: { id: advanceInvoice.id },
      data: {
        invoiceNumber: finalInvoiceNumber,
        isAdvance: false,
        advanceConverted: true,
        convertedFromAdvanceNumber: previousAdvanceNumber,
        status: 'PAID',
        amountPaid: advanceInvoice.totalAmount,
        amountDue: 0,
        notes: finalNotes,
      },
      include: {
        items: true,
        customer: true,
        payments: { orderBy: { date: 'asc' } },
      },
    });

    return updatedFinalInvoice;
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  // ─── Purchase Invoices ──────────────────────────────────────────────────────

  async list(tenantId: string, vendorId?: string, status?: any, search?: string) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (status) {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { purchaseNumber: { contains: q, mode: 'insensitive' } },
        { billNumber: { contains: q, mode: 'insensitive' } },
        { vendor: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.purchaseInvoice.findMany({
      where,
      include: {
        vendor: true,
        items: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const purchase = await this.prisma.purchaseInvoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        vendor: true,
        items: {
          include: { product: true },
        },
        payments: true,
        tenant: {
          select: {
            name: true,
            gstin: true,
            address: true,
            phone: true,
            email: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase invoice not found.');
    }

    return purchase;
  }

  async create(tenantId: string, data: any) {
    let {
      vendorId,
      vendorName,
      vendorGstin,
      vendorPhone,
      vendorAddress,
      billNumber,
      date,
      dueDate,
      notes,
      items,
      discountAmount: directDiscount,
      status,
      autoRestock = true,
      amountPaid: initialPaid = 0,
      paymentMethod = 'BANK_TRANSFER',
      paymentReference,
    } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('At least one item is required in the purchase invoice.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve or create vendor
      if (!vendorId && vendorName && vendorName.trim()) {
        const existingVendor = await tx.vendor.findFirst({
          where: { tenantId, name: { equals: vendorName.trim(), mode: 'insensitive' }, deletedAt: null },
        });

        if (existingVendor) {
          vendorId = existingVendor.id;
        } else {
          const newVendor = await tx.vendor.create({
            data: {
              tenantId,
              name: vendorName.trim(),
              gstin: vendorGstin?.trim() || null,
              phone: vendorPhone?.trim() || null,
              address: vendorAddress?.trim() || null,
            },
          });
          vendorId = newVendor.id;
        }
      }

      if (!vendorId) {
        throw new BadRequestException('Vendor is required. Select an existing vendor or enter vendor name.');
      }

      const vendor = await tx.vendor.findFirst({
        where: { id: vendorId, tenantId, deletedAt: null },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found.');
      }

      // 2. Generate purchase number
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found.');
      }

      const nextCounter = (tenant.purchaseCounter || 0) + 1;
      const formattedCounter = String(nextCounter).padStart(5, '0');
      const purchasePrefix = tenant.purchasePrefix || 'PUR';
      const purchaseNumber = `${purchasePrefix}-${formattedCounter}`;

      await tx.tenant.update({
        where: { id: tenantId },
        data: { purchaseCounter: nextCounter },
      });

      // 3. Calculate line items
      let subTotal = 0;
      let taxAmount = 0;
      let discountAmount = directDiscount || 0;
      const processedItems: any[] = [];

      for (const item of items) {
        const product = item.productId
          ? await tx.product.findFirst({ where: { id: item.productId, tenantId, deletedAt: null } })
          : null;

        const price = Number(item.price ?? product?.purchasePrice ?? 0);
        const taxRate = Number(item.taxRate ?? product?.taxRate ?? 0);
        const discountRate = Number(item.discountRate ?? 0);
        const qty = Number(item.qty ?? 1);

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

        // 4. Auto-restock inventory & update product purchase price
        if (autoRestock && product) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: { increment: qty },
              ...(price > 0 ? { purchasePrice: price } : {}),
            },
          });
        }
      }

      const totalAmount = subTotal + taxAmount;
      const parsedInitialPaid = Math.min(Number(initialPaid || 0), totalAmount);
      const amountDue = totalAmount - parsedInitialPaid;

      // Status determination
      let finalStatus: any = status || 'RECEIVED';
      if (parsedInitialPaid >= totalAmount && totalAmount > 0) {
        finalStatus = 'PAID';
      } else if (parsedInitialPaid > 0) {
        finalStatus = 'PARTIALLY_PAID';
      }

      const purchaseDate = date ? new Date(date) : new Date();
      let calculatedDueDate = dueDate ? new Date(dueDate) : null;
      if (!calculatedDueDate && tenant.dueDays) {
        calculatedDueDate = new Date(purchaseDate);
        calculatedDueDate.setDate(calculatedDueDate.getDate() + tenant.dueDays);
      }

      // 5. Create purchase invoice
      const purchaseInvoice = await tx.purchaseInvoice.create({
        data: {
          tenantId,
          vendorId,
          purchaseNumber,
          billNumber: billNumber?.trim() || null,
          date: purchaseDate,
          dueDate: calculatedDueDate,
          status: finalStatus,
          subTotal,
          taxAmount,
          discountAmount,
          totalAmount,
          amountPaid: parsedInitialPaid,
          amountDue,
          notes: notes?.trim() || null,
          items: {
            create: processedItems,
          },
        },
        include: {
          items: true,
          vendor: true,
        },
      });

      // 6. Record payment if initial payment was made
      if (parsedInitialPaid > 0) {
        await tx.purchasePayment.create({
          data: {
            tenantId,
            vendorId,
            purchaseInvoiceId: purchaseInvoice.id,
            amount: parsedInitialPaid,
            date: purchaseDate,
            method: paymentMethod as any,
            referenceNo: paymentReference?.trim() || null,
            notes: 'Initial payment upon purchase creation',
          },
        });
      }

      // 7. Update vendor outstanding balance (Accounts Payable)
      if (finalStatus !== 'CANCELLED' && finalStatus !== 'DRAFT') {
        await tx.vendor.update({
          where: { id: vendorId },
          data: {
            outstandingBalance: { increment: amountDue },
          },
        });
      }

      return purchaseInvoice;
    });
  }

  async delete(tenantId: string, id: string) {
    const purchase = await this.prisma.purchaseInvoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase invoice not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Revert stock if it was received
      if (purchase.status !== 'DRAFT' && purchase.status !== 'CANCELLED') {
        for (const item of purchase.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.qty } },
            });
          }
        }

        // Revert vendor outstanding balance
        if (purchase.amountDue > 0) {
          await tx.vendor.update({
            where: { id: purchase.vendorId },
            data: { outstandingBalance: { decrement: purchase.amountDue } },
          });
        }
      }

      return tx.purchaseInvoice.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  // ─── Vendors ───────────────────────────────────────────────────────────────

  async listVendors(tenantId: string, search?: string) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { gstin: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.vendor.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { purchaseInvoices: true },
        },
      },
    });
  }

  async createVendor(tenantId: string, data: any) {
    const { name, email, phone, address, gstin, stateCode } = data;

    if (!name || !name.trim()) {
      throw new BadRequestException('Vendor name is required.');
    }

    return this.prisma.vendor.create({
      data: {
        tenantId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        gstin: gstin?.trim() || null,
        stateCode: stateCode?.trim() || (gstin ? gstin.slice(0, 2) : null),
      },
    });
  }

  async recordPayment(tenantId: string, data: any) {
    const { vendorId, purchaseInvoiceId, amount, date, method, referenceNo, notes } = data;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findFirst({
        where: { id: vendorId, tenantId, deletedAt: null },
      });
      if (!vendor) {
        throw new NotFoundException('Vendor not found.');
      }

      let invoice: any = null;
      if (purchaseInvoiceId) {
        invoice = await tx.purchaseInvoice.findFirst({
          where: { id: purchaseInvoiceId, tenantId, deletedAt: null },
        });

        if (invoice) {
          const newAmountPaid = invoice.amountPaid + parsedAmount;
          const newAmountDue = Math.max(0, invoice.totalAmount - newAmountPaid);
          const newStatus = newAmountDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

          await tx.purchaseInvoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: newAmountPaid,
              amountDue: newAmountDue,
              status: newStatus,
            },
          });
        }
      }

      // Decrement vendor outstanding balance
      await tx.vendor.update({
        where: { id: vendorId },
        data: {
          outstandingBalance: { decrement: parsedAmount },
        },
      });

      return tx.purchasePayment.create({
        data: {
          tenantId,
          vendorId,
          purchaseInvoiceId: purchaseInvoiceId || null,
          amount: parsedAmount,
          date: date ? new Date(date) : new Date(),
          method: method || 'BANK_TRANSFER',
          referenceNo: referenceNo?.trim() || null,
          notes: notes?.trim() || null,
        },
      });
    });
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PurchasesService } from '../purchases/purchases.service';
import {
  generateDocumentNumber,
  computeDocumentTotals,
  ensureShareToken,
} from '../../common/utils/document-number.util';

const TENANT_HEADER = {
  name: true,
  gstin: true,
  address: true,
  phone: true,
  email: true,
  logoUrl: true,
  stateCode: true,
};

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private purchasesService: PurchasesService,
  ) {}

  async list(
    tenantId: string,
    vendorId?: string,
    status?: any,
    search?: string,
  ) {
    const where: any = { tenantId, deletedAt: null };

    if (vendorId) where.vendorId = vendorId;
    if (status) where.status = status;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { purchaseOrderNumber: { contains: q, mode: 'insensitive' } },
        { vendor: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.purchaseOrder.findMany({
      where,
      include: { vendor: true, items: true },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        vendor: true,
        items: { include: { product: true } },
        tenant: { select: TENANT_HEADER },
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found.');
    }

    let purchaseInvoice: any = null;
    if (order.convertedPurchaseInvoiceId) {
      purchaseInvoice = await this.prisma.purchaseInvoice.findFirst({
        where: { id: order.convertedPurchaseInvoiceId, tenantId },
        select: {
          id: true,
          purchaseNumber: true,
          status: true,
          totalAmount: true,
          amountDue: true,
          date: true,
        },
      });
    }

    return { ...order, purchaseInvoice };
  }

  async create(tenantId: string, data: any, createdById?: string) {
    const { items } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Purchase order items are required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const vendorId = await this.resolveVendor(tx, tenantId, data);

      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException('Tenant profile not found.');
      }

      const { documentNumber } = await generateDocumentNumber(tx, tenantId, {
        delegate: tx.purchaseOrder,
        numberField: 'purchaseOrderNumber',
        counterField: 'purchaseOrderCounter',
        prefix: tenant.purchaseOrderPrefix || 'PO',
        currentCounter: tenant.purchaseOrderCounter || 0,
      });

      const products = await this.loadProducts(tx, tenantId, items);
      const totals = computeDocumentTotals(
        items,
        (item) => products.get(String(item.productId || '')) || null,
        data.discountAmount,
        'purchasePrice',
      );

      return tx.purchaseOrder.create({
        data: {
          tenantId,
          vendorId,
          createdById,
          purchaseOrderNumber: documentNumber,
          date: data.date ? new Date(data.date) : new Date(),
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate)
            : null,
          status: data.status || 'DRAFT',
          subTotal: totals.subTotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          paymentTerms: data.paymentTerms?.trim() || null,
          deliveryAddress:
            data.deliveryAddress?.trim() || tenant.address || null,
          termsAndConditions: data.termsAndConditions?.trim() || null,
          notes: data.notes?.trim() || null,
          items: { create: totals.items },
        },
        include: { items: true, vendor: true },
      });
    });
  }

  /** Step 5 of the process: record the approval before the PO goes out. */
  async approve(tenantId: string, id: string, approvedByName?: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!order) {
      throw new NotFoundException('Purchase order not found.');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException(
        'A cancelled purchase order cannot be approved.',
      );
    }
    if (order.approvedAt) {
      throw new BadRequestException(
        'This purchase order has already been approved.',
      );
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByName: approvedByName?.trim() || null,
      },
      include: { items: true, vendor: true },
    });
  }

  /**
   * Purchase Order → Purchase Invoice. Delegates to PurchasesService so
   * restocking, vendor outstanding balance and the plan gate behave exactly as
   * they do for a directly recorded purchase bill.
   */
  async convertToPurchaseInvoice(
    tenantId: string,
    id: string,
    overrides: any = {},
    createdById?: string,
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found.');
    }
    if (order.convertedPurchaseInvoiceId) {
      throw new BadRequestException(
        'A supplier bill has already been recorded against this purchase order.',
      );
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException(
        'A cancelled purchase order cannot be received.',
      );
    }
    if (order.items.length === 0) {
      throw new BadRequestException('This purchase order has no items.');
    }

    const purchaseInvoice = await this.purchasesService.create(
      tenantId,
      {
        vendorId: order.vendorId,
        billNumber: overrides.billNumber,
        date: overrides.date,
        dueDate: overrides.dueDate,
        notes: overrides.notes ?? order.notes,
        autoRestock: overrides.autoRestock ?? true,
        amountPaid: overrides.amountPaid,
        paymentMethod: overrides.paymentMethod,
        paymentReference: overrides.paymentReference,
        items: order.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          price: item.price,
          taxRate: item.taxRate,
          discountRate: item.discountRate,
          hsnCode: item.hsnCode,
        })),
      },
      createdById,
    );

    await this.prisma.$transaction([
      this.prisma.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: 'RECEIVED',
          convertedPurchaseInvoiceId: purchaseInvoice.id,
        },
      }),
      ...order.items.map((item) =>
        this.prisma.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: item.qty },
        }),
      ),
    ]);

    return purchaseInvoice;
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Purchase order not found.');
    }
    if (existing.convertedPurchaseInvoiceId) {
      throw new BadRequestException(
        'A supplier bill already exists for this purchase order, so it can no longer be edited.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const scalarUpdate: any = {};

      if (data.status !== undefined) scalarUpdate.status = data.status;
      if (data.date !== undefined) scalarUpdate.date = new Date(data.date);
      if (data.expectedDeliveryDate !== undefined) {
        scalarUpdate.expectedDeliveryDate = data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
          : null;
      }
      for (const field of [
        'paymentTerms',
        'deliveryAddress',
        'termsAndConditions',
        'notes',
      ]) {
        if (data[field] !== undefined) {
          scalarUpdate[field] = data[field]?.trim() || null;
        }
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        const products = await this.loadProducts(tx, tenantId, data.items);
        const totals = computeDocumentTotals(
          data.items,
          (item) => products.get(String(item.productId || '')) || null,
          data.discountAmount,
          'purchasePrice',
        );

        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        scalarUpdate.subTotal = totals.subTotal;
        scalarUpdate.taxAmount = totals.taxAmount;
        scalarUpdate.discountAmount = totals.discountAmount;
        scalarUpdate.totalAmount = totals.totalAmount;
        scalarUpdate.items = { create: totals.items };
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: scalarUpdate,
        include: { items: true, vendor: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Purchase order not found.');
    }
    if (existing.convertedPurchaseInvoiceId) {
      throw new BadRequestException(
        'A supplier bill already exists for this purchase order, so it cannot be deleted.',
      );
    }

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Purchase order deleted.' };
  }


  /** Public share token for the WhatsApp link, created on first share. */
  async ensureShareToken(tenantId: string, id: string) {
    return ensureShareToken(
      this.prisma.purchaseOrder,
      tenantId,
      id,
      'Purchase order not found.',
    );
  }

  /** Unauthenticated lookup for the public purchase order page (the supplier). */
  async findByShareToken(shareToken: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { shareToken, deletedAt: null },
      select: {
        purchaseOrderNumber: true,
        date: true,
        expectedDeliveryDate: true,
        status: true,
        subTotal: true,
        taxAmount: true,
        discountAmount: true,
        totalAmount: true,
        paymentTerms: true,
        deliveryAddress: true,
        termsAndConditions: true,
        notes: true,
        approvedByName: true,
        approvedAt: true,
        vendor: { select: { name: true, phone: true, address: true, gstin: true } },
        items: {
          select: {
            name: true,
            description: true,
            qty: true,
            price: true,
            taxRate: true,
            discountRate: true,
            hsnCode: true,
            total: true,
          },
        },
        tenant: {
          select: {
            name: true,
            address: true,
            phone: true,
            email: true,
            gstin: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found or no longer available.');
    }

    return { kind: 'PURCHASE_ORDER' as const, ...order };
  }

  /** Same resolve-or-create behaviour the purchase invoice screen relies on. */
  private async resolveVendor(tx: any, tenantId: string, data: any) {
    let vendorId = data.vendorId;

    if (!vendorId && data.vendorName && data.vendorName.trim()) {
      const existing = await tx.vendor.findFirst({
        where: {
          tenantId,
          name: { equals: data.vendorName.trim(), mode: 'insensitive' },
          deletedAt: null,
        },
      });

      if (existing) {
        vendorId = existing.id;
      } else {
        const created = await tx.vendor.create({
          data: {
            tenantId,
            name: data.vendorName.trim(),
            gstin: data.vendorGstin?.trim() || null,
            phone: data.vendorPhone?.trim() || null,
            email: data.vendorEmail?.trim() || null,
            address: data.vendorAddress?.trim() || null,
          },
        });
        vendorId = created.id;
      }
    }

    if (!vendorId) {
      throw new BadRequestException(
        'Supplier is required. Select an existing vendor or enter a supplier name.',
      );
    }

    const vendor = await tx.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }

    return vendorId;
  }

  private async loadProducts(tx: any, tenantId: string, items: any[]) {
    const ids = items
      .map((item) => String(item.productId || '').trim())
      .filter((id) => id !== '');

    if (ids.length === 0) return new Map<string, any>();

    const products = await tx.product.findMany({
      where: { id: { in: ids }, tenantId, deletedAt: null },
    });

    return new Map<string, any>(products.map((p: any) => [p.id, p]));
  }
}

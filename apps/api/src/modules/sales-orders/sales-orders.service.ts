import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
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
export class SalesOrdersService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  async list(
    tenantId: string,
    customerId?: string,
    status?: any,
    search?: string,
  ) {
    const where: any = { tenantId, deletedAt: null };

    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { salesOrderNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.salesOrder.findMany({
      where,
      include: {
        customer: true,
        items: true,
        quotation: { select: { id: true, quotationNumber: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } },
        quotation: { select: { id: true, quotationNumber: true, date: true } },
        tenant: { select: TENANT_HEADER },
      },
    });

    if (!order) {
      throw new NotFoundException('Sales order not found.');
    }

    // Resolve the billed invoice for the pipeline view, if there is one.
    let invoice: any = null;
    if (order.convertedInvoiceId) {
      invoice = await this.prisma.invoice.findFirst({
        where: { id: order.convertedInvoiceId, tenantId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          amountDue: true,
          date: true,
        },
      });
    }

    return { ...order, invoice };
  }

  async create(tenantId: string, data: any, createdById?: string) {
    const { customerId, items } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Sales order items are required.');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return this.prisma.$transaction(async (tx) =>
      this.createWithin(tx, tenantId, data, createdById),
    );
  }

  /**
   * Quotation → Sales Order. Copies the quoted lines forward, marks the
   * quotation CONVERTED and records the link both ways. Any field passed in
   * `overrides` (dates, terms, ship-to) wins over the quoted value.
   */
  async createFromQuotation(
    tenantId: string,
    quotationId: string,
    overrides: any = {},
    createdById?: string,
  ) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found.');
    }
    if (quotation.status === 'CONVERTED' || quotation.convertedSalesOrderId) {
      throw new BadRequestException(
        'This quotation has already been converted into a sales order.',
      );
    }
    if (quotation.status === 'REJECTED') {
      throw new BadRequestException(
        'A rejected quotation cannot be converted into a sales order.',
      );
    }
    if (quotation.items.length === 0) {
      throw new BadRequestException('This quotation has no items to order.');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await this.createWithin(
        tx,
        tenantId,
        {
          customerId: quotation.customerId,
          quotationId: quotation.id,
          date: overrides.date,
          expectedDeliveryDate: overrides.expectedDeliveryDate,
          status: overrides.status || 'CONFIRMED',
          paymentTerms: overrides.paymentTerms ?? quotation.paymentTerms,
          deliveryTerms: overrides.deliveryTerms ?? quotation.deliveryTerms,
          notes: overrides.notes ?? quotation.notes,
          shipToName: overrides.shipToName,
          shipToAddress: overrides.shipToAddress,
          shipToGstin: overrides.shipToGstin,
          shipToState: overrides.shipToState,
          items: quotation.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            description: item.description,
            qty: item.qty,
            price: item.price,
            taxRate: item.taxRate,
            discountRate: item.discountRate,
            hsnCode: item.hsnCode,
          })),
        },
        createdById,
      );

      await tx.quotation.update({
        where: { id: quotation.id },
        data: { status: 'CONVERTED', convertedSalesOrderId: order.id },
      });

      return order;
    });
  }

  /**
   * Sales Order → Invoice. Delegates to InvoicesService so the bill is created
   * by exactly the same code path as a manually raised one — stock movement,
   * customer outstanding balance and the plan limit all behave identically.
   */
  async convertToInvoice(
    tenantId: string,
    id: string,
    overrides: any = {},
    createdById?: string,
  ) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Sales order not found.');
    }
    if (order.convertedInvoiceId) {
      throw new BadRequestException(
        'This sales order has already been billed.',
      );
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('A cancelled sales order cannot be billed.');
    }
    if (order.items.length === 0) {
      throw new BadRequestException('This sales order has no items to bill.');
    }

    const invoice = await this.invoicesService.create(
      tenantId,
      {
        customerId: order.customerId,
        date: overrides.date,
        notes: overrides.notes ?? order.notes,
        status: overrides.status,
        paymentTerms: order.paymentTerms,
        termsOfDelivery: order.deliveryTerms,
        // Carry the order reference onto the bill using the fields the invoice
        // print template already renders.
        buyersOrderNo: order.salesOrderNumber,
        buyersOrderDate: order.date,
        consigneeName: order.shipToName,
        consigneeAddress: order.shipToAddress,
        consigneeGstin: order.shipToGstin,
        consigneeState: order.shipToState,
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

    // Only once the invoice exists do we close the order out. If invoice
    // creation threw (plan limit, validation) the order is left untouched.
    await this.prisma.$transaction([
      this.prisma.salesOrder.update({
        where: { id: order.id },
        data: { status: 'INVOICED', convertedInvoiceId: invoice.id },
      }),
      ...order.items.map((item) =>
        this.prisma.salesOrderItem.update({
          where: { id: item.id },
          data: { deliveredQty: item.qty },
        }),
      ),
    ]);

    return invoice;
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Sales order not found.');
    }
    if (existing.convertedInvoiceId) {
      throw new BadRequestException(
        'This sales order has already been billed and can no longer be edited.',
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
        'deliveryTerms',
        'notes',
        'shipToName',
        'shipToAddress',
        'shipToGstin',
        'shipToState',
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
          'salesPrice',
        );

        await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });

        scalarUpdate.subTotal = totals.subTotal;
        scalarUpdate.taxAmount = totals.taxAmount;
        scalarUpdate.discountAmount = totals.discountAmount;
        scalarUpdate.totalAmount = totals.totalAmount;
        scalarUpdate.items = { create: totals.items };
      }

      return tx.salesOrder.update({
        where: { id },
        data: scalarUpdate,
        include: { items: true, customer: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Sales order not found.');
    }
    if (existing.convertedInvoiceId) {
      throw new BadRequestException(
        'This sales order has already been billed and cannot be deleted.',
      );
    }

    await this.prisma.salesOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Sales order deleted.' };
  }


  /** Public share token for the WhatsApp link, created on first share. */
  async ensureShareToken(tenantId: string, id: string) {
    return ensureShareToken(
      this.prisma.salesOrder,
      tenantId,
      id,
      'Sales order not found.',
    );
  }

  /** Unauthenticated lookup for the public sales order page. */
  async findByShareToken(shareToken: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { shareToken, deletedAt: null },
      select: {
        salesOrderNumber: true,
        date: true,
        expectedDeliveryDate: true,
        status: true,
        subTotal: true,
        taxAmount: true,
        discountAmount: true,
        totalAmount: true,
        paymentTerms: true,
        deliveryTerms: true,
        notes: true,
        shipToName: true,
        shipToAddress: true,
        customer: { select: { name: true, phone: true, address: true, gstin: true } },
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
      throw new NotFoundException('Sales order not found or no longer available.');
    }

    return { kind: 'SALES_ORDER' as const, ...order };
  }

  private async createWithin(
    tx: any,
    tenantId: string,
    data: any,
    createdById?: string,
  ) {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant profile not found.');
    }

    const { documentNumber } = await generateDocumentNumber(tx, tenantId, {
      delegate: tx.salesOrder,
      numberField: 'salesOrderNumber',
      counterField: 'salesOrderCounter',
      prefix: tenant.salesOrderPrefix || 'SO',
      currentCounter: tenant.salesOrderCounter || 0,
    });

    const products = await this.loadProducts(tx, tenantId, data.items);
    const totals = computeDocumentTotals(
      data.items,
      (item) => products.get(String(item.productId || '')) || null,
      data.discountAmount,
      'salesPrice',
    );

    return tx.salesOrder.create({
      data: {
        tenantId,
        customerId: data.customerId,
        quotationId: data.quotationId || null,
        createdById,
        salesOrderNumber: documentNumber,
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
        deliveryTerms: data.deliveryTerms?.trim() || null,
        notes: data.notes?.trim() || null,
        shipToName: data.shipToName?.trim() || null,
        shipToAddress: data.shipToAddress?.trim() || null,
        shipToGstin: data.shipToGstin?.trim() || null,
        shipToState: data.shipToState?.trim() || null,
        items: { create: totals.items },
      },
      include: { items: true, customer: true },
    });
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

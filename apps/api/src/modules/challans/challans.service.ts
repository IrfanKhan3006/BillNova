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

/**
 * Delivery challans: goods leaving the premises before, or without, a bill —
 * a delivery against an order, material out for job work, a sample, or
 * returnable packaging.
 *
 * Stock leaves when the challan is dispatched, because that is when the goods
 * physically go. The invoice raised from a challan therefore must not deduct
 * the same quantity again, which is what the `skipStockMovement` flag passed
 * into InvoicesService is for.
 */
@Injectable()
export class ChallansService {
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
        { challanNumber: { contains: q, mode: 'insensitive' } },
        { vehicleNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.deliveryChallan.findMany({
      where,
      include: {
        customer: true,
        items: true,
        salesOrder: { select: { id: true, salesOrderNumber: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const challan = await this.prisma.deliveryChallan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } },
        salesOrder: {
          select: { id: true, salesOrderNumber: true, date: true },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            amountDue: true,
            date: true,
          },
        },
        tenant: { select: TENANT_HEADER },
      },
    });

    if (!challan) {
      throw new NotFoundException('Delivery challan not found.');
    }

    return challan;
  }

  async create(tenantId: string, data: any, createdById?: string) {
    const { customerId, items } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Delivery challan items are required.');
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
   * Sales Order → Delivery Challan. Carries the ordered lines and the ship-to
   * party forward, so dispatching against an order is one step.
   */
  async createFromSalesOrder(
    tenantId: string,
    salesOrderId: string,
    overrides: any = {},
    createdById?: string,
  ) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Sales order not found.');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException(
        'A cancelled sales order cannot be dispatched.',
      );
    }
    if (order.items.length === 0) {
      throw new BadRequestException(
        'This sales order has no items to dispatch.',
      );
    }

    const items =
      Array.isArray(overrides.items) && overrides.items.length > 0
        ? overrides.items
        : order.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            description: item.description,
            qty: item.qty,
            price: item.price,
            taxRate: item.taxRate,
            discountRate: item.discountRate,
            hsnCode: item.hsnCode,
          }));

    return this.prisma.$transaction(async (tx) =>
      this.createWithin(
        tx,
        tenantId,
        {
          customerId: order.customerId,
          salesOrderId: order.id,
          date: overrides.date,
          status: overrides.status,
          challanType: overrides.challanType,
          termsOfDelivery: overrides.termsOfDelivery ?? order.deliveryTerms,
          vehicleNumber: overrides.vehicleNumber,
          despatchedThrough: overrides.despatchedThrough,
          destination: overrides.destination,
          notes: overrides.notes ?? order.notes,
          shipToName: overrides.shipToName ?? order.shipToName,
          shipToAddress: overrides.shipToAddress ?? order.shipToAddress,
          shipToGstin: overrides.shipToGstin ?? order.shipToGstin,
          shipToState: overrides.shipToState ?? order.shipToState,
          items,
        },
        createdById,
      ),
    );
  }

  /**
   * Mark the goods as gone. This is the point stock moves, so it is guarded by
   * `stockApplied` and cannot be run twice.
   */
  async dispatch(tenantId: string, id: string, status = 'DISPATCHED') {
    const challan = await this.prisma.deliveryChallan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!challan) {
      throw new NotFoundException('Delivery challan not found.');
    }
    if (challan.status === 'CANCELLED') {
      throw new BadRequestException(
        'A cancelled delivery challan cannot be dispatched.',
      );
    }
    if (challan.status === 'INVOICED') {
      throw new BadRequestException(
        'This delivery challan has already been billed.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (!challan.stockApplied) {
        const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
        await this.moveStock(tx, tenantId, challan.items, tenant, 'out');
      }

      return tx.deliveryChallan.update({
        where: { id: challan.id },
        data: { status: status as any, stockApplied: true },
        include: { items: true, customer: true },
      });
    });
  }

  /**
   * Delivery Challan → Invoice. Delegates to InvoicesService so the bill is
   * created by exactly the same code path as a manually raised one — the plan
   * limit and the customer's outstanding balance behave identically.
   *
   * Stock is the one exception: if the goods already left on dispatch, the
   * bill must not deduct them a second time.
   */
  async convertToInvoice(
    tenantId: string,
    id: string,
    overrides: any = {},
    createdById?: string,
  ) {
    const challan = await this.prisma.deliveryChallan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!challan) {
      throw new NotFoundException('Delivery challan not found.');
    }
    if (challan.convertedInvoiceId) {
      throw new BadRequestException(
        'This delivery challan has already been billed.',
      );
    }
    if (challan.status === 'CANCELLED') {
      throw new BadRequestException(
        'A cancelled delivery challan cannot be billed.',
      );
    }
    if (challan.items.length === 0) {
      throw new BadRequestException(
        'This delivery challan has no items to bill.',
      );
    }

    const invoice = await this.invoicesService.create(
      tenantId,
      {
        customerId: challan.customerId,
        date: overrides.date,
        notes: overrides.notes ?? challan.notes,
        status: overrides.status,
        // The goods left stock when the challan was dispatched.
        skipStockMovement: challan.stockApplied,
        // Carry the challan reference onto the bill using the dispatch fields
        // the invoice print template already renders.
        deliveryNote: challan.challanNumber,
        deliveryNoteDate: challan.date,
        despatchDocNo: challan.challanNumber,
        despatchedThrough: challan.despatchedThrough,
        destination: challan.destination,
        vehicleNumber: challan.vehicleNumber,
        termsOfDelivery: challan.termsOfDelivery,
        consigneeName: challan.shipToName,
        consigneeAddress: challan.shipToAddress,
        consigneeGstin: challan.shipToGstin,
        consigneeState: challan.shipToState,
        items: challan.items.map((item) => ({
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

    // Only once the invoice exists do we close the challan out. If invoice
    // creation threw (plan limit, validation) the challan is left untouched.
    await this.prisma.deliveryChallan.update({
      where: { id: challan.id },
      data: { status: 'INVOICED', convertedInvoiceId: invoice.id },
    });

    return invoice;
  }

  /**
   * Cancel the challan. If the goods had already left stock they come back,
   * because a cancelled challan means nothing was dispatched after all.
   */
  async cancel(tenantId: string, id: string) {
    const challan = await this.prisma.deliveryChallan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!challan) {
      throw new NotFoundException('Delivery challan not found.');
    }
    if (challan.status === 'CANCELLED') {
      throw new BadRequestException(
        'This delivery challan is already cancelled.',
      );
    }
    if (challan.convertedInvoiceId) {
      throw new BadRequestException(
        'This delivery challan has been billed and can no longer be cancelled.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (challan.stockApplied) {
        const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
        await this.moveStock(tx, tenantId, challan.items, tenant, 'in');
      }

      return tx.deliveryChallan.update({
        where: { id: challan.id },
        data: { status: 'CANCELLED', stockApplied: false },
        include: { items: true, customer: true },
      });
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.deliveryChallan.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Delivery challan not found.');
    }
    if (existing.convertedInvoiceId) {
      throw new BadRequestException(
        'This delivery challan has already been billed and can no longer be edited.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const scalarUpdate: any = {};

      if (data.status !== undefined) scalarUpdate.status = data.status;
      if (data.date !== undefined) scalarUpdate.date = new Date(data.date);
      if (data.challanType !== undefined) {
        scalarUpdate.challanType = data.challanType;
      }
      for (const field of [
        'vehicleNumber',
        'despatchedThrough',
        'destination',
        'termsOfDelivery',
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

      // Editing the lines of a challan whose goods have already left would
      // leave the stock movement out of step with what it recorded.
      if (Array.isArray(data.items) && data.items.length > 0) {
        if (existing.stockApplied) {
          throw new BadRequestException(
            'The items on a dispatched challan cannot be changed. Cancel it and raise a new one instead.',
          );
        }

        const products = await this.loadProducts(tx, tenantId, data.items);
        const totals = computeDocumentTotals(
          data.items,
          (item) => products.get(String(item.productId || '')) || null,
          data.discountAmount,
          'salesPrice',
        );

        await tx.deliveryChallanItem.deleteMany({ where: { challanId: id } });

        scalarUpdate.subTotal = totals.subTotal;
        scalarUpdate.taxAmount = totals.taxAmount;
        scalarUpdate.discountAmount = totals.discountAmount;
        scalarUpdate.totalAmount = Math.round(totals.totalAmount);
        scalarUpdate.items = { create: totals.items };
      }

      return tx.deliveryChallan.update({
        where: { id },
        data: scalarUpdate,
        include: { items: true, customer: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.deliveryChallan.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Delivery challan not found.');
    }
    if (existing.convertedInvoiceId) {
      throw new BadRequestException(
        'This delivery challan has already been billed and cannot be deleted.',
      );
    }
    if (existing.stockApplied) {
      throw new BadRequestException(
        'This delivery challan has moved stock. Cancel it instead, so the stock is returned.',
      );
    }

    await this.prisma.deliveryChallan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Delivery challan deleted.' };
  }

  /** Public share token for the WhatsApp link, created on first share. */
  async ensureShareToken(tenantId: string, id: string) {
    return ensureShareToken(
      this.prisma.deliveryChallan,
      tenantId,
      id,
      'Delivery challan not found.',
    );
  }

  /** Unauthenticated lookup for the public delivery challan page. */
  async findByShareToken(shareToken: string) {
    const challan = await this.prisma.deliveryChallan.findFirst({
      where: { shareToken, deletedAt: null },
      select: {
        challanNumber: true,
        date: true,
        status: true,
        challanType: true,
        subTotal: true,
        taxAmount: true,
        discountAmount: true,
        totalAmount: true,
        vehicleNumber: true,
        despatchedThrough: true,
        destination: true,
        termsOfDelivery: true,
        shipToName: true,
        shipToAddress: true,
        notes: true,
        customer: {
          select: { name: true, phone: true, address: true, gstin: true },
        },
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

    if (!challan) {
      throw new NotFoundException(
        'Delivery challan not found or no longer available.',
      );
    }

    return { kind: 'DELIVERY_CHALLAN' as const, ...challan };
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
      delegate: tx.deliveryChallan,
      numberField: 'challanNumber',
      counterField: 'challanCounter',
      prefix: tenant.challanPrefix || 'DC',
      currentCounter: tenant.challanCounter || 0,
    });

    const products = await this.loadProducts(tx, tenantId, data.items);
    const totals = computeDocumentTotals(
      data.items,
      (item) => products.get(String(item.productId || '')) || null,
      data.discountAmount,
      'salesPrice',
    );

    // A challan created straight as dispatched moves stock there and then,
    // which is the common case: the paperwork is written as the vehicle leaves.
    const dispatchedOnCreate =
      data.status === 'DISPATCHED' || data.status === 'DELIVERED';

    if (dispatchedOnCreate) {
      await this.moveStock(tx, tenantId, totals.items, tenant, 'out');
    }

    return tx.deliveryChallan.create({
      data: {
        tenantId,
        customerId: data.customerId,
        salesOrderId: data.salesOrderId || null,
        createdById,
        challanNumber: documentNumber,
        date: data.date ? new Date(data.date) : new Date(),
        status: data.status || 'DRAFT',
        challanType: data.challanType || 'DELIVERY',
        stockApplied: dispatchedOnCreate,
        subTotal: totals.subTotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        // Rounded to the nearest rupee, as a bill's grand total is, so the
        // challan shows the same figure as the invoice raised from it.
        totalAmount: Math.round(totals.totalAmount),
        vehicleNumber: data.vehicleNumber?.trim() || null,
        despatchedThrough: data.despatchedThrough?.trim() || null,
        destination: data.destination?.trim() || null,
        termsOfDelivery: data.termsOfDelivery?.trim() || null,
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

  /**
   * Stock movement for the challan's lines. 'out' when the goods leave,
   * 'in' to reverse that. Services and tenants that do not track inventory
   * are skipped, as everywhere else.
   */
  private async moveStock(
    tx: any,
    tenantId: string,
    items: any[],
    tenant: any,
    direction: 'in' | 'out',
  ) {
    if (!tenant?.trackInventory) return;

    for (const item of items) {
      if (!item.productId) continue;

      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId, deletedAt: null },
        select: { id: true, isService: true },
      });
      if (!product || product.isService) continue;

      const qty = Math.max(0, Math.round(Number(item.qty) || 0));
      if (qty === 0) continue;

      await tx.product.update({
        where: { id: product.id },
        data:
          direction === 'in'
            ? { stock: { increment: qty } }
            : { stock: { decrement: qty } },
      });
    }
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

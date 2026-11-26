import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
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
 * Debit notes: the mirror of a credit note on the buying side. Raised when
 * goods go back to a supplier, or a purchase bill was overcharged, it reduces
 * what we owe that vendor.
 *
 * Same shape as the credit note service: a DRAFT is inert, issuing is what
 * moves the payable and takes the returned goods out of stock.
 */
@Injectable()
export class DebitNotesService {
  constructor(private prisma: PrismaService) {}

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
        { debitNoteNumber: { contains: q, mode: 'insensitive' } },
        { originalInvoiceNumber: { contains: q, mode: 'insensitive' } },
        { vendor: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.debitNote.findMany({
      where,
      include: {
        vendor: true,
        items: true,
        purchaseInvoice: { select: { id: true, purchaseNumber: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const note = await this.prisma.debitNote.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        vendor: true,
        items: { include: { product: true } },
        purchaseInvoice: {
          select: {
            id: true,
            purchaseNumber: true,
            billNumber: true,
            date: true,
            status: true,
            totalAmount: true,
            amountDue: true,
          },
        },
        tenant: { select: TENANT_HEADER },
      },
    });

    if (!note) {
      throw new NotFoundException('Debit note not found.');
    }

    return note;
  }

  async create(tenantId: string, data: any, createdById?: string) {
    const { vendorId, items } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Debit note items are required.');
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }

    return this.prisma.$transaction(async (tx) =>
      this.createWithin(tx, tenantId, data, createdById),
    );
  }

  /**
   * Purchase Invoice → Debit Note. Copies the purchased lines across for a
   * full return; pass `items` in `overrides` to send back only part of the
   * consignment.
   */
  async createFromPurchaseInvoice(
    tenantId: string,
    purchaseInvoiceId: string,
    overrides: any = {},
    createdById?: string,
  ) {
    const purchase = await this.prisma.purchaseInvoice.findFirst({
      where: { id: purchaseInvoiceId, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase bill not found.');
    }
    if (purchase.status === 'DRAFT') {
      throw new BadRequestException(
        'A draft purchase bill cannot be debited. Record it first, or edit it instead.',
      );
    }
    if (purchase.items.length === 0) {
      throw new BadRequestException(
        'This purchase bill has no items to debit.',
      );
    }

    const items =
      Array.isArray(overrides.items) && overrides.items.length > 0
        ? overrides.items
        : purchase.items.map((item) => ({
            productId: item.productId,
            name: item.name,
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
          vendorId: purchase.vendorId,
          purchaseInvoiceId: purchase.id,
          date: overrides.date,
          status: overrides.status,
          reason: overrides.reason,
          reasonNote: overrides.reasonNote,
          restock: overrides.restock,
          notes: overrides.notes,
          items,
        },
        createdById,
      ),
    );
  }

  /**
   * Issue the note: reduces what we owe the vendor and takes the returned
   * goods back out of stock.
   */
  async issue(tenantId: string, id: string) {
    const note = await this.prisma.debitNote.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!note) {
      throw new NotFoundException('Debit note not found.');
    }
    if (note.status === 'ISSUED') {
      throw new BadRequestException('This debit note has already been issued.');
    }
    if (note.status === 'CANCELLED') {
      throw new BadRequestException('A cancelled debit note cannot be issued.');
    }
    if (note.items.length === 0) {
      throw new BadRequestException('This debit note has no items.');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      return this.issueWithin(tx, tenantId, note, tenant);
    });
  }

  /**
   * Cancel the note, reversing precisely the effects that issuing applied.
   */
  async cancel(tenantId: string, id: string) {
    const note = await this.prisma.debitNote.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!note) {
      throw new NotFoundException('Debit note not found.');
    }
    if (note.status === 'CANCELLED') {
      throw new BadRequestException('This debit note is already cancelled.');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });

      // Returned goods come back in: cancelling the return means we kept them.
      if (note.stockApplied) {
        await this.moveStock(tx, tenantId, note.items, tenant, 'in');
      }

      if (note.ledgerApplied) {
        await tx.vendor.update({
          where: { id: note.vendorId },
          data: { outstandingBalance: { increment: note.totalAmount } },
        });

        if (note.purchaseInvoiceId && note.appliedToInvoice > 0) {
          const purchase = await tx.purchaseInvoice.findUnique({
            where: { id: note.purchaseInvoiceId },
          });

          if (purchase) {
            const amountDue = purchase.amountDue + note.appliedToInvoice;
            await tx.purchaseInvoice.update({
              where: { id: purchase.id },
              data: {
                amountDue,
                status:
                  purchase.status === 'PAID' && amountDue > 0
                    ? purchase.amountPaid > 0
                      ? 'PARTIALLY_PAID'
                      : 'RECEIVED'
                    : purchase.status,
              },
            });
          }
        }
      }

      return tx.debitNote.update({
        where: { id: note.id },
        data: {
          status: 'CANCELLED',
          stockApplied: false,
          ledgerApplied: false,
          appliedToInvoice: 0,
        },
        include: { items: true, vendor: true },
      });
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.debitNote.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Debit note not found.');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only a draft debit note can be edited. Cancel it and raise a new one instead.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const scalarUpdate: any = {};

      if (data.date !== undefined) scalarUpdate.date = new Date(data.date);
      if (data.reason !== undefined) scalarUpdate.reason = data.reason;
      if (data.restock !== undefined)
        scalarUpdate.restock = Boolean(data.restock);
      for (const field of ['reasonNote', 'notes']) {
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

        await tx.debitNoteItem.deleteMany({ where: { debitNoteId: id } });

        scalarUpdate.subTotal = totals.subTotal;
        scalarUpdate.taxAmount = totals.taxAmount;
        scalarUpdate.discountAmount = totals.discountAmount;
        scalarUpdate.totalAmount = Math.round(totals.totalAmount);
        scalarUpdate.items = { create: totals.items };
      }

      return tx.debitNote.update({
        where: { id },
        data: scalarUpdate,
        include: { items: true, vendor: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.debitNote.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Debit note not found.');
    }
    if (existing.status === 'ISSUED') {
      throw new BadRequestException(
        'An issued debit note cannot be deleted. Cancel it instead, so the debit is reversed.',
      );
    }

    await this.prisma.debitNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Debit note deleted.' };
  }

  /** Public share token for the WhatsApp link, created on first share. */
  async ensureShareToken(tenantId: string, id: string) {
    return ensureShareToken(
      this.prisma.debitNote,
      tenantId,
      id,
      'Debit note not found.',
    );
  }

  /** Unauthenticated lookup for the public debit note page. */
  async findByShareToken(shareToken: string) {
    const note = await this.prisma.debitNote.findFirst({
      where: { shareToken, deletedAt: null },
      select: {
        debitNoteNumber: true,
        date: true,
        status: true,
        reason: true,
        reasonNote: true,
        subTotal: true,
        taxAmount: true,
        discountAmount: true,
        totalAmount: true,
        originalInvoiceNumber: true,
        originalInvoiceDate: true,
        notes: true,
        vendor: {
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

    if (!note) {
      throw new NotFoundException(
        'Debit note not found or no longer available.',
      );
    }

    return { kind: 'DEBIT_NOTE' as const, ...note };
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

    // Snapshot the supplier's bill reference, so it survives the purchase bill
    // later being edited.
    let purchaseInvoiceId: string | null = null;
    let originalInvoiceNumber: string | null = null;
    let originalInvoiceDate: Date | null = null;

    if (data.purchaseInvoiceId) {
      const purchase = await tx.purchaseInvoice.findFirst({
        where: { id: data.purchaseInvoiceId, tenantId, deletedAt: null },
        select: {
          id: true,
          purchaseNumber: true,
          billNumber: true,
          date: true,
          totalAmount: true,
        },
      });
      if (!purchase) {
        throw new NotFoundException(
          'The purchase bill being debited was not found.',
        );
      }
      purchaseInvoiceId = purchase.id;
      // The supplier's own bill number is the meaningful reference for them;
      // fall back to our internal purchase number when it was not recorded.
      originalInvoiceNumber = purchase.billNumber || purchase.purchaseNumber;
      originalInvoiceDate = purchase.date;
    }

    const { documentNumber } = await generateDocumentNumber(tx, tenantId, {
      delegate: tx.debitNote,
      numberField: 'debitNoteNumber',
      counterField: 'debitNoteCounter',
      prefix: tenant.debitNotePrefix || 'DN',
      currentCounter: tenant.debitNoteCounter || 0,
    });

    const products = await this.loadProducts(tx, tenantId, data.items);
    const totals = computeDocumentTotals(
      data.items,
      (item) => products.get(String(item.productId || '')) || null,
      data.discountAmount,
      'purchasePrice',
    );

    // A note cannot debit more than the purchase bill it is raised against.
    if (purchaseInvoiceId) {
      const purchase = await tx.purchaseInvoice.findUnique({
        where: { id: purchaseInvoiceId },
        select: { totalAmount: true },
      });
      if (purchase && totals.totalAmount > purchase.totalAmount + 1) {
        throw new BadRequestException(
          'A debit note cannot be raised for more than the value of the purchase bill it debits.',
        );
      }
    }

    const note = await tx.debitNote.create({
      data: {
        tenantId,
        vendorId: data.vendorId,
        purchaseInvoiceId,
        createdById,
        debitNoteNumber: documentNumber,
        date: data.date ? new Date(data.date) : new Date(),
        status: 'DRAFT',
        reason: data.reason || 'PURCHASE_RETURN',
        reasonNote: data.reasonNote?.trim() || null,
        restock: data.restock === undefined ? true : Boolean(data.restock),
        originalInvoiceNumber,
        originalInvoiceDate,
        subTotal: totals.subTotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        // Rounded to the nearest rupee, exactly as a bill's grand total is, so
        // a full credit against a bill settles it to the paisa.
        totalAmount: Math.round(totals.totalAmount),
        notes: data.notes?.trim() || null,
        items: { create: totals.items },
      },
      include: { items: true, vendor: true },
    });

    if (data.status === 'ISSUED') {
      return this.issueWithin(tx, tenantId, note, tenant);
    }

    return note;
  }

  /**
   * The ledger and stock side of issuing, usable inside an existing
   * transaction.
   */
  private async issueWithin(tx: any, tenantId: string, note: any, tenant: any) {
    // Goods going back to the supplier leave our stock.
    if (note.restock) {
      await this.moveStock(tx, tenantId, note.items, tenant, 'out');
    }

    await tx.vendor.update({
      where: { id: note.vendorId },
      data: { outstandingBalance: { decrement: note.totalAmount } },
    });

    let appliedToInvoice = 0;
    if (note.purchaseInvoiceId) {
      const purchase = await tx.purchaseInvoice.findUnique({
        where: { id: note.purchaseInvoiceId },
      });

      if (
        purchase &&
        purchase.status !== 'DRAFT' &&
        purchase.status !== 'CANCELLED'
      ) {
        appliedToInvoice = Math.min(note.totalAmount, purchase.amountDue);
        const amountDue = purchase.amountDue - appliedToInvoice;

        // amountPaid is untouched: a debit note is not a payment to the vendor.
        await tx.purchaseInvoice.update({
          where: { id: purchase.id },
          data: {
            amountDue,
            status:
              amountDue === 0
                ? 'PAID'
                : purchase.amountPaid > 0
                  ? 'PARTIALLY_PAID'
                  : purchase.status,
          },
        });
      }
    }

    return tx.debitNote.update({
      where: { id: note.id },
      data: {
        status: 'ISSUED',
        stockApplied: Boolean(note.restock),
        ledgerApplied: true,
        appliedToInvoice,
      },
      include: { items: true, vendor: true },
    });
  }

  /**
   * Stock movement for the note's lines. 'out' when the goods go back to the
   * supplier, 'in' to reverse that. Services and tenants that do not track
   * inventory are skipped, as everywhere else.
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

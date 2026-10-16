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
 * Credit notes: the GST document that reduces what a customer owes us, raised
 * for a sales return, a rate difference, a post-sale discount or a
 * cancellation.
 *
 * A note is harmless while it is a DRAFT. Issuing it is what moves money and
 * stock, and that is deliberately a separate step so a mistake can be fixed
 * before anything touches the ledger.
 */
@Injectable()
export class CreditNotesService {
  constructor(private prisma: PrismaService) {}

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
        { creditNoteNumber: { contains: q, mode: 'insensitive' } },
        { originalInvoiceNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.creditNote.findMany({
      where,
      include: {
        customer: true,
        items: true,
        invoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const note = await this.prisma.creditNote.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
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
      throw new NotFoundException('Credit note not found.');
    }

    return note;
  }

  async create(tenantId: string, data: any, createdById?: string) {
    const { customerId, items } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Credit note items are required.');
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
   * Invoice → Credit Note. Copies the billed lines across so a full return is
   * one click, and snapshots the bill's number and date for the GST reference
   * on the printed note.
   *
   * `items` in `overrides` replaces the copied lines, which is how a partial
   * return is raised: send only the lines (and quantities) coming back.
   */
  async createFromInvoice(
    tenantId: string,
    invoiceId: string,
    overrides: any = {},
    createdById?: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!invoice) {
      throw new NotFoundException('Bill not found.');
    }
    if (invoice.status === 'DRAFT') {
      throw new BadRequestException(
        'A draft bill cannot be credited. Send the bill first, or edit it instead.',
      );
    }
    if (invoice.items.length === 0) {
      throw new BadRequestException('This bill has no items to credit.');
    }

    const items =
      Array.isArray(overrides.items) && overrides.items.length > 0
        ? overrides.items
        : invoice.items.map((item) => ({
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
          customerId: invoice.customerId,
          invoiceId: invoice.id,
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
   * Issue the note: this is the step that credits the customer and, for a
   * return, puts the goods back into stock. Kept separate from creating the
   * note so a mistake can be fixed while it is still a draft.
   */
  async issue(tenantId: string, id: string) {
    const note = await this.prisma.creditNote.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!note) {
      throw new NotFoundException('Credit note not found.');
    }
    if (note.status === 'ISSUED') {
      throw new BadRequestException(
        'This credit note has already been issued.',
      );
    }
    if (note.status === 'CANCELLED') {
      throw new BadRequestException(
        'A cancelled credit note cannot be issued.',
      );
    }
    if (note.items.length === 0) {
      throw new BadRequestException('This credit note has no items.');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      return this.issueWithin(tx, tenantId, note, tenant);
    });
  }

  /**
   * Cancel the note, reversing precisely the effects that were applied when it
   * was issued — never more. A note cancelled while still a draft simply
   * changes status.
   */
  async cancel(tenantId: string, id: string) {
    const note = await this.prisma.creditNote.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!note) {
      throw new NotFoundException('Credit note not found.');
    }
    if (note.status === 'CANCELLED') {
      throw new BadRequestException('This credit note is already cancelled.');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });

      if (note.stockApplied) {
        await this.moveStock(tx, tenantId, note.items, tenant, 'out');
      }

      if (note.ledgerApplied) {
        await tx.customer.update({
          where: { id: note.customerId },
          data: { outstandingBalance: { increment: note.totalAmount } },
        });

        if (note.invoiceId && note.appliedToInvoice > 0) {
          const invoice = await tx.invoice.findUnique({
            where: { id: note.invoiceId },
          });

          if (invoice) {
            const amountDue = invoice.amountDue + note.appliedToInvoice;
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                amountDue,
                status:
                  invoice.status === 'PAID' && amountDue > 0
                    ? invoice.amountPaid > 0
                      ? 'PARTIALLY_PAID'
                      : 'SENT'
                    : invoice.status,
              },
            });
          }
        }
      }

      return tx.creditNote.update({
        where: { id: note.id },
        data: {
          status: 'CANCELLED',
          stockApplied: false,
          ledgerApplied: false,
          appliedToInvoice: 0,
        },
        include: { items: true, customer: true },
      });
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.creditNote.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Credit note not found.');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only a draft credit note can be edited. Cancel it and raise a new one instead.',
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
          'salesPrice',
        );

        await tx.creditNoteItem.deleteMany({ where: { creditNoteId: id } });

        scalarUpdate.subTotal = totals.subTotal;
        scalarUpdate.taxAmount = totals.taxAmount;
        scalarUpdate.discountAmount = totals.discountAmount;
        scalarUpdate.totalAmount = Math.round(totals.totalAmount);
        scalarUpdate.items = { create: totals.items };
      }

      return tx.creditNote.update({
        where: { id },
        data: scalarUpdate,
        include: { items: true, customer: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.creditNote.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Credit note not found.');
    }
    if (existing.status === 'ISSUED') {
      throw new BadRequestException(
        'An issued credit note cannot be deleted. Cancel it instead, so the credit is reversed.',
      );
    }

    await this.prisma.creditNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Credit note deleted.' };
  }

  /** Public share token for the WhatsApp link, created on first share. */
  async ensureShareToken(tenantId: string, id: string) {
    return ensureShareToken(
      this.prisma.creditNote,
      tenantId,
      id,
      'Credit note not found.',
    );
  }

  /** Unauthenticated lookup for the public credit note page. */
  async findByShareToken(shareToken: string) {
    const note = await this.prisma.creditNote.findFirst({
      where: { shareToken, deletedAt: null },
      select: {
        creditNoteNumber: true,
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

    if (!note) {
      throw new NotFoundException(
        'Credit note not found or no longer available.',
      );
    }

    return { kind: 'CREDIT_NOTE' as const, ...note };
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

    // Snapshot the bill reference GST requires, so it survives the bill later
    // being edited or renumbered.
    let invoiceId: string | null = null;
    let originalInvoiceNumber: string | null = null;
    let originalInvoiceDate: Date | null = null;

    if (data.invoiceId) {
      const invoice = await tx.invoice.findFirst({
        where: { id: data.invoiceId, tenantId, deletedAt: null },
        select: {
          id: true,
          invoiceNumber: true,
          date: true,
          totalAmount: true,
        },
      });
      if (!invoice) {
        throw new NotFoundException('The bill being credited was not found.');
      }
      invoiceId = invoice.id;
      originalInvoiceNumber = invoice.invoiceNumber;
      originalInvoiceDate = invoice.date;
    }

    const { documentNumber } = await generateDocumentNumber(tx, tenantId, {
      delegate: tx.creditNote,
      numberField: 'creditNoteNumber',
      counterField: 'creditNoteCounter',
      prefix: tenant.creditNotePrefix || 'CN',
      currentCounter: tenant.creditNoteCounter || 0,
    });

    const products = await this.loadProducts(tx, tenantId, data.items);
    const totals = computeDocumentTotals(
      data.items,
      (item) => products.get(String(item.productId || '')) || null,
      data.discountAmount,
      'salesPrice',
    );

    // A note cannot credit more than the bill it is raised against.
    if (invoiceId) {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { totalAmount: true },
      });
      if (invoice && totals.totalAmount > invoice.totalAmount + 1) {
        throw new BadRequestException(
          'A credit note cannot be raised for more than the value of the bill it credits.',
        );
      }
    }

    const note = await tx.creditNote.create({
      data: {
        tenantId,
        customerId: data.customerId,
        invoiceId,
        createdById,
        creditNoteNumber: documentNumber,
        date: data.date ? new Date(data.date) : new Date(),
        status: 'DRAFT',
        reason: data.reason || 'SALES_RETURN',
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
      include: { items: true, customer: true },
    });

    // Issuing straight away is offered for the common case where the return is
    // already agreed; it runs the same code path as issuing it later.
    if (data.status === 'ISSUED') {
      return this.issueWithin(tx, tenantId, note, tenant);
    }

    return note;
  }

  /**
   * The ledger and stock side of issuing, usable inside an existing
   * transaction. `issue()` is the entry point for a note already saved.
   */
  private async issueWithin(tx: any, tenantId: string, note: any, tenant: any) {
    if (note.restock) {
      await this.moveStock(tx, tenantId, note.items, tenant, 'in');
    }

    await tx.customer.update({
      where: { id: note.customerId },
      data: { outstandingBalance: { decrement: note.totalAmount } },
    });

    let appliedToInvoice = 0;
    if (note.invoiceId) {
      const invoice = await tx.invoice.findUnique({
        where: { id: note.invoiceId },
      });

      if (invoice && invoice.status !== 'DRAFT' && invoice.status !== 'VOID') {
        appliedToInvoice = Math.min(note.totalAmount, invoice.amountDue);
        const amountDue = invoice.amountDue - appliedToInvoice;

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amountDue,
            status:
              amountDue === 0
                ? 'PAID'
                : invoice.amountPaid > 0
                  ? 'PARTIALLY_PAID'
                  : invoice.status,
          },
        });
      }
    }

    return tx.creditNote.update({
      where: { id: note.id },
      data: {
        status: 'ISSUED',
        stockApplied: Boolean(note.restock),
        ledgerApplied: true,
        appliedToInvoice,
      },
      include: { items: true, customer: true },
    });
  }

  /**
   * Stock movement for the note's lines. 'in' for a return coming back,
   * 'out' to reverse it. Services and tenants that do not track inventory are
   * skipped, exactly as the invoice service skips them.
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

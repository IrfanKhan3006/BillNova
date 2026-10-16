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

@Injectable()
export class QuotationsService {
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
        { quotationNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const quotations = await this.prisma.quotation.findMany({
      where,
      include: { customer: true, items: true },
      orderBy: { date: 'desc' },
    });

    // "Expired" is derived from validUntil rather than stored, so a quotation
    // that lapses overnight reads correctly without a scheduled job.
    return quotations.map((q) => ({ ...q, isExpired: this.isLapsed(q) }));
  }

  async findOne(tenantId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } },
        salesOrders: {
          where: { deletedAt: null },
          select: { id: true, salesOrderNumber: true, status: true, date: true },
        },
        tenant: { select: TENANT_HEADER },
      },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found.');
    }

    return { ...quotation, isExpired: this.isLapsed(quotation) };
  }

  async create(tenantId: string, data: any, createdById?: string) {
    const { customerId, items } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Quotation items are required.');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException('Tenant profile not found.');
      }

      const { documentNumber } = await generateDocumentNumber(tx, tenantId, {
        delegate: tx.quotation,
        numberField: 'quotationNumber',
        counterField: 'quotationCounter',
        prefix: tenant.quotationPrefix || 'QT',
        currentCounter: tenant.quotationCounter || 0,
      });

      const products = await this.loadProducts(tx, tenantId, items);
      const totals = computeDocumentTotals(
        items,
        (item) => products.get(String(item.productId || '')) || null,
        data.discountAmount,
        'salesPrice',
      );

      const date = data.date ? new Date(data.date) : new Date();
      let validUntil = data.validUntil ? new Date(data.validUntil) : null;
      if (!validUntil) {
        // Default validity window; the PDF treats validity as mandatory on a
        // quotation, so we always give the customer a stated date.
        validUntil = new Date(date);
        validUntil.setDate(validUntil.getDate() + 15);
      }

      return tx.quotation.create({
        data: {
          tenantId,
          customerId,
          createdById,
          quotationNumber: documentNumber,
          date,
          validUntil,
          status: data.status || 'DRAFT',
          subTotal: totals.subTotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          paymentTerms: data.paymentTerms?.trim() || null,
          deliveryTerms: data.deliveryTerms?.trim() || null,
          notes: data.notes?.trim() || null,
          items: { create: totals.items },
        },
        include: { items: true, customer: true },
      });
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.quotation.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Quotation not found.');
    }
    if (existing.status === 'CONVERTED') {
      throw new BadRequestException(
        'This quotation has already become a sales order and can no longer be edited.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const scalarUpdate: any = {};

      if (data.status !== undefined) scalarUpdate.status = data.status;
      if (data.date !== undefined) scalarUpdate.date = new Date(data.date);
      if (data.validUntil !== undefined) {
        scalarUpdate.validUntil = data.validUntil
          ? new Date(data.validUntil)
          : null;
      }
      if (data.paymentTerms !== undefined) {
        scalarUpdate.paymentTerms = data.paymentTerms?.trim() || null;
      }
      if (data.deliveryTerms !== undefined) {
        scalarUpdate.deliveryTerms = data.deliveryTerms?.trim() || null;
      }
      if (data.notes !== undefined) {
        scalarUpdate.notes = data.notes?.trim() || null;
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        const products = await this.loadProducts(tx, tenantId, data.items);
        const totals = computeDocumentTotals(
          data.items,
          (item) => products.get(String(item.productId || '')) || null,
          data.discountAmount,
          'salesPrice',
        );

        await tx.quotationItem.deleteMany({ where: { quotationId: id } });

        scalarUpdate.subTotal = totals.subTotal;
        scalarUpdate.taxAmount = totals.taxAmount;
        scalarUpdate.discountAmount = totals.discountAmount;
        scalarUpdate.totalAmount = totals.totalAmount;
        scalarUpdate.items = { create: totals.items };
      }

      return tx.quotation.update({
        where: { id },
        data: scalarUpdate,
        include: { items: true, customer: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.quotation.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Quotation not found.');
    }
    if (existing.status === 'CONVERTED') {
      throw new BadRequestException(
        'This quotation has already become a sales order and cannot be deleted.',
      );
    }

    await this.prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Quotation deleted.' };
  }


  /** Public share token for the WhatsApp link, created on first share. */
  async ensureShareToken(tenantId: string, id: string) {
    return ensureShareToken(
      this.prisma.quotation,
      tenantId,
      id,
      'Quotation not found.',
    );
  }

  /**
   * Unauthenticated lookup for the public quotation page. Returns only what the
   * customer needs to read their own quote — never tenant plan/billing internals.
   */
  async findByShareToken(shareToken: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { shareToken, deletedAt: null },
      select: {
        quotationNumber: true,
        date: true,
        validUntil: true,
        status: true,
        subTotal: true,
        taxAmount: true,
        discountAmount: true,
        totalAmount: true,
        paymentTerms: true,
        deliveryTerms: true,
        notes: true,
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

    if (!quotation) {
      throw new NotFoundException('Quotation not found or no longer available.');
    }

    return { kind: 'QUOTATION' as const, ...quotation };
  }

  private isLapsed(quotation: { validUntil: Date | null; status: string }) {
    if (!quotation.validUntil) return false;
    if (quotation.status === 'CONVERTED' || quotation.status === 'ACCEPTED') {
      return false;
    }
    return quotation.validUntil.getTime() < Date.now();
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

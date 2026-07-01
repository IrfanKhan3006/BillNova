import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ─── Categories ────────────────────────────────────────────────────────────
  async listCategories(tenantId: string) {
    return this.prisma.productCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(tenantId: string, data: any) {
    return this.prisma.productCategory.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
      },
    });
  }

  async updateCategory(tenantId: string, id: string, data: any) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Category nahi mili.');
    }

    return this.prisma.productCategory.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async removeCategory(tenantId: string, id: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Category nahi mili.');
    }

    return this.prisma.productCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Products ─────────────────────────────────────────────────────────────
  async list(tenantId: string, search?: string, categoryId?: string) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product nahi mila.');
    }

    return product;
  }

  async create(tenantId: string, data: any) {
    if (data.categoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: { id: data.categoryId, tenantId, deletedAt: null },
      });
      if (!category) {
        throw new NotFoundException('Selected category nahi mili.');
      }
    }

    return this.prisma.product.create({
      data: {
        tenantId,
        categoryId: data.categoryId || null,
        name: data.name,
        sku: data.sku || null,
        barcode: data.barcode || null,
        description: data.description || null,
        salesPrice: data.salesPrice ?? 0,
        purchasePrice: data.purchasePrice ?? 0,
        taxRate: data.taxRate ?? 0,
        unit: data.unit ?? 'PCS',
        stock: data.stock ?? 0,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    await this.findOne(tenantId, id);

    if (data.categoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: { id: data.categoryId, tenantId, deletedAt: null },
      });
      if (!category) {
        throw new NotFoundException('Selected category nahi mili.');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        categoryId: data.categoryId !== undefined ? data.categoryId : undefined,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        description: data.description,
        salesPrice: data.salesPrice,
        purchasePrice: data.purchasePrice,
        taxRate: data.taxRate,
        unit: data.unit,
        stock: data.stock,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

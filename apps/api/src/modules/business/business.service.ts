import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async getProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        gstin: true,
        stateCode: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        invoicePrefix: true,
        invoiceCounter: true,
        dueDays: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile nahi mila.');
    }

    return tenant;
  }

  async updateProfile(tenantId: string, updateData: any) {
    // Only allow updating certain fields
    const {
      name,
      gstin,
      stateCode,
      address,
      phone,
      email,
      logoUrl,
      invoicePrefix,
      dueDays,
    } = updateData;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        gstin,
        stateCode,
        address,
        phone,
        email,
        logoUrl,
        invoicePrefix,
        dueDays,
      },
    });
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async list(
    tenantId: string,
    filters: { status?: string; from?: string; to?: string; search?: string } = {},
  ) {
    const where: any = { tenantId, deletedAt: null };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.from || filters.to) {
      where.startsAt = {};
      if (filters.from) where.startsAt.gte = new Date(filters.from);
      if (filters.to) {
        // `to` is a plain date, so include the whole of that day.
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        where.startsAt.lte = end;
      }
    }

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { service: { contains: search, mode: 'insensitive' } },
        { staffName: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    return appointment;
  }

  async create(tenantId: string, data: any, createdById?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found for this business.');
    }

    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Appointment date/time is not valid.');
    }

    return this.prisma.appointment.create({
      data: {
        tenantId,
        createdById,
        customerId: data.customerId,
        service: data.service.trim(),
        staffName: data.staffName?.trim() || null,
        startsAt,
        durationMins: Number(data.durationMins) > 0 ? Number(data.durationMins) : 60,
        notes: data.notes?.trim() || null,
        status: data.status || 'SCHEDULED',
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    await this.findOne(tenantId, id);

    const patch: any = {};
    if (data.service !== undefined) patch.service = data.service.trim();
    if (data.staffName !== undefined) patch.staffName = data.staffName?.trim() || null;
    if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;
    if (data.status !== undefined) patch.status = data.status;
    if (data.invoiceId !== undefined) patch.invoiceId = data.invoiceId || null;
    if (data.customerId !== undefined) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: data.customerId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) {
        throw new BadRequestException('Customer not found for this business.');
      }
      patch.customerId = data.customerId;
    }
    if (data.durationMins !== undefined) {
      const mins = Number(data.durationMins);
      if (!Number.isFinite(mins) || mins <= 0) {
        throw new BadRequestException('Duration must be more than zero minutes.');
      }
      patch.durationMins = Math.round(mins);
    }
    if (data.startsAt !== undefined) {
      const startsAt = new Date(data.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        throw new BadRequestException('Appointment date/time is not valid.');
      }
      patch.startsAt = startsAt;
    }

    return this.prisma.appointment.update({
      where: { id },
      data: patch,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
  }

  /** Soft delete, so a cancelled booking can still be traced. */
  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Appointment deleted.' };
  }
}

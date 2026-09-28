import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, TenantPlan } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { hashPassword } from '../../common/utils/password.util';

export const MAX_TEAM_USERS = 2;

// Team logins look like "ravi@irfantradingco.com" — domain built from the business name.
export function teamEmailDomain(businessName: string) {
  const base = businessName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'business';
  return `${base}.com`;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Business profile not found.');
    }
    return tenant;
  }

  // Team users are a paid-plan feature; FREE trial businesses cannot use it.
  private isPlanActive(tenant: {
    plan: TenantPlan;
    subscriptionStatus: string;
    planExpiresAt: Date | null;
  }) {
    if (tenant.plan === TenantPlan.FREE) return false;
    if (tenant.subscriptionStatus === 'EXPIRED') return false;
    return !tenant.planExpiresAt || tenant.planExpiresAt > new Date();
  }

  async listTeam(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    const users = await this.prisma.user.findMany({
      where: { tenantId, role: Role.USER, deletedAt: null },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      enabled: this.isPlanActive(tenant),
      maxUsers: MAX_TEAM_USERS,
      emailDomain: teamEmailDomain(tenant.name),
      users,
    };
  }

  async createTeamUser(
    tenantId: string,
    dto: { name: string; username: string; password: string },
  ) {
    const tenant = await this.getTenant(tenantId);
    if (!this.isPlanActive(tenant)) {
      throw new ForbiddenException(
        'Team users are available after your plan is activated.',
      );
    }

    const count = await this.prisma.user.count({
      where: { tenantId, role: Role.USER, deletedAt: null },
    });
    if (count >= MAX_TEAM_USERS) {
      throw new BadRequestException(
        `You can create only ${MAX_TEAM_USERS} users. Remove one to add another.`,
      );
    }

    const username = dto.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(username)) {
      throw new BadRequestException(
        'Username can only have letters, numbers, dot, dash and underscore.',
      );
    }
    const email = `${username}@${teamEmailDomain(tenant.name)}`;

    // Login is by email alone, so it must be unique across all active accounts.
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`${email} is already taken. Try another username.`);
    }

    const data = {
      name: dto.name.trim(),
      passwordHash: await hashPassword(dto.password),
      role: Role.USER,
      isActive: true,
      deletedAt: null,
    };

    // (tenantId, email) is unique, so a removed user's row is reused
    // when the same username is created again.
    const removed = await this.prisma.user.findFirst({
      where: { tenantId, email, deletedAt: { not: null } },
    });
    const user = removed
      ? await this.prisma.user.update({ where: { id: removed.id }, data })
      : await this.prisma.user.create({ data: { ...data, tenantId, email } });
    return { id: user.id, name: user.name, email: user.email, isActive: user.isActive };
  }

  private async getTeamUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, role: Role.USER, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async changeTeamUserPassword(tenantId: string, userId: string, password: string) {
    await this.getTeamUser(tenantId, userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password) },
    });
    return { success: true };
  }

  async removeTeamUser(tenantId: string, userId: string) {
    await this.getTeamUser(tenantId, userId);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false, deletedAt: new Date() },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    return { success: true };
  }
}

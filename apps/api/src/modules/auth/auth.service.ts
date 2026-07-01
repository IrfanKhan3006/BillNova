import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────
  async register(dto: RegisterDto, meta: { userAgent?: string; ipAddress?: string }) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Is email se pehle se account hai. Login karo.');
    }

    const slug = await this.generateUniqueSlug(dto.businessName);

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.businessName, slug, phone: dto.phone },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.ownerName,
          email: dto.email,
          passwordHash,
          role: 'OWNER',
        },
      });

      return { tenant, user };
    });

    const tokens = await this.generateTokens(user, meta);

    return {
      user: {
        id: user.id,
        tenantId: tenant.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          gstin: tenant.gstin,
          plan: tenant.plan,
          logoUrl: tenant.logoUrl,
          address: tenant.address,
          phone: tenant.phone,
        },
      },
      tokens,
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto, meta: { userAgent?: string; ipAddress?: string }) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true, deletedAt: null },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Email ya password galat hai.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ya password galat hai.');
    }

    if (user.tenant.deletedAt) {
      throw new UnauthorizedException('Account inactive kar diya gaya hai.');
    }

    const tokens = await this.generateTokens(user, meta);

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          gstin: user.tenant.gstin,
          plan: user.tenant.plan,
          logoUrl: user.tenant.logoUrl,
          address: user.tenant.address,
          phone: user.tenant.phone,
        },
      },
      tokens,
    };
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────
  async refreshTokens(refreshToken: string, meta: { userAgent?: string; ipAddress?: string }) {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, isRevoked: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token invalid ya expired. Dobara login karo.');
    }

    if (!storedToken.user.isActive || storedToken.user.deletedAt) {
      throw new UnauthorizedException('Account inactive hai.');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    return this.generateTokens(storedToken.user, meta);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  async logout(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash },
      data: { isRevoked: true },
    });
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // ─── Me ───────────────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        tenant: {
          select: { id: true, name: true, slug: true, gstin: true, plan: true, logoUrl: true, address: true, phone: true },
        },
      },
    });

    if (!user) throw new UnauthorizedException('User nahi mila.');
    return user;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private async generateTokens(
    user: { id: string; tenantId: string; email: string; role: string },
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    const payload = { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateUniqueSlug(businessName: string): Promise<string> {
    let slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);

    let counter = 0;
    let candidate = slug;

    while (true) {
      const existing = await this.prisma.tenant.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
      candidate = `${slug}-${++counter}`;
    }
  }
}
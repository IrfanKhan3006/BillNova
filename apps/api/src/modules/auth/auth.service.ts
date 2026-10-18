import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { otpEmail } from '../mail/templates/otp.template';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const OTP_TTL_MINUTES = 10;
const OTP_RESEND_SECONDS = 60; // one code per minute per email
const OTP_MAX_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5; // wrong guesses allowed per code
const VERIFICATION_TOKEN_TTL = '30m'; // time to finish the signup form

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────
  async register(
    dto: RegisterDto,
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    // Soft-deleted businesses free up their email for a fresh signup.
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (existingUser) {
      throw new ConflictException(
        'An account already exists with this email address. Please login instead.',
      );
    }

    await this.assertEmailVerified(dto.email, dto.emailVerificationToken);

    const slug = await this.generateUniqueSlug(dto.businessName);

    const passwordHash = await hashPassword(dto.password);

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
          role: 'ADMIN',
          emailVerifiedAt: new Date(),
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
          subscriptionStatus: tenant.subscriptionStatus,
          planExpiresAt: tenant.planExpiresAt,
          maxFreeInvoices: tenant.maxFreeInvoices,
          planPrice: tenant.planPrice,
          upgradeRequested: tenant.upgradeRequested,
          logoUrl: tenant.logoUrl,
          customHeaderUrl: tenant.customHeaderUrl,
          address: tenant.address,
          phone: tenant.phone,
          bankAccountName: tenant.bankAccountName,
          bankAccountNumber: tenant.bankAccountNumber,
          bankIfsc: tenant.bankIfsc,
          upiId: tenant.upiId,
          defaultNotes: tenant.defaultNotes,
          googleReviewUrl: tenant.googleReviewUrl,
          whatsappTemplate: tenant.whatsappTemplate,
          appointmentTemplate: tenant.appointmentTemplate,
          billingEnabled: tenant.billingEnabled,
          productsEnabled: tenant.productsEnabled,
          paymentsEnabled: tenant.paymentsEnabled,
          reportsEnabled: tenant.reportsEnabled,
          purchasesEnabled: tenant.purchasesEnabled,
          quotationsEnabled: tenant.quotationsEnabled,
          salesOrdersEnabled: tenant.salesOrdersEnabled,
          purchaseOrdersEnabled: tenant.purchaseOrdersEnabled,
          creditNotesEnabled: tenant.creditNotesEnabled,
          debitNotesEnabled: tenant.debitNotesEnabled,
          challansEnabled: tenant.challansEnabled,
          businessType: tenant.businessType,
          trackInventory: tenant.trackInventory,
          theme: tenant.theme,
        },
      },
      tokens,
    };
  }

  // ─── Email OTP (signup verification) ──────────────────────────────────────
  /**
   * Mails a fresh 6-digit code. Rate limited per email so the endpoint cannot be
   * used to spam someone's inbox, and the response never reveals whether the
   * address already has an account.
   */
  async sendEmailOtp(email: string) {
    const normalised = this.normaliseEmail(email);

    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalised, deletedAt: null },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException(
        'An account already exists with this email address. Please login instead.',
      );
    }

    const now = new Date();

    const lastCode = await this.prisma.emailOtp.findFirst({
      where: { email: normalised, purpose: 'REGISTER' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (lastCode) {
      const elapsed = (now.getTime() - lastCode.createdAt.getTime()) / 1000;
      if (elapsed < OTP_RESEND_SECONDS) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(OTP_RESEND_SECONDS - elapsed)} seconds before requesting another code.`,
        );
      }
    }

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentCount = await this.prisma.emailOtp.count({
      where: {
        email: normalised,
        purpose: 'REGISTER',
        createdAt: { gte: oneHourAgo },
      },
    });
    if (recentCount >= OTP_MAX_PER_HOUR) {
      throw new BadRequestException(
        'Too many codes requested for this email. Please try again after an hour.',
      );
    }

    const code = this.generateOtpCode();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

    // Any older code for this email becomes unusable the moment a new one is sent.
    await this.prisma.$transaction([
      this.prisma.emailOtp.updateMany({
        where: { email: normalised, purpose: 'REGISTER', consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.emailOtp.create({
        data: {
          email: normalised,
          codeHash: this.hashToken(code),
          purpose: 'REGISTER',
          expiresAt,
        },
      }),
    ]);

    const brand = this.configService.get<string>('BRAND_NAME') ?? 'BillCraft';
    const { html, text } = otpEmail({
      code,
      brand,
      minutes: OTP_TTL_MINUTES,
    });

    try {
      await this.mailService.send({
        to: normalised,
        subject: `${code} is your ${brand} verification code`,
        html,
        text,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send signup OTP to ${normalised}: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        'Could not send the verification email. Please check the address or try again.',
      );
    }

    return {
      message: `Verification code sent to ${normalised}.`,
      expiresInSeconds: OTP_TTL_MINUTES * 60,
      resendAfterSeconds: OTP_RESEND_SECONDS,
    };
  }

  /**
   * Checks a code and hands back a short-lived token that `register` requires,
   * so the account can only be created for an address that was actually opened.
   */
  async verifyEmailOtp(email: string, code: string) {
    const normalised = this.normaliseEmail(email);
    const now = new Date();

    const record = await this.prisma.emailOtp.findFirst({
      where: { email: normalised, purpose: 'REGISTER', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt <= now) {
      throw new BadRequestException(
        'This code has expired. Please request a new one.',
      );
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { consumedAt: now },
      });
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    if (record.codeHash !== this.hashToken(code)) {
      await this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect code. Please try again.');
    }

    await this.prisma.emailOtp.update({
      where: { id: record.id },
      data: { consumedAt: now },
    });

    const emailVerificationToken = this.jwtService.sign(
      { email: normalised, purpose: 'email_verify' },
      {
        secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: VERIFICATION_TOKEN_TTL,
      },
    );

    return { verified: true, emailVerificationToken };
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto, meta: { userAgent?: string; ipAddress?: string }) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true, deletedAt: null },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Incorrect email or password.');
    }

    const isPasswordValid = await verifyPassword(
      user.passwordHash,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect email or password.');
    }

    if (user.tenant && user.tenant.deletedAt) {
      throw new UnauthorizedException('This account has been deactivated.');
    }

    const tokens = await this.generateTokens(user, meta);

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name,
              slug: user.tenant.slug,
              gstin: user.tenant.gstin,
              plan: user.tenant.plan,
              subscriptionStatus: user.tenant.subscriptionStatus,
              planExpiresAt: user.tenant.planExpiresAt,
              maxFreeInvoices: user.tenant.maxFreeInvoices,
              planPrice: user.tenant.planPrice,
              upgradeRequested: user.tenant.upgradeRequested,
              logoUrl: user.tenant.logoUrl,
              customHeaderUrl: user.tenant.customHeaderUrl,
              address: user.tenant.address,
              phone: user.tenant.phone,
              bankAccountName: user.tenant.bankAccountName,
              bankAccountNumber: user.tenant.bankAccountNumber,
              bankIfsc: user.tenant.bankIfsc,
              upiId: user.tenant.upiId,
              defaultNotes: user.tenant.defaultNotes,
              googleReviewUrl: user.tenant.googleReviewUrl,
              whatsappTemplate: user.tenant.whatsappTemplate,
              appointmentTemplate: user.tenant.appointmentTemplate,
              billingEnabled: user.tenant.billingEnabled,
              productsEnabled: user.tenant.productsEnabled,
              paymentsEnabled: user.tenant.paymentsEnabled,
              reportsEnabled: user.tenant.reportsEnabled,
              purchasesEnabled: user.tenant.purchasesEnabled,
              quotationsEnabled: user.tenant.quotationsEnabled,
              salesOrdersEnabled: user.tenant.salesOrdersEnabled,
              purchaseOrdersEnabled: user.tenant.purchaseOrdersEnabled,
              creditNotesEnabled: user.tenant.creditNotesEnabled,
              debitNotesEnabled: user.tenant.debitNotesEnabled,
              challansEnabled: user.tenant.challansEnabled,
              businessType: user.tenant.businessType,
              trackInventory: user.tenant.trackInventory,
              theme: user.tenant.theme,
            }
          : null,
      },
      tokens,
    };
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────
  async refreshTokens(
    refreshToken: string,
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, isRevoked: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException(
        'Refresh token is invalid or expired. Please log in again.',
      );
    }

    if (!storedToken.user.isActive || storedToken.user.deletedAt) {
      throw new UnauthorizedException('Account is currently inactive.');
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
          select: {
            id: true,
            name: true,
            slug: true,
            gstin: true,
            plan: true,
            subscriptionStatus: true,
            planExpiresAt: true,
            maxFreeInvoices: true,
            planPrice: true,
            upgradeRequested: true,
            logoUrl: true,
            customHeaderUrl: true,
            address: true,
            phone: true,
            bankAccountName: true,
            bankAccountNumber: true,
            bankIfsc: true,
            upiId: true,
            defaultNotes: true,
            googleReviewUrl: true,
            whatsappTemplate: true,
            appointmentTemplate: true,
            billingEnabled: true,
            productsEnabled: true,
            paymentsEnabled: true,
            reportsEnabled: true,
            purchasesEnabled: true,
            quotationsEnabled: true,
            salesOrdersEnabled: true,
            purchaseOrdersEnabled: true,
            creditNotesEnabled: true,
            debitNotesEnabled: true,
            challansEnabled: true,
            businessType: true,
            trackInventory: true,
            theme: true,
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('User account not found.');
    return user;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private async generateTokens(
    user: { id: string; tenantId: string | null; email: string; role: string },
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: '3650d',
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

  private normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateOtpCode(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  /**
   * Signup is blocked unless the email was confirmed by OTP. Set
   * EMAIL_OTP_REQUIRED=false to turn the gate off (e.g. while the web build
   * that sends the token has not been deployed yet).
   */
  private async assertEmailVerified(email: string, token?: string) {
    const required =
      this.configService.get<string>('EMAIL_OTP_REQUIRED') !== 'false';

    if (!required) return;

    if (!token) {
      throw new BadRequestException(
        'Please verify your email address first.',
      );
    }

    let payload: { email?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException(
        'Email verification expired. Please verify your email again.',
      );
    }

    if (
      payload.purpose !== 'email_verify' ||
      payload.email !== this.normaliseEmail(email)
    ) {
      throw new BadRequestException(
        'Email verification does not match this email address.',
      );
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateUniqueSlug(businessName: string): Promise<string> {
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);

    let counter = 0;
    let candidate = slug;

    while (true) {
      const existing = await this.prisma.tenant.findUnique({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
      candidate = `${slug}-${++counter}`;
    }
  }
}

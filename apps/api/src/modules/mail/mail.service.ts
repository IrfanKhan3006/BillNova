import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Plain SMTP mailer. Works with any provider (Hostinger mailbox, Brevo, Resend,
 * Gmail app password) because everything comes from env:
 *
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
 *
 * With SMTP_HOST unset nothing is sent - the mail is logged instead, so local
 * dev and a half-configured server keep working.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {}

  get isConfigured(): boolean {
    return !!this.config.get<string>('SMTP_HOST');
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const port = Number(this.config.get('SMTP_PORT') ?? 465);
      this.transporter = nodemailer.createTransport({
        host: this.config.getOrThrow<string>('SMTP_HOST'),
        port,
        secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
        auth: {
          user: this.config.getOrThrow<string>('SMTP_USER'),
          pass: this.config.getOrThrow<string>('SMTP_PASS'),
        },
      });
    }
    return this.transporter;
  }

  async send(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn(
        `SMTP not configured - mail to ${options.to} not sent. Subject: "${options.subject}" | ${options.text}`,
      );
      return;
    }

    const from =
      this.config.get<string>('MAIL_FROM') ??
      this.config.getOrThrow<string>('SMTP_USER');

    await this.getTransporter().sendMail({ from, ...options });
    this.logger.log(`Mail sent to ${options.to}: ${options.subject}`);
  }
}

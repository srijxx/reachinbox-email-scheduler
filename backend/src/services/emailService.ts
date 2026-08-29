import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let transporter: nodemailer.Transporter | null = null;

/**
 * Returns (and lazily creates) the Nodemailer transporter for Ethereal SMTP.
 * Ethereal is a fake SMTP service that captures emails without sending them
 * to real recipients — perfect for development/testing.
 */
export async function getEmailTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (env.ETHEREAL_USER && env.ETHEREAL_PASSWORD) {
    // Use configured Ethereal credentials
    transporter = nodemailer.createTransport({
      host: env.ETHEREAL_HOST,
      port: env.ETHEREAL_PORT,
      secure: false,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASSWORD,
      },
    });
    logger.info('Ethereal transporter created with configured credentials');
  } else {
    // Auto-create an Ethereal test account
    logger.info('No Ethereal credentials configured, creating a test account...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info('Ethereal test account created', {
      user: testAccount.user,
      // Don't log the password
    });
  }

  return transporter;
}

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | null;
}

/**
 * Sends an email through Ethereal SMTP and returns the preview URL.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const t = await getEmailTransporter();

  const info = await t.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text ?? options.html.replace(/<[^>]*>/g, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  logger.info('Email sent via Ethereal', {
    messageId: info.messageId,
    to: options.to,
    subject: options.subject,
    previewUrl,
  });

  return {
    messageId: info.messageId,
    previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
  };
}

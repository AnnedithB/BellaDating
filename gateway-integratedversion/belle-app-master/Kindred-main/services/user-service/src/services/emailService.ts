import nodemailer from 'nodemailer';
import { config } from '../utils/config';
import { Logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: nodemailer.Transporter | null = null;

// Initialize transporter lazily
function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (!config.email.user || !config.email.pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  return transporter;
}

export async function sendEmail(options: EmailOptions, logger: Logger): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    logger.warn('Email not configured, skipping email send', { to: options.to, subject: options.subject });
    // In development, log the email content
    if (process.env.NODE_ENV === 'development') {
      logger.info('Email content (dev mode):', {
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
    }
    return false;
  }

  try {
    await transport.sendMail({
      from: config.email.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    logger.info('Email sent successfully', { to: options.to, subject: options.subject });
    return true;
  } catch (error: any) {
    logger.error('Failed to send email', { to: options.to, subject: options.subject, error: error.message });
    return false;
  }
}

export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string,
  logger: Logger
): Promise<boolean> {
  const verificationUrl = `${config.app.apiUrl}/auth/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #000; margin-bottom: 10px;">${config.app.name}</h1>
      </div>

      <div style="background: #f9f9f9; border-radius: 10px; padding: 30px; margin-bottom: 20px;">
        <h2 style="margin-top: 0;">Welcome, ${username}!</h2>
        <p>Thanks for signing up for ${config.app.name}. Please verify your email address to complete your registration.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: 600;">
            Verify Email Address
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${verificationUrl}" style="color: #666; word-break: break-all;">${verificationUrl}</a>
        </p>

        <p style="color: #666; font-size: 14px;">
          This link will expire in ${config.verification.emailTokenExpiryHours} hours.
        </p>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center;">
        If you didn't create an account with ${config.app.name}, you can safely ignore this email.
      </p>
    </body>
    </html>
  `;

  return sendEmail(
    {
      to: email,
      subject: `Verify your ${config.app.name} account`,
      html,
    },
    logger
  );
}

export async function sendPasswordResetEmail(
  email: string,
  username: string,
  token: string,
  logger: Logger
): Promise<boolean> {
  const resetUrl = `${config.app.url}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #000; margin-bottom: 10px;">${config.app.name}</h1>
      </div>

      <div style="background: #f9f9f9; border-radius: 10px; padding: 30px; margin-bottom: 20px;">
        <h2 style="margin-top: 0;">Password Reset Request</h2>
        <p>Hi ${username}, we received a request to reset your password.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: 600;">
            Reset Password
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #666; word-break: break-all;">${resetUrl}</a>
        </p>

        <p style="color: #666; font-size: 14px;">
          This link will expire in ${config.verification.passwordResetTokenExpiryHours} hour(s).
        </p>

        <p style="color: #e74c3c; font-size: 14px;">
          <strong>If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.</strong>
        </p>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center;">
        This is an automated message from ${config.app.name}. Please do not reply.
      </p>
    </body>
    </html>
  `;

  return sendEmail(
    {
      to: email,
      subject: `Reset your ${config.app.name} password`,
      html,
    },
    logger
  );
}

export function isEmailConfigured(): boolean {
  return !!(config.email.user && config.email.pass);
}

// Stub file - email service with minimal implementation
import { Logger } from '../utils/logger';

// Stub email service - nodemailer not installed, using console logging instead
export class EmailService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    this.logger.info(`[STUB] Verification email would be sent to ${email} with token ${token}`);
    // Stub implementation - nodemailer not available
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    this.logger.info(`[STUB] Password reset email would be sent to ${email} with token ${token}`);
    // Stub implementation - nodemailer not available
  }

  async sendWelcomeEmail(email: string): Promise<void> {
    this.logger.info(`[STUB] Welcome email would be sent to ${email}`);
    // Stub implementation - nodemailer not available
  }
}

export default EmailService;


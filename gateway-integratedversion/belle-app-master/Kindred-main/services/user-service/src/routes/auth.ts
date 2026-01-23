import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { PrismaClient, VerificationTokenType } from '@prisma/client';
import { RedisClientType } from 'redis';
import { Logger } from '../utils/logger';
import { config } from '../utils/config';
import {
  createValidationError,
  createUnauthorizedError,
  createConflictError,
  createNotFoundError,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  asyncHandler
} from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  isEmailConfigured
} from '../services/emailService';

// Types
interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  password: string;
}

// Rate limiters
const authRateLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMaxRequests,
  message: {
    status: 'error',
    message: 'Too many attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Disable the IPv6 validation since we handle it ourselves
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => {
    // Use IP + email for more granular limiting
    // Normalize IPv6 addresses (::ffff:127.0.0.1 -> 127.0.0.1)
    let ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
    const email = req.body?.email || '';
    return `${ip}-${email.toLowerCase()}`;
  }
});

const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    status: 'error',
    message: 'Too many password reset attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendVerificationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1, // 1 attempt per 5 minutes
  message: {
    status: 'error',
    message: 'Verification email already sent. Please wait before requesting another.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default function createAuthRoutes(
  prisma: PrismaClient,
  redis: RedisClientType,
  logger: Logger
): Router {
  const router = Router();

  const sessionTtlMs = Math.max(1, config.sessions.ttlHours || 24) * 60 * 60 * 1000;

  // Helper: Generate secure token
  const generateToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
  };

  // Helper: Create verification token
  const createVerificationToken = async (
    userId: string,
    type: VerificationTokenType
  ): Promise<string> => {
    const token = generateToken();
    const expiryHours = type === 'EMAIL_VERIFICATION'
      ? config.verification.emailTokenExpiryHours
      : config.verification.passwordResetTokenExpiryHours;

    // Invalidate any existing tokens of this type
    await prisma.verificationToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() }
    });

    // Create new token
    await prisma.verificationToken.create({
      data: {
        userId,
        token,
        type,
        expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000)
      }
    });

    return token;
  };

  // Helper: Validate and consume token
  const validateToken = async (
    token: string,
    type: VerificationTokenType
  ): Promise<{ valid: boolean; userId?: string; error?: string }> => {
    const tokenRecord = await prisma.verificationToken.findUnique({
      where: { token }
    });

    if (!tokenRecord) {
      return { valid: false, error: 'Invalid token' };
    }

    if (tokenRecord.type !== type) {
      return { valid: false, error: 'Invalid token type' };
    }

    if (tokenRecord.usedAt) {
      return { valid: false, error: 'Token has already been used' };
    }

    if (tokenRecord.expiresAt < new Date()) {
      return { valid: false, error: 'Token has expired' };
    }

    // Mark token as used
    await prisma.verificationToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() }
    });

    return { valid: true, userId: tokenRecord.userId };
  };

  const recordUserSession = async (userId: string, req: any) => {
    try {
      await prisma.userSession.create({
        data: {
          userId,
          status: 'ONLINE',
          ipAddress: req.ip || null,
          userAgent: req.get?.('user-agent') || null,
          expiresAt: new Date(Date.now() + sessionTtlMs)
        }
      });
    } catch (sessionError: any) {
      logger.warn('Failed to record user session', {
        userId,
        error: sessionError.message
      });
    }
  };

  const closeUserSessions = async (userId: string) => {
    try {
      await prisma.userSession.updateMany({
        where: {
          userId,
          status: { in: ['ONLINE', 'IN_CALL', 'QUEUING'] }
        },
        data: {
          status: 'OFFLINE',
          expiresAt: new Date()
        }
      });
    } catch (sessionError: any) {
      logger.warn('Failed to close user sessions', {
        userId,
        error: sessionError.message
      });
    }
  };

  // Register new user
  router.post('/register', authRateLimiter, asyncHandler(async (req: any, res: any) => {
    const { username, email, password }: RegisterRequest = req.body;

    try {
      // Validate input
      if (!username || !isValidUsername(username)) {
        throw createValidationError('username', 'Username must be 3-20 characters and contain only letters, numbers, and underscores');
      }

      if (!email || !isValidEmail(email)) {
        throw createValidationError('email', 'Please provide a valid email address');
      }

      if (!password || !isValidPassword(password)) {
        throw createValidationError('password', 'Password must be at least 8 characters long');
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email.toLowerCase() },
            { username }
          ]
        }
      });

      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          throw createConflictError('Email already registered');
        } else {
          throw createConflictError('Username already taken');
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user (email not verified yet)
      const user = await prisma.user.create({
        data: {
          username,
          email: email.toLowerCase(),
          passwordHash: hashedPassword,
          permissionRole: 'USER',
          emailVerified: false, // Require verification
        }
      });

      // Create verification token and send email
      const verificationToken = await createVerificationToken(user.id, 'EMAIL_VERIFICATION');
      await sendVerificationEmail(email, username, verificationToken, logger);

      // Generate JWT token (but user needs to verify email for full access)
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.permissionRole,
          emailVerified: false
        } as object,
        config.jwt.secret as string,
        { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
      );

      logger.info('User registered successfully', { userId: user.id, email });

      res.status(201).json({
        status: 'success',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.permissionRole,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
          },
          token,
          message: isEmailConfigured()
            ? 'Please check your email to verify your account.'
            : 'Account created. Email verification is pending configuration.',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Registration failed', error);
      throw error;
    }
  }));

  // Verify email
  router.get('/verify-email', asyncHandler(async (req: any, res: any) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw createValidationError('token', 'Verification token is required');
    }

    const result = await validateToken(token, 'EMAIL_VERIFICATION');

    if (!result.valid) {
      throw createUnauthorizedError(result.error || 'Invalid verification token');
    }

    // Update user's email verified status
    await prisma.user.update({
      where: { id: result.userId },
      data: { emailVerified: true }
    });

    logger.info('Email verified successfully', { userId: result.userId });

    // Redirect to app or show success page
    res.status(200).json({
      status: 'success',
      data: {
        message: 'Email verified successfully. You can now log in.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }));

  // Resend verification email
  router.post('/resend-verification', resendVerificationRateLimiter, asyncHandler(async (req: any, res: any) => {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      throw createValidationError('email', 'Please provide a valid email address');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Don't reveal if user exists or not
    if (!user || user.emailVerified) {
      res.status(200).json({
        status: 'success',
        data: {
          message: 'If your email is registered and not verified, you will receive a verification email.',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Create new verification token and send email
    const verificationToken = await createVerificationToken(user.id, 'EMAIL_VERIFICATION');
    await sendVerificationEmail(email, user.username, verificationToken, logger);

    logger.info('Verification email resent', { userId: user.id, email });

    res.status(200).json({
      status: 'success',
      data: {
        message: 'If your email is registered and not verified, you will receive a verification email.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }));

  // Login user
  router.post('/login', authRateLimiter, asyncHandler(async (req: any, res: any) => {
    const { email, password }: LoginRequest = req.body;

    try {
      // Validate input
      if (!email || !isValidEmail(email)) {
        throw createValidationError('email', 'Please provide a valid email address');
      }

      if (!password) {
        throw createValidationError('password', 'Password is required');
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        throw createUnauthorizedError('Invalid email or password');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        throw createUnauthorizedError('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw createUnauthorizedError('Account is suspended');
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.permissionRole,
          emailVerified: user.emailVerified
        } as object,
        config.jwt.secret as string,
        { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
      );

      logger.info('User logged in successfully', { userId: user.id, email });

      await recordUserSession(user.id, req);

      res.status(200).json({
        status: 'success',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.permissionRole,
            emailVerified: user.emailVerified,
            lastLogin: user.lastLogin,
          },
          token,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Login failed', error);
      throw error;
    }
  }));

  // Forgot password - request reset
  router.post('/forgot-password', passwordResetRateLimiter, asyncHandler(async (req: any, res: any) => {
    const { email }: ForgotPasswordRequest = req.body;

    if (!email || !isValidEmail(email)) {
      throw createValidationError('email', 'Please provide a valid email address');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Don't reveal if user exists - always show same message
    if (user) {
      const resetToken = await createVerificationToken(user.id, 'PASSWORD_RESET');
      await sendPasswordResetEmail(email, user.username, resetToken, logger);
      logger.info('Password reset email sent', { userId: user.id, email });
    }

    res.status(200).json({
      status: 'success',
      data: {
        message: 'If your email is registered, you will receive a password reset link.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }));

  // Reset password with token
  router.post('/reset-password', authRateLimiter, asyncHandler(async (req: any, res: any) => {
    const { token, password }: ResetPasswordRequest = req.body;

    if (!token) {
      throw createValidationError('token', 'Reset token is required');
    }

    if (!password || !isValidPassword(password)) {
      throw createValidationError('password', 'Password must be at least 8 characters long');
    }

    const result = await validateToken(token, 'PASSWORD_RESET');

    if (!result.valid) {
      throw createUnauthorizedError(result.error || 'Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password
    await prisma.user.update({
      where: { id: result.userId },
      data: { passwordHash: hashedPassword }
    });

    // Close all existing sessions for security
    await closeUserSessions(result.userId!);

    logger.info('Password reset successfully', { userId: result.userId });

    res.status(200).json({
      status: 'success',
      data: {
        message: 'Password reset successfully. Please log in with your new password.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }));

  // Logout user
  router.post('/logout', authMiddleware(prisma, logger), asyncHandler(async (req: any, res: any) => {
    try {
      logger.info('User logged out', { userId: req.user.id });

      await closeUserSessions(req.user.id);

      res.status(200).json({
        status: 'success',
        data: {
          message: 'Logged out successfully'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Logout failed', error);
      throw error;
    }
  }));

  // Get current user
  router.get('/me', authMiddleware(prisma, logger), asyncHandler(async (req: any, res: any) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          username: true,
          email: true,
          permissionRole: true,
          emailVerified: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
        }
      });

      if (!user) {
        throw createUnauthorizedError('User not found');
      }

      res.status(200).json({
        status: 'success',
        data: {
          user,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Get current user failed', error);
      throw error;
    }
  }));

  return router;
}

import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';
import { config } from '../utils/config';
import { createUnauthorizedError } from '../utils/helpers';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// AuthenticatedRequest interface for typed requests
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Extend request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export function authMiddleware(prisma: PrismaClient, logger: Logger) {
  return async (req: any, res: any, next: any) => {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createUnauthorizedError('No token provided');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

      // Check if user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          permissionRole: true,
          isActive: true,
        }
      });

      if (!user || !user.isActive) {
        throw createUnauthorizedError('User not found or inactive');
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.permissionRole,
      };

      next();
    } catch (error: any) {
      logger.error('Authentication failed', {
        error: error.message,
        requestId: req.requestId,
      });

      if (error.name === 'JsonWebTokenError') {
        return next(createUnauthorizedError('Invalid token'));
      }
      
      if (error.name === 'TokenExpiredError') {
        return next(createUnauthorizedError('Token expired'));
      }

      next(error);
    }
  };
}

// Optional auth middleware (doesn't throw error if no token)
export function optionalAuthMiddleware(prisma: PrismaClient, logger: Logger) {
  return async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // Continue without user
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          permissionRole: true,
          isActive: true,
        }
      });

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.permissionRole,
        };
      }

      next();
    } catch (error: any) {
      // Ignore auth errors in optional middleware
      next();
    }
  };
}

// Role-based access control middleware
export function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return next(createUnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(createUnauthorizedError('Insufficient permissions'));
    }

    next();
  };
}

// Female-only access middleware
export function requireFemale() {
  return requireRole(['FEMALE', 'female']);
}
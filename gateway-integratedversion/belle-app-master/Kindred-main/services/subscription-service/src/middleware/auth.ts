import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('No token provided', 401);
    }

    const token = authHeader.substring(7);
    
    if (!process.env.JWT_SECRET) {
      throw createError('JWT secret not configured', 500);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    req.user = {
      id: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

// Admin authentication middleware
export const authenticateAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  authenticateUser(req, res, (err: any) => {
    if (err) {
      return next(err);
    }
    
    if (!req.user || req.user.role !== 'admin') {
      return next(createError('Admin access required', 403));
    }
    
    next();
  });
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return next(createError('Insufficient permissions', 403));
    }

    next();
  };
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        req.user = {
          id: decoded.id || decoded.userId,
          email: decoded.email,
          role: decoded.role
        };
      }
    }
    
    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};
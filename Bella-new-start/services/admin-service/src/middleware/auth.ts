import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { config } from '../utils/config';
import { AuthenticatedRequest } from './errorHandler';

const prisma = new PrismaClient();

export const authenticateAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({ error: 'Access denied. No token provided.' });
      return;
    }

    const decoded = jwt.verify(token, config.jwtSecret) as any;
    
    // Fetch admin with permissions
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      include: {
        permissions: true
      }
    });

    if (!admin || !admin.isActive) {
      res.status(401).json({ error: 'Invalid token or admin inactive.' });
      return;
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions.map((p: any) => p.name)
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const hasPermission = req.admin.permissions.includes(permission) ||
                         req.admin.role === 'SUPER_ADMIN';

    if (!hasPermission) {
      res.status(403).json({ error: 'Insufficient permissions.' });
      return;
    }

    next();
  };
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!roles.includes(req.admin.role)) {
      res.status(403).json({ error: 'Insufficient role.' });
      return;
    }

    next();
  };
};
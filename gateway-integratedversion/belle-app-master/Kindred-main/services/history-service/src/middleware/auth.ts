import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types';

export { AuthenticatedRequest };

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      error: 'Access token required'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (error) {
    logger.warn('Invalid token attempt', { 
      token: token.substring(0, 10) + '...',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(403).json({
      error: 'Invalid or expired token'
    });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    res.status(403).json({
      error: 'Admin access required'
    });
    return;
  }

  next();
};
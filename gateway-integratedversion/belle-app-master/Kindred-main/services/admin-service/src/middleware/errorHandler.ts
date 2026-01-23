import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export const errorHandler = (
  error: any,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    adminId: req.admin?.id,
    body: req.body
  });

  // Handle different types of errors
  if (error.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation failed',
      details: error.details || error.message
    });
    return;
  }

  if (error.name === 'UnauthorizedError' || error.message === 'Unauthorized') {
    res.status(401).json({
      error: 'Unauthorized access'
    });
    return;
  }

  if (error.name === 'ForbiddenError' || error.message === 'Forbidden') {
    res.status(403).json({
      error: 'Insufficient permissions'
    });
    return;
  }

  if (error.name === 'NotFoundError' || error.message === 'Not Found') {
    res.status(404).json({
      error: 'Resource not found'
    });
    return;
  }

  if (error.code === 'P2002') {
    res.status(409).json({
      error: 'Resource already exists',
      field: error.meta?.target
    });
    return;
  }

  if (error.code === 'P2025') {
    res.status(404).json({
      error: 'Resource not found'
    });
    return;
  }

  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
};
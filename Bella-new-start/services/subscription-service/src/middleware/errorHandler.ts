import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { statusCode = 500, message } = err;

  logger.error('Error occurred:', {
    error: message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    statusCode
  });

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction && statusCode === 500 
    ? 'Internal server error' 
    : message;

  res.status(statusCode).json({
    status: 'error',
    message: errorMessage,
    ...(isProduction ? {} : { stack: err.stack })
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
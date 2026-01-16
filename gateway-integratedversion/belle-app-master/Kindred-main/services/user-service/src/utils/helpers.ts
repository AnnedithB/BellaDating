import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Error types
export function createValidationError(field: string, message: string): Error {
  const error = new Error(message) as any;
  error.code = 'VALIDATION_ERROR';
  error.field = field;
  error.statusCode = 400;
  return error;
}

export function createNotFoundError(resource: string): Error {
  const error = new Error(`${resource} not found`) as any;
  error.code = 'NOT_FOUND';
  error.statusCode = 404;
  return error;
}

export function createUnauthorizedError(message?: string): Error {
  const error = new Error(message || 'Unauthorized') as any;
  error.code = 'UNAUTHORIZED';
  error.statusCode = 401;
  return error;
}

export function createConflictError(message: string): Error {
  const error = new Error(message) as any;
  error.code = 'CONFLICT';
  error.statusCode = 409;
  return error;
}

// Input sanitization and validation
export function sanitizeDisplayName(displayName: string): string {
  return displayName.trim().slice(0, 50);
}

export function sanitizeBio(bio: string): string {
  return bio.trim().slice(0, 500);
}

export function isValidAge(age: number): boolean {
  return age >= 18 && age <= 100;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

export function generateFileName(originalName: string, prefix: string): string {
  const extension = originalName.split('.').pop();
  return `${prefix}_${Date.now()}_${require('uuid').v4()}.${extension}`;
}

// Middleware
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Add request ID middleware
export function requestId(req: Request, res: Response, next: NextFunction) {
  (req as any).requestId = uuidv4();
  next();
}

// Error handler middleware
export function errorHandler(req: Request, res: Response, next: NextFunction) {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    
    res.status(statusCode).json({
      status: 'error',
      message,
      code: err.code || 'INTERNAL_ERROR',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId,
      },
    });
  };
}